/**
 * GenerationAlgorithms/PerlinNoise.js — standard 2D gradient noise.
 *
 * Pure function: no global state, no side effects.
 * Output normalized to [0.0, 1.0] for easy scaling.
 *
 * Algorithm:
 *   - Permutation table seeded deterministically
 *   - Gradient vectors at lattice points
 *   - Smooth interpolation: 6t⁵ - 15t⁴ + 10t³
 *   - Multi-octave fBm sums octaves with persistence
 *
 * HOT PATH: PERM_X / PERM_Y are pre-built Uint8Arrays at module load.
 * sampleFlow() uses them directly — zero heap allocation per call.
 */

// ── Named algorithm constants ──────────────────────────────────────────────
// Multiplier / modulus for the LCG used in buildPerm (Park-Miller)
const LCG_A   = 16807;
const LCG_M   = 2147483647;
const PERM_SIZE = 256;

// ── Permutation table ──────────────────────────────────────────────────────
const buildPerm = (seed = 0) => {
    const p = Array.from({ length: PERM_SIZE }, (_, i) => i);
    let s = seed;
    for (let i = PERM_SIZE - 1; i > 0; i--) {
        s = (s * LCG_A) % LCG_M;
        const j = s % (i + 1);
        [p[i], p[j]] = [p[j], p[i]];
    }
    return new Uint8Array([...p, ...p]);
};

// Pre-built — zero per-frame allocation in hot path (seeds match original sampleFlow)
const PERM_X = buildPerm(1);
const PERM_Y = buildPerm(2);

// ── Core math ──────────────────────────────────────────────────────────────
const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
const lerp  = (a, b, t) => a + t * (b - a);

const grad = (hash, x, y) => {
    const h = hash & 3;
    const u = h < 2 ? x : y;
    const v = h < 2 ? y : x;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
};

/**
 * Single-octave 2D Perlin noise.
 * @param {number} x
 * @param {number} y
 * @param {Uint8Array} perm
 * @returns {number} in [-1, 1]
 */
const perlin = (x, y, perm) => {
    const X  = Math.floor(x) & 255;
    const Y  = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const u  = fade(xf);
    const v  = fade(yf);
    const aa = perm[perm[X]     + Y];
    const ab = perm[perm[X]     + Y + 1];
    const ba = perm[perm[X + 1] + Y];
    const bb = perm[perm[X + 1] + Y + 1];
    return lerp(
        lerp(grad(aa, xf, yf),     grad(ba, xf - 1, yf),     u),
        lerp(grad(ab, xf, yf - 1), grad(bb, xf - 1, yf - 1), u),
        v
    );
};

/**
 * Multi-octave fBm. Normalizes to [0, 1].
 * Builds its own perm table — NOT for use in the hot path.
 *
 * @param {number} x
 * @param {number} y
 * @param {Object} [opts] — { octaves, persistence, scale, seed }
 * @returns {number} in [0, 1]
 */
const fbm = (x, y, opts = {}) => {
    const octaves     = opts.octaves     || 3;
    const persistence = opts.persistence || 0.5;
    const scale       = opts.scale       || 0.02;
    const perm        = buildPerm(opts.seed || 0);
    let value = 0, amplitude = 1, frequency = 1, maxSum = 0;
    for (let i = 0; i < octaves; i++) {
        value  += perlin(x * scale * frequency, y * scale * frequency, perm) * amplitude;
        maxSum += amplitude;
        amplitude *= persistence;
        frequency *= 2;
    }
    return value / maxSum * 0.5 + 0.5;
};

/**
 * HOT PATH — sample a noise vector field for particle flow.
 * Returns [dx, dy] in [-1, 1].
 *
 * Uses pre-built PERM_X/PERM_Y — zero heap allocation.
 * Single-octave (frequency=1) matches fBm first octave at scale.
 * Time offset is controlled by opts.timeScale (from config.noise.timeScale).
 *
 * @param {number} x
 * @param {number} y
 * @param {number} t — frame counter
 * @param {Object} [opts] — { scale, timeScale }
 * @returns {[number, number]}
 */
const sampleFlow = (x, y, t, opts = {}) => {
    const scale     = opts.scale     || 0.02;
    const timeScale = opts.timeScale || 0.001;
    const tOff      = t * timeScale;
    return [
        perlin((x + tOff) * scale, y           * scale, PERM_X),
        perlin(x           * scale, (y + tOff) * scale, PERM_Y),
    ];
};

export { perlin, fbm, sampleFlow, buildPerm };