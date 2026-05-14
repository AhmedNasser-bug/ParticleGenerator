/**
 * Core/CommandQueue.js — abstract GPU command list.
 *
 * Bridges the Logic tier (ParticleSystem) and the Core tier (Renderer).
 * The Renderer is the ONLY consumer of these commands; no gl.* calls
 * exist anywhere else in the codebase.
 *
 * Commands are plain objects — small fixed set per frame (O(shapes), not O(particles)).
 * GC cost is negligible at 3–5 commands/frame.
 *
 * VSM-GQM: every command is inspectable for audit/trace purposes.
 */

/** @enum {number} Command type discriminants */
const Cmd = Object.freeze({
    CLEAR:          0,
    SET_GLOW:       1,
    DRAW_INSTANCES: 2,
});

class CommandQueue {
    constructor() {
        this._cmds = [];
    }

    /**
     * Reset and open a new frame.
     * Must be called before any other enqueue method.
     * @param {number} glowIntensity
     * @returns {CommandQueue} this (fluent)
     */
    begin(glowIntensity = 0) {
        this._cmds.length = 0; // reuse array, no realloc
        this._cmds.push({ type: Cmd.CLEAR });
        this._cmds.push({ type: Cmd.SET_GLOW, intensity: glowIntensity });
        return this;
    }

    /**
     * Enqueue one instanced draw batch for a shape.
     * instanceBuffer is a pre-allocated Float32Array slice (tx,ty,scale,r,g,b,alpha)×count.
     * The Renderer reads it directly — no copy.
     *
     * @param {number} shapeIdx
     * @param {Float32Array} instanceBuffer
     * @param {number} count — number of valid instances in buffer
     * @returns {CommandQueue} this (fluent)
     */
    addBatch(shapeIdx, instanceBuffer, count) {
        this._cmds.push({ type: Cmd.DRAW_INSTANCES, shapeIdx, instanceBuffer, count });
        return this;
    }

    /**
     * Returns the command list and resets internal state.
     * @returns {Array}
     */
    drain() {
        return this._cmds;
    }
}

export { CommandQueue, Cmd };
