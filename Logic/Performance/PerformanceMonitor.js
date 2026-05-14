/**
 * Core/PerformanceMonitor.js — rolling FPS measurement with throttle callback.
 *
 * Wires into the render loop via .tick(). When rolling average FPS drops
 * below `threshold`, fires `onThrottle(currentFps)` once per cooldown period
 * so the caller can reduce particle count or other load.
 *
 * Zero DOM/WebGL dependencies — pure timing utility.
 */
class PerformanceMonitor {
    /**
     * @param {object} opts
     * @param {number} [opts.threshold=30]      — FPS below which throttle fires
     * @param {number} [opts.windowSize=10]     — rolling average frame count
     * @param {number} [opts.cooldownMs=2000]   — minimum ms between throttle events
     * @param {Function} [opts.onThrottle]      — callback(currentFps: number)
     */
    constructor({ threshold = 30, windowSize = 10, cooldownMs = 2000, onThrottle } = {}) {
        this.threshold = threshold;
        this.windowSize = windowSize;
        this.cooldownMs = cooldownMs;
        this.onThrottle = onThrottle || (() => {});

        this._times = new Float64Array(windowSize);   // circular buffer of frame durations
        this._head = 0;
        this._filled = false;
        this._last = performance.now();
        this._lastThrottle = -Infinity;
    }

    /**
     * Call once per animation frame, before rendering.
     * Returns the current rolling-average FPS (or 0 until window is filled).
     * @returns {number}
     */
    tick() {
        const now = performance.now();
        const dt = now - this._last;
        this._last = now;

        this._times[this._head] = dt;
        this._head = (this._head + 1) % this.windowSize;
        if (this._head === 0) this._filled = true;

        if (!this._filled) return 0;

        let sum = 0;
        for (let i = 0; i < this.windowSize; i++) sum += this._times[i];
        const fps = 1000 / (sum / this.windowSize);

        if (fps < this.threshold && now - this._lastThrottle > this.cooldownMs) {
            this._lastThrottle = now;
            this.onThrottle(fps);
        }

        return fps;
    }

    /** Reset the rolling window (e.g., after a throttle-induced config change). */
    reset() {
        this._times.fill(0);
        this._head = 0;
        this._filled = false;
        this._lastThrottle = -Infinity;
        this._last = performance.now();
    }
}

export { PerformanceMonitor };
