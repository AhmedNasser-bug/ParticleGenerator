/**
 * GenerationAlgorithms/PerlinNoise.js — standard 2D gradient noise.
 *
 * Pure function: no global state, no side effects.
 * Output normalized to [0.0, 1.0] for easy scaling.
 *
 * Algorithm:
 *   - Permutation table seeded deterministically from a given seed
 *   - Each lattice point has a pseudo-random gradient vector
 *   - Smooth interpolation via fade curve: 6t⁵ - 15t⁴ + 10t³
 *   - Multi-octave fract brownian motion sums octaves with persistence
 */

// ── Helper: deterministic permutation table from seed ──
const buildPerm = (seed = 0) => {
    const p = Array.from({ length: 256 }, (_, i) => i);
    let s = seed;
    for (let i = 255; i > 0; i--) {
        s = (s * 16807 + 0) % 2147483647;
        const j = s % (i + 1);
        [p[i], p[j]] = [p[j], p[i]];
    }
    return [...p, ...p];
};

const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a, b, t) => a + t * (b - a);

const grad = (hash, x, y) => {
    const h = hash & 3;
    const u = h < 2 ? x : y;
    const v = h < 2 ? y : x;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
};

/**
 * Single octave 2D Perlin noise.
 * Pure function: same inputs → same output.
 *
 * @param {number} x
 * @param {number} y
 * @param {number[]} perm — shuffled permutation table (512 entries)
 * @returns {number} value in [-1, 1]
 */
const perlin = (x, y, perm) => {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const u = fade(xf);
    const v = fade(yf);

    const aa = perm[perm[X] + Y];
    const ab = perm[perm[X] + Y + 1];
    const ba = perm[perm[X + 1] + Y];
    const bb = perm[perm[X + 1] + Y + 1];

    const x1 = lerp(grad(aa, xf, yf), grad(ba, xf - 1, yf), u);
    const x2 = lerp(grad(ab, xf, yf - 1), grad(bb, xf - 1, yf - 1), u);
    return lerp(x1, x2, v);
};

/**
 * Multi-octave fractal Brownian motion.
 * Normalizes output to [0.0, 1.0].
 *
 * @param {number} x
 * @param {number} y
 * @param {Object} [opts]
 * @param {number} [opts.octaves=3]
 * @param {number} [opts.persistence=0.5]
 * @param {number} [opts.scale=0.02]
 * @param {number} [opts.seed=0]
 * @returns {number} value in [0, 1]
 */
const fbm = (x, y, opts = {}) => {
    const octaves = opts.octaves || 3;
    const persistence = opts.persistence || 0.5;
    const scale = opts.scale || 0.02;
    const seed = opts.seed || 0;
    const perm = buildPerm(seed);

    let value = 0;
    let amplitude = 1;
    let frequency = 1;
    let maxSum = 0;

    for (let i = 0; i < octaves; i++) {
        const sx = x * scale * frequency;
        const sy = y * scale * frequency;
        // Input time offset for animation can be added externally
        value += perlin(sx, sy, perm) * amplitude;
        maxSum += amplitude;
        amplitude *= persistence;
        frequency *= 2;
    }

    // Normalize from [-1, 1] range to [0, 1]
    return value / maxSum * 0.5 + 0.5;
};

/**
 * Sample a noise vector field for particle flow.
 * Returns [dx, dy] in [-1, 1] for use as a velocity direction.
 * Uses two noise evaluations with different seeds for x/y independence.
 *
 * @param {number} x
 * @param {number} y
 * @param {number} t — time for animation
 * @param {Object} [opts]
 * @returns {[number, number]}
 */
const sampleFlow = (x, y, t, opts = {}) => {
    // Flow uses x+t on one axis, y+t on the other
    const nx = fbm(x + t * 0.001, y, { ...opts, seed: 1 });
    const ny = fbm(x, y + t * 0.001, { ...opts, seed: 2 });
    // Map from [0,1] to [-1, 1]
    return [nx * 2 - 1, ny * 2 - 1];
};

export { perlin, fbm, sampleFlow };