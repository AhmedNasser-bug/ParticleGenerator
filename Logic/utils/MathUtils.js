/**
 * Logic/utils/MathUtils.js — shared math primitives.
 * Used by Logic/Noise/PerlinNoise.js. Kept separate for reuse and testability.
 */

/** Quintic fade curve — zero first/second derivative at endpoints. */
export const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);

/** Linear interpolation. */
export const lerp = (a, b, t) => a + t * (b - a);
