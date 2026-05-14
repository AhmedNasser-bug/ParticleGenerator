/**
 * GenerationAlgorithms/WhiteNoise.js — high-performance PRNG for chaotic jitter.
 *
 * Uses xorshift128+ algorithm: fast, deterministic, excellent distribution.
 * Pure function: no global state.
 *
 * Output range: [0.0, 1.0] for easy scaling.
 */

/**
 * xorshift128+ PRNG.
 * Returns a function that produces deterministic uniform random numbers
 * in [0, 1) given a seed state.
 */
const xorshift = (seed0 = 123456789, seed1 = 362436069) => {
    let s0 = seed0 >>> 0;
    let s1 = seed1 >>> 0;

    const next = () => {
        let x = s0;
        let y = s1;
        s0 = y;
        x ^= x << 23;
        x ^= x >>> 17;
        x ^= y;
        x ^= y >>> 26;
        s1 = x;
        return (s0 + s1) >>> 0;
    };

    return next;
};

/**
 * Create a PRNG seeded from a coordinate hash.
 * Ensures each (x, y, t) gets a distinct but deterministic random sequence.
 *
 * @param {number} x
 * @param {number} y
 * @param {number} t — time
 * @param {number} [amp=1.0] — amplitude multiplier for output
 * @returns {() => number} function returning values in [0, amp)
 */
const seededRandom = (x, y, t, amp = 1.0) => {
    const h = (x * 73856093) ^ (y * 19349663) ^ (t * 83492791);
    const seed0 = (h & 0xFFFFFFFF) >>> 0;
    const seed1 = ((h * 1103515245 + 12345) & 0xFFFFFFFF) >>> 0;
    const gen = xorshift(seed0 || 1, seed1 || 1);
    return () => (gen() / 4294967296) * amp;
};

/**
 * Sample white noise jitter at a given (x, y, t).
 * Returns [jx, jy] where each component is in [-amp, amp].
 *
 * @param {number} x
 * @param {number} y
 * @param {number} t — time (frame counter)
 * @param {number} [amp=1.0]
 * @returns {[number, number]}
 */
const sampleJitter = (x, y, t, amp = 1.0) => {
    const rng = seededRandom(x, y, t, amp);
    return [rng() * 2 - amp, rng() * 2 - amp];
};

/**
 * Generate a batch of N white noise samples for performance.
 * Returns Float32Array of [jx0, jy0, jx1, jy1, ...].
 *
 * @param {number} count
 * @param {number} [amp=1.0]
 * @returns {Float32Array}
 */
const batchJitter = (count, amp = 1.0) => {
    const out = new Float32Array(count * 2);
    for (let i = 0; i < count; i++) {
        // Use i as spatial seed for independent values per particle
        const rng = seededRandom(i * 0.01, i * 0.02, 0, amp);
        out[i * 2] = rng() * 2 - amp;
        out[i * 2 + 1] = rng() * 2 - amp;
    }
    return out;
};

export { xorshift, seededRandom, sampleJitter, batchJitter };