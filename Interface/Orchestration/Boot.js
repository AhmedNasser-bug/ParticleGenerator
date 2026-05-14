/** Interface/Orchestration/Boot.js — wires all three tiers. */
import { sample, weightedPalette } from '../../Logic/Color/ColorAnalyzer.js';
import { resolve, names }          from '../../Logic/Particle/ShapeFactory.js';
import { Renderer }                from '../../Core/Pipeline/Renderer.js';
import { CommandQueue }            from '../../Core/Pipeline/CommandQueue.js';
import { ParticleSystem, O }       from '../../Logic/Particle/ParticleSystem.js';
import { PerformanceMonitor }      from '../../Logic/Performance/PerformanceMonitor.js';
import defaultConfig               from '../../config.json';
import { success, failure }        from '../../TraceLog.js';

const INST_FLOATS = 7;

const boot = (lightDomEl, mountEl, rawConfig = defaultConfig) => {
    const config = structuredClone(rawConfig);
    try {
        success('Boot', `Sampling <${lightDomEl.tagName.toLowerCase()}>`);
        const dist    = sample(lightDomEl);
        config.colorDistribution = dist;
        const palette = weightedPalette(
            dist.map((c) => ({ hex: c.hex, count: Math.max(1, Math.round(c.count / 10)) }))
        );
        success('Boot', `Colors: ${dist.length} → palette ${palette.length}`);

        const shapeNames = names(), shapeGeos = shapeNames.map((n) => resolve(n));
        const shapeCount = shapeNames.length;

        const renderer = new Renderer();
        renderer.init(mountEl, shapeGeos);
        const queue = new CommandQueue();

        let system  = _make(config, palette, shapeCount);
        let scratch = shapeNames.map(() => new Float32Array(config.particleCount * INST_FLOATS));
        const sc    = new Int32Array(shapeCount);
        success('Boot', `Particles: ${system.count}, noise: ${config.noiseRegistry.active}`);

        const perf = config.performance.autoThrottle ? new PerformanceMonitor({
            threshold: config.performance.minFpsThreshold,
            onThrottle: (fps) => {
                const next = Math.max(500, system.count - config.performance.throttleStep);
                if (next < system.count) {
                    success('Boot', `Throttle @ ${fps.toFixed(1)} FPS → ${next}`);
                    config.particleCount = next;
                    system  = _make(config, palette, shapeCount);
                    scratch = shapeNames.map(() => new Float32Array(next * INST_FLOATS));
                    perf.reset();
                }
            },
        }) : null;

        let running = false, frameId = null, time = 0;
        const render = () => {
            if (!running) return;
            perf?.tick(); time++;
            const p = system.update(time);
            _batch(p, system.count, shapeCount, scratch, sc, config.render);
            queue.begin(config.render.glowIntensity);
            for (let s = 0; s < shapeCount; s++)
                if (sc[s] > 0) queue.addBatch(s, scratch[s], sc[s]);
            renderer.execute(queue);
            frameId = requestAnimationFrame(render);
        };
        const resize = () => renderer.resize();
        window.addEventListener('resize', resize);
        const start   = () => { if (!running) { running = true; render(); } };
        const stop    = () => { running = false; if (frameId) { cancelAnimationFrame(frameId); frameId = null; } };
        const destroy = () => { stop(); window.removeEventListener('resize', resize); renderer.destroy(); };
        const configure = (patch) => {
            if (patch.render)  Object.assign(config.render, patch.render);
            if (patch.emission) {
                Object.assign(config.emission, patch.emission);
                // Use same NDC conversion: pixel radius / (half viewport height)
                const ndcRadius = config.emission.radius / (window.innerHeight / 2);
                system.setEmission(ndcRadius, config.emission.falloff);
            }
            if (patch.noiseType !== undefined) { config.noiseRegistry.active = patch.noiseType; system.setNoiseType(patch.noiseType); }
            if (patch.particleCount !== undefined) {
                config.particleCount = patch.particleCount;
                system  = _make(config, palette, shapeCount);
                scratch = shapeNames.map(() => new Float32Array(patch.particleCount * INST_FLOATS));
            }
        };
        return { start, stop, destroy, configure };
    } catch (err) { failure('Boot', 'Failed', { error: err.message }); return null; }
};

const _make = (config, palette, shapeCount) => {
    // Convert pixel radius to NDC: half-screen height = 1.0 NDC
    const ndcRadius = config.emission.radius / (window.innerHeight / 2);
    return new ParticleSystem(config.particleCount, palette, shapeCount,
        config.noiseRegistry,
        { radius: ndcRadius, falloff: config.emission.falloff },
        config.physics, config.noise);
};

const _batch = (particles, count, shapeCount, scratch, sc, renderCfg) => {
    const cs = renderCfg.sizeToClipScale ?? 0.02;
    sc.fill(0);
    for (let i = 0; i < count; i++) {
        const b = i * O.STRIDE, sIdx = Math.round(particles[b + O.SHAPE]);
        if (sIdx < 0 || sIdx >= shapeCount) continue;
        const n = sc[sIdx], iOff = n * INST_FLOATS, buf = scratch[sIdx];
        buf[iOff]=particles[b+O.X]; buf[iOff+1]=particles[b+O.Y];
        buf[iOff+2]=particles[b+O.SIZE]*cs;
        buf[iOff+3]=particles[b+O.R]; buf[iOff+4]=particles[b+O.G];
        buf[iOff+5]=particles[b+O.B]; buf[iOff+6]=particles[b+O.ALPHA];
        sc[sIdx]=n+1;
    }
};

export { boot };
