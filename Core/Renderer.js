/**
 * Core/Renderer.js — CORE TIER. Owns every gl.* call in the application.
 *
 * Communicates exclusively through CommandQueue. No particle logic lives here.
 *
 * API:
 *   renderer.init(parentEl, shapeGeos)
 *   renderer.execute(queue)          ← consumes CommandQueue.drain()
 *   renderer.resize()
 *   renderer.destroy()
 *
 * Instance buffer layout (INST_FLOATS=7, stride=28 bytes):
 *   [0] tx  [1] ty  [2] scale  [3] r  [4] g  [5] b  [6] alpha
 */

import { Cmd } from './CommandQueue.js';
import { VERTEX, FRAGMENT } from './Shaders.js';

const INST_FLOATS = 7;

class Renderer {
    constructor() {
        this.canvas = null;
        this.gl     = null;
        this._prog  = null;
        this._loc   = {};
        this._geo   = [];        // { vbo, ibo, indexCount, stride }
        this._ivbo  = [];        // per-shape dynamic instance VBOs
    }

    // ── Lifecycle ──────────────────────────────────────────────────────────

    init(parentEl, shapeGeos) {
        this.canvas = document.createElement('canvas');
        Object.assign(this.canvas.style, {
            position: 'absolute', top: '0', left: '0',
            width: '100%', height: '100%',
            pointerEvents: 'none', zIndex: '1',
        });
        const w = Math.max(parentEl.offsetWidth  || window.innerWidth,  1);
        const h = Math.max(parentEl.offsetHeight || window.innerHeight, 1);
        this.canvas.width  = w;
        this.canvas.height = h;
        this.canvas.dataset.particleCanvas = 'true';
        parentEl.style.position = 'relative';
        parentEl.appendChild(this.canvas);

        const gl = this.canvas.getContext('webgl2', {
            antialias: false, alpha: true, premultipliedAlpha: false,
            preserveDrawingBuffer: false,
            powerPreference: 'high-performance', desynchronized: true,
        });
        if (!gl) throw new Error('WebGL2 unavailable');

        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.disable(gl.DEPTH_TEST);
        gl.disable(gl.CULL_FACE);
        gl.viewport(0, 0, w, h);
        this.gl = gl;

        this._prog = this._link(this._compile(gl.VERTEX_SHADER, VERTEX),
                                this._compile(gl.FRAGMENT_SHADER, FRAGMENT));
        gl.useProgram(this._prog);

        this._loc = {
            aPos:   gl.getAttribLocation(this._prog, 'a_position'),
            aTrans: gl.getAttribLocation(this._prog, 'a_translate'),
            aScale: gl.getAttribLocation(this._prog, 'a_scale'),
            aColor: gl.getAttribLocation(this._prog, 'a_color'),
            uGlow:  gl.getUniformLocation(this._prog, 'u_glow'),
        };

        // Upload static geometry + create dynamic instance VBOs
        this._geo  = shapeGeos.map((geo) => this._uploadGeo(geo));
        this._ivbo = shapeGeos.map(() => {
            const buf = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, buf);
            gl.bufferData(gl.ARRAY_BUFFER, 5000 * INST_FLOATS * 4, gl.DYNAMIC_DRAW);
            return buf;
        });
    }

    resize() {
        if (!this.canvas || !this.gl) return;
        const p = this.canvas.parentElement;
        if (!p) return;
        const w = Math.max(p.offsetWidth  || window.innerWidth,  1);
        const h = Math.max(p.offsetHeight || window.innerHeight, 1);
        this.canvas.width  = w;
        this.canvas.height = h;
        this.gl.viewport(0, 0, w, h);
    }

    destroy() {
        const gl = this.gl;
        if (gl) {
            if (this._prog) gl.deleteProgram(this._prog);
            for (const g of this._geo)  { gl.deleteBuffer(g.vbo); gl.deleteBuffer(g.ibo); }
            for (const b of this._ivbo) gl.deleteBuffer(b);
        }
        if (this.canvas?.parentElement) this.canvas.parentElement.removeChild(this.canvas);
        this.gl = this.canvas = null;
        this._geo = []; this._ivbo = [];
    }

    // ── Command Execution ──────────────────────────────────────────────────

    /**
     * Execute all commands from a CommandQueue.
     * This is the ONLY method that issues gl.* draw calls.
     *
     * @param {CommandQueue} queue
     */
    execute(queue) {
        const gl   = this.gl;
        const cmds = queue.drain();
        const { aPos, aTrans, aScale, aColor, uGlow } = this._loc;
        const instStride = INST_FLOATS * 4;

        for (let c = 0; c < cmds.length; c++) {
            const cmd = cmds[c];
            switch (cmd.type) {

                case Cmd.CLEAR:
                    gl.clearColor(0, 0, 0, 0);
                    gl.clear(gl.COLOR_BUFFER_BIT);
                    break;

                case Cmd.SET_GLOW:
                    gl.uniform1f(uGlow, cmd.intensity);
                    break;

                case Cmd.DRAW_INSTANCES: {
                    const geo   = this._geo[cmd.shapeIdx];
                    const ivbo  = this._ivbo[cmd.shapeIdx];
                    const count = cmd.count;
                    if (!geo || count === 0) break;

                    // Stream instance data
                    gl.bindBuffer(gl.ARRAY_BUFFER, ivbo);
                    gl.bufferSubData(gl.ARRAY_BUFFER, 0,
                        cmd.instanceBuffer.subarray(0, count * INST_FLOATS));

                    // Geometry (per-vertex, divisor 0)
                    gl.bindBuffer(gl.ARRAY_BUFFER,         geo.vbo);
                    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, geo.ibo);
                    gl.enableVertexAttribArray(aPos);
                    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, geo.stride, 0);
                    gl.vertexAttribDivisor(aPos, 0);

                    // Instance attributes (per-instance, divisor 1)
                    gl.bindBuffer(gl.ARRAY_BUFFER, ivbo);
                    this._instAttr(aTrans, 2, instStride,  0);
                    this._instAttr(aScale, 1, instStride,  8);
                    this._instAttr(aColor, 4, instStride, 12);

                    gl.drawElementsInstanced(
                        gl.TRIANGLES, geo.indexCount, gl.UNSIGNED_SHORT, 0, count);
                    break;
                }
            }
        }
    }

    // ── Private Helpers ────────────────────────────────────────────────────

    _instAttr(loc, size, stride, offset) {
        this.gl.enableVertexAttribArray(loc);
        this.gl.vertexAttribPointer(loc, size, this.gl.FLOAT, false, stride, offset);
        this.gl.vertexAttribDivisor(loc, 1);
    }

    _uploadGeo(geo) {
        const gl = this.gl;
        const vbo = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
        gl.bufferData(gl.ARRAY_BUFFER, geo.vertices, gl.STATIC_DRAW);
        const ibo = gl.createBuffer();
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, geo.indices, gl.STATIC_DRAW);
        return { vbo, ibo, indexCount: geo.indices.length, stride: 2 * 4 };
    }

    _compile(type, src) {
        const gl = this.gl;
        const s  = gl.createShader(type);
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
            const log = gl.getShaderInfoLog(s);
            gl.deleteShader(s);
            throw new Error(`Shader compile: ${log}`);
        }
        return s;
    }

    _link(vs, fs) {
        const gl   = this.gl;
        const prog = gl.createProgram();
        gl.attachShader(prog, vs);
        gl.attachShader(prog, fs);
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS))
            throw new Error('Program link: ' + gl.getProgramInfoLog(prog));
        return prog;
    }
}

export { Renderer };
