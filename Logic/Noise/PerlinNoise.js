/** Logic/Noise/PerlinNoise.js — 2D gradient noise. lerp/fade from MathUtils. */
import { lerp, fade } from '../utils/MathUtils.js';

const LCG_A = 16807, LCG_M = 2147483647, PERM_SIZE = 256;

export const buildPerm = (seed = 0) => {
    const p = Array.from({ length: PERM_SIZE }, (_, i) => i);
    let s = seed;
    for (let i = PERM_SIZE - 1; i > 0; i--) {
        s = (s * LCG_A) % LCG_M;
        const j = s % (i + 1);
        [p[i], p[j]] = [p[j], p[i]];
    }
    return new Uint8Array([...p, ...p]);
};

// Pre-built — zero per-frame allocation in hot path
const PERM_X = buildPerm(1);
const PERM_Y = buildPerm(2);

const grad = (hash, x, y) => {
    const h = hash & 3, u = h < 2 ? x : y, v = h < 2 ? y : x;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
};

export const perlin = (x, y, perm) => {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
    const xf = x - Math.floor(x), yf = y - Math.floor(y);
    const u = fade(xf), v = fade(yf);
    const aa = perm[perm[X]+Y], ab = perm[perm[X]+Y+1];
    const ba = perm[perm[X+1]+Y], bb = perm[perm[X+1]+Y+1];
    return lerp(
        lerp(grad(aa,xf,yf),     grad(ba,xf-1,yf),   u),
        lerp(grad(ab,xf,yf-1),   grad(bb,xf-1,yf-1), u), v);
};

export const fbm = (x, y, opts = {}) => {
    const { octaves=3, persistence=0.5, scale=0.02, seed=0 } = opts;
    const perm = buildPerm(seed);
    let value=0, amplitude=1, frequency=1, maxSum=0;
    for (let i=0; i<octaves; i++) {
        value  += perlin(x*scale*frequency, y*scale*frequency, perm) * amplitude;
        maxSum += amplitude; amplitude *= persistence; frequency *= 2;
    }
    return value / maxSum * 0.5 + 0.5;
};

export const sampleFlow = (x, y, t, opts = {}) => {
    const scale = opts.scale || 0.02, tOff = t * (opts.timeScale || 0.001);
    return [
        perlin((x + tOff) * scale, y           * scale, PERM_X),
        perlin(x           * scale, (y + tOff) * scale, PERM_Y),
    ];
};
