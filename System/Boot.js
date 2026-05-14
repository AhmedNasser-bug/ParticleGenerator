/**
 * System/Boot — bootstraps the particle generator.
 *
 * @param {HTMLElement} lightDomEl — host element for color analysis
 * @param {HTMLElement} mountEl — element in Shadow DOM where canvas attaches
 * @returns {{ start, stop, destroy }} controller
 */
import { sample, weightedPalette } from '../Distribution/ColorAnalyzer.js';
import { resolve, names } from '../Particle/ShapeFactory.js';
import { WebGLRenderer } from '../Core/WebGLRenderer.js';
import { ParticleSystem } from '../Core/ParticleSystem.js';
import config from '../config.json';
import { success, failure } from '../TraceLog.js';

const boot = (lightDomEl, mountEl) => {
    try {
        success('Boot', `Sampling colors from <${lightDomEl.tagName.toLowerCase()}>`);
        const dist = sample(lightDomEl);
        config.colorDistribution = dist;
        const palette = weightedPalette(
            dist.map((c) => ({ hex: c.hex, count: Math.max(1, Math.round(c.count / 10)) }))
        );
        success('Boot', `Sampled ${dist.length} colors → palette ${palette.length}`);

        const shapeNames = names();
        const shapeGeos = shapeNames.map((n) => resolve(n));

        const renderer = new WebGLRenderer();
        renderer.init(mountEl, shapeGeos, config.render);

        const emissionRadiusNorm = config.emission.radius / 250;
        const system = new ParticleSystem(
            config.particleCount,
            palette,
            shapeNames.length,
            config.noiseRegistry,
            { radius: emissionRadiusNorm, falloff: config.emission.falloff }
        );
        success('Boot', `Particles: ${system.count}, noise: ${config.noiseRegistry.active}`);

        let running = false;
        let frameId = null;
        let time = 0;

        const render = () => {
            if (!running) return;
            time++;
            renderer.draw(system.update(time), config.render);
            frameId = requestAnimationFrame(render);
        };

        const resize = () => renderer.resize();
        window.addEventListener('resize', resize);

        const start = () => { if (!running) { running = true; render(); } };
        const stop = () => { running = false; if (frameId) { cancelAnimationFrame(frameId); frameId = null; } };
        const destroy = () => {
            stop();
            window.removeEventListener('resize', resize);
            renderer.destroy();
        };

        return { start, stop, destroy };
    } catch (err) {
        failure('Boot', 'Failed', { error: err.message });
        return null;
    }
};

export { boot };