/** Logic/NoiseRegistry.js — moved from GenerationAlgorithms/. Imports unchanged. */
import { sampleFlow }   from './PerlinNoise.js';
import { sampleJitter } from './WhiteNoise.js';

const PerlinProvider = { flow: sampleFlow, jitter: sampleJitter };

const WhiteProvider = {
    flow: (x, y, t, opts) => {
        const amp = (opts && opts.amplitude) || 1.0;
        const [jx] = sampleJitter(x + 0.5, y, t, amp);
        const [, jy] = sampleJitter(x, y + 0.5, t, amp);
        return [jx, jy];
    },
    jitter: sampleJitter,
};

const _registry = { perlin: PerlinProvider, white: WhiteProvider };

const resolveProvider  = (name) => _registry[name] || _registry.perlin;
const registerProvider = (name, provider) => {
    if (typeof provider.flow !== 'function' || typeof provider.jitter !== 'function')
        throw new Error(`NoiseRegistry: provider "${name}" must implement { flow, jitter }`);
    _registry[name] = provider;
};
const listProviders = () => Object.keys(_registry);

export { resolveProvider, registerProvider, listProviders };
