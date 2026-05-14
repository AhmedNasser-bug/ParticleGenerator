/**
 * Interface/Boot.js — Orchestrator. Wires all three tiers together.
 * Moved from System/Boot.js. All inter-tier imports updated to new paths.
 *
 * Data flow per frame:
 *   Logic: ParticleSystem.update(t) → Float32Array (interleaved SAB)
 *     → _batchInstances()           [Logic→Core bridge, zero alloc]
 *       → Core: Renderer.execute(queue)  [all gl.* calls]
 */
import { sample, weightedPalette } from '../Logic/ColorAnalyzer.js';
import { resolve, names }          from '../Logic/ShapeFactory.js';
import { Renderer }                from '../Core/Renderer.js';
import { CommandQueue }            from '../Core/CommandQueue.js';
import { ParticleSystem, O }       from '../Logic/ParticleSystem.js';
import { PerformanceMonitor }      from '../Logic/PerformanceMonitor.js';
import defaultConfig               from '../config.json';
import { success, failure }        from '../TraceLog.js';

const INST_FLOATS = 7; // tx, ty, scale, r, g, b, alpha

const boot = (lightDomEl, mountEl, rawConfig = defaultConfig) => {
    const config = structuredClone(rawConfig);
    try {
        success('Boot', `Sampling colors from <${lightDomEl.tagName.toLowerCase()}>`);
        const dist    = sample(lightDomEl);
        config.colorDistribution = dist;
        const palette = weightedPalette(
            dist.map((c) => ({ hex: c.hex, count: Math.max(1, Math.round(c.count / 10)) }))
        );
        success('Boot', `Colors: ${dist.length} → palette ${palette.length}`);

        const shapeNames = names();
        const shapeGeos  = shapeNames.map((n) => resolve(n));
        const shapeCount = shapeNames.length;

        const renderer = new Renderer();
        renderer.init(mountEl, shapeGeos);
        const queue = new CommandQueue();

        let system  = _makeSystem(config, palette, shapeCount);
        let scratch = shapeNames.map(() => new Float32Array(config.particleCount * INST_FLOATS));
        const scratchCount = new Int32Array(shapeCount);
        success('Boot', `Particles: ${system.count}, noise: ${config.noiseRegistry.active}`);

        const perf = config.performance.autoThrottle
            ? new PerformanceMonitor({
                threshold: config.performance.minFpsThreshold,
                onThrottle: (fps) => {
                    const next = Math.max(500, system.count - config.performance.throttleStep);
                    if (next < system.count) {
                        success('Boot', `Throttle @ ${fps.toFixed(1)} FPS → ${next}`);
                        config.particleCount = next;
                        system  = _makeSystem(config, palette, shapeCount);
                        scratch = shapeNames.map(() => new Float32Array(next * INST_FLOATS));
                        perf.reset();
                    }
                },
            })
            : null;

        let running = false, frameId = null, time = 0;

        const render = () => {
            if (!running) return;
            perf?.tick();
            time++;
            const particles = system.update(time);
            _batchInstances(particles, system.count, shapeCount, scratch, scratchCount, config.render);
            queue.begin(config.render.glowIntensity);
            for (let s = 0; s < shapeCount; s++) {
                if (scratchCount[s] > 0) queue.addBatch(s, scratch[s], scratchCount[s]);
            }
            renderer.execute(queue);
            frameId = requestAnimationFrame(render);
        };

        const resize = () => renderer.resize();
        window.addEventListener('resize', resize);

        const start   = () => { if (!running) { running = true; render(); } };
        const stop    = () => { running = false; if (frameId) { cancelAnimationFrame(frameId); frameId = null; } };
        const destroy = () => { stop(); window.removeEventListener('resize', resize); renderer.destroy(); };

        const configure = (patch) => {
            if (patch.render) Object.assign(config.render, patch.render);
            if (patch.emission) {
                Object.assign(config.emission, patch.emission);
                system.setEmission(config.emission.radius / 250, config.emission.falloff);
            }
            if (patch.noiseType !== undefined) {
                config.noiseRegistry.active = patch.noiseType;
                system.setNoiseType(patch.noiseType);
            }
            if (patch.particleCount !== undefined) {
                config.particleCount = patch.particleCount;
                system  = _makeSystem(config, palette, shapeCount);
                scratch = shapeNames.map(() => new Float32Array(patch.particleCount * INST_FLOATS));
            }
        };

        return { start, stop, destroy, configure };
    } catch (err) {
        failure('Boot', 'Failed', { error: err.message });
        return null;
    }
};

const _makeSystem = (config, palette, shapeCount) =>
    new ParticleSystem(
        config.particleCount, palette, shapeCount,
        config.noiseRegistry,
        { radius: config.emission.radius / 250, falloff: config.emission.falloff },
        config.physics,
        config.noise,
    );

const _batchInstances = (particles, count, shapeCount, scratch, scratchCount, renderCfg) => {
    const clipScale = renderCfg.sizeToClipScale ?? 0.02;
    scratchCount.fill(0);
    for (let i = 0; i < count; i++) {
        const b = i * O.STRIDE;
        const sIdx = Math.round(particles[b + O.SHAPE]);
        if (sIdx < 0 || sIdx >= shapeCount) continue;
        const n = scratchCount[sIdx], iOff = n * INST_FLOATS, buf = scratch[sIdx];
        buf[iOff]   = particles[b + O.X];
        buf[iOff+1] = particles[b + O.Y];
        buf[iOff+2] = particles[b + O.SIZE] * clipScale;
        buf[iOff+3] = particles[b + O.R];
        buf[iOff+4] = particles[b + O.G];
        buf[iOff+5] = particles[b + O.B];
        buf[iOff+6] = particles[b + O.ALPHA];
        scratchCount[sIdx] = n + 1;
    }
};

export { boot };
