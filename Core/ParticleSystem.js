/**
 * Core/ParticleSystem — particle lifecycle with noise-driven motion.
 *
 * Each particle is a pure data structure consumed by WebGLRenderer.
 * Zero rendering logic.
 *
 * Update formula:
 *   P_new = P_old + (V_noise × Δt) + jitter
 *   V_noise = Perlin noise (fluid flow) + White noise (Brownian jitter)
 *   Δt = 1 (per frame)
 *
 * Emission: particles spawn within emissionRadius from center.
 * Vignette: opacity fades from center outward (alpha = 1 - dist/radius).
 * Culling: particles past viewport or alpha=0 are recycled.
 *
 * FLOATS_PER_PARTICLE layout: [x, y, size, r, g, b, alpha, shapeIdx] → 8 floats
 * (alpha added for vignette)
 */

import { sampleFlow } from '../GenerationAlgorithms/PerlinNoise.js';
import { sampleJitter } from '../GenerationAlgorithms/WhiteNoise.js';

const FLOATS_PER_PARTICLE = 8; // x, y, size, r, g, b, alpha, shapeIdx

class ParticleSystem {
    /**
     * @param {number} count — max particle count
     * @param {string[]} palette — weighted hex color array
     * @param {number} shapeCount — number of shape types
     * @param {Object} noiseConfig — { active, providers: { perlin: {...}, white: {...} } }
     * @param {Object} emissionConfig — { radius, falloff }
     */
    constructor(count, palette, shapeCount, noiseConfig, emissionConfig = {}) {
        this.count = count;
        this.palette = palette;
        this.shapeCount = shapeCount;
        this.noiseConfig = noiseConfig;
        this.emissionRadius = emissionConfig.radius || 1.0;
        this.falloff = emissionConfig.falloff || 1.0;

        // Flat GPU-friendly array: [x, y, size, r, g, b, alpha, shapeIdx] × N
        this.flat = new Float32Array(count * FLOATS_PER_PARTICLE);
        // Velocity: [vx, vy] × N
        this.velo = new Float32Array(count * 2);
        // Life: [life, maxLife] × N
        this.life = new Float32Array(count * 2);

        this._spawnAll();
    }

    /** Spawn particle at index i */
    _spawn(i) {
        const fo = i * FLOATS_PER_PARTICLE;
        const lo = i * 2;
        const vo = i * 2;

        // Emission within radius (circular area)
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * this.emissionRadius;
        this.flat[fo] = Math.cos(angle) * dist;       // x
        this.flat[fo + 1] = Math.sin(angle) * dist;    // y
        this.velo[vo] = (Math.random() - 0.5) * 0.005;
        this.velo[vo + 1] = (Math.random() - 0.5) * 0.005;
        this.life[lo] = this.life[lo + 1] = 300 + Math.random() * 500;
        this.flat[fo + 2] = 0.5 + Math.random() * 1.5; // size

        // Color from weighted palette
        if (this.palette.length) {
            const hex = this.palette[Math.floor(Math.random() * this.palette.length)];
            this.flat[fo + 3] = parseInt(hex.substring(1, 3), 16) / 255;
            this.flat[fo + 4] = parseInt(hex.substring(3, 5), 16) / 255;
            this.flat[fo + 5] = parseInt(hex.substring(5, 7), 16) / 255;
        }
        this.flat[fo + 6] = 1.0; // alpha (full opacity on spawn)
        this.flat[fo + 7] = Math.floor(Math.random() * this.shapeCount);
    }

    /** Initialize all particles */
    _spawnAll() {
        for (let i = 0; i < this.count; i++) this._spawn(i);
    }

    /**
     * Update all particles for one frame.
     *
     * Per particle:
     *   1. Age — if life ≤ 0, respawn
     *   2. V_noise = Perlin fluid flow + White jitter
     *   3. P_new = P_old + V_noise × Δt
     *   4. Vignette alpha = 1 - (dist / emissionRadius)
     *   5. Culling: if dist > viewport or alpha ≤ 0 → respawn
     *
     * @param {number} time — frame counter for noise animation
     * @returns {Float32Array} — this.flat (same reference, zero GC)
     */
    update(time) {
        const { flat, velo, life, noiseConfig } = this;
        const { radius, falloff } = this;
        const viewportLimit = 1.5; // beyond this → cull

        // Pre-read noise params for speed
        const pOpts = noiseConfig.providers?.perlin || {};
        const wAmp = noiseConfig.providers?.white?.amplitude ?? 1.0;

        for (let i = 0; i < this.count; i++) {
            const fo = i * FLOATS_PER_PARTICLE;
            const lo = i * 2;
            const vo = i * 2;

            // 1. Age
            life[lo] -= 1;
            if (life[lo] <= 0) { this._spawn(i); continue; }

            const px = flat[fo];
            const py = flat[fo + 1];

            // 2a. Perlin fluid flow
            const [fx, fy] = sampleFlow(px, py, time, pOpts);
            const flowMag = 0.004;

            // 2b. White noise Brownian jitter
            const jAmp = wAmp * 0.002;
            const [jx, jy] = sampleJitter(px, py, time, jAmp);

            // 3. Combine: P_new = P_old + (V_noise × Δt) + jitter
            velo[vo] += fx * flowMag * 1 + jx;
            velo[vo + 1] += fy * flowMag * 1 + jy;

            // Damping for stability
            velo[vo] *= 0.98;
            velo[vo + 1] *= 0.98;

            flat[fo] += velo[vo];
            flat[fo + 1] += velo[vo + 1];

            // 4. Vignette alpha: fade from center outward
            const d = Math.sqrt(flat[fo] * flat[fo] + flat[fo + 1] * flat[fo + 1]);
            const alpha = Math.max(0, Math.min(1, 1 - (d / radius) * falloff));
            flat[fo + 6] = alpha;

            // 5. Culling: recycle if outside viewport or invisible
            if (d > viewportLimit || alpha <= 0) {
                this._spawn(i);
            }
        }

        return flat;
    }
}

export { ParticleSystem, FLOATS_PER_PARTICLE };