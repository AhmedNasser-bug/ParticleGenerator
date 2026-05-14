/**
 * Core/WebGLRenderer — single class that owns ALL WebGL state.
 *
 * API: .init(parentEl, shapeGeos, renderCfg) → .draw(flat, renderCfg) → .resize() → .destroy()
 *
 * flat: Float32Array of [x, y, size, r, g, b, alpha, shapeIdx] × N
 *
 * No gl.* calls leak outside this class.
 * All state transitions are contained within method calls.
 */

import { VERTEX, FRAGMENT } from '../GL/Shaders.js';

const FLOATS_PER = 8;

class WebGLRenderer {
    constructor() {
        this.canvas = null;
        this.gl = null;
        this.program = null;
        this.loc = {};
        this.geoBuffers = [];
    }

    init(parentEl, shapeGeos, renderCfg = {}) {
        this.canvas = document.createElement('canvas');
        Object.assign(this.canvas.style, {
            position: 'absolute', top: '0', left: '0',
            width: '100%', height: '100%',
            pointerEvents: 'none', zIndex: '1',
        });
        const w = parentEl.clientWidth || window.innerWidth;
        const h = parentEl.clientHeight || window.innerHeight;
        this.canvas.width = w;
        this.canvas.height = h;
        parentEl.style.position = 'relative';
        parentEl.appendChild(this.canvas);

        const gl = this.canvas.getContext('webgl2', {
            antialias: false, alpha: true, premultipliedAlpha: false,
            preserveDrawingBuffer: false, powerPreference: 'high-performance',
            desynchronized: true, failIfMajorPerformanceCaveat: true,
        });
        if (!gl) throw new Error('WebGL2 unavailable');
        gl.enable(gl.BLEND);
        gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.disable(gl.DEPTH_TEST);
        gl.disable(gl.CULL_FACE);
        this.gl = gl;

        const vs = this._compile(gl.VERTEX_SHADER, VERTEX);
        const fs = this._compile(gl.FRAGMENT_SHADER, FRAGMENT);
        const prog = gl.createProgram();
        gl.attachShader(prog, vs);
        gl.attachShader(prog, fs);
        gl.linkProgram(prog);
        if (!gl.getProgramParameter(prog, gl.LINK_STATUS))
            throw new Error('Program link: ' + gl.getProgramInfoLog(prog));
        gl.useProgram(prog);
        this.program = prog;

        this.loc = {
            aPos: gl.getAttribLocation(prog, 'a_position'),
            aCol: gl.getAttribLocation(prog, 'a_color'),
            uProj: gl.getUniformLocation(prog, 'u_projection'),
            uTrans: gl.getUniformLocation(prog, 'u_translate'),
            uScale: gl.getUniformLocation(prog, 'u_scale'),
            uGlow: gl.getUniformLocation(prog, 'u_glow'),
        };
        gl.enableVertexAttribArray(this.loc.aPos);
        gl.enableVertexAttribArray(this.loc.aCol);

        this.geoBuffers = shapeGeos.map((geo) => {
            const vbo = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
            gl.bufferData(gl.ARRAY_BUFFER, geo.vertices, gl.STATIC_DRAW);
            const ibo = gl.createBuffer();
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
            gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, geo.indices, gl.STATIC_DRAW);
            return { vbo, ibo, indexCount: geo.indices.length, stride: 2 * Float32Array.BYTES_PER_ELEMENT };
        });

        this._setProjection(w, h);
    }

    draw(flat, renderCfg = {}) {
        const gl = this.gl;
        const N = flat.length / FLOATS_PER;
        if (N === 0) return;

        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        // Set glow uniform once per frame
        const glowIntensity = renderCfg.glowIntensity || 0;
        gl.uniform1f(this.loc.uGlow, glowIntensity);

        const batches = {};
        for (let i = 0; i < N; i++) {
            const off = i * FLOATS_PER;
            const sIdx = flat[off + 7];
            if (!batches[sIdx])
                batches[sIdx] = { geo: this.geoBuffers[sIdx], instances: [] };
            batches[sIdx].instances.push({
                x: flat[off], y: flat[off + 1], size: flat[off + 2],
                r: flat[off + 3], g: flat[off + 4], b: flat[off + 5], alpha: flat[off + 6],
            });
        }

        const { aPos, aCol, uTrans, uScale } = this.loc;
        for (const key in batches) {
            const b = batches[key];
            gl.bindBuffer(gl.ARRAY_BUFFER, b.geo.vbo);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, b.geo.ibo);
            gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, b.geo.stride, 0);
            for (let i = 0; i < b.instances.length; i++) {
                const inst = b.instances[i];
                gl.uniform2f(uTrans, inst.x, inst.y);
                gl.uniform1f(uScale, inst.size * 0.02);
                gl.vertexAttrib4f(aCol, inst.r, inst.g, inst.b, inst.alpha);
                gl.drawElements(gl.TRIANGLES, b.geo.indexCount, gl.UNSIGNED_SHORT, 0);
            }
        }
    }

    resize() {
        if (!this.canvas || !this.gl) return;
        const p = this.canvas.parentElement;
        if (!p) return;
        const w = p.clientWidth || window.innerWidth;
        const h = p.clientHeight || window.innerHeight;
        this.canvas.width = w;
        this.canvas.height = h;
        this.gl.viewport(0, 0, w, h);
        this._setProjection(w, h);
    }

    destroy() {
        if (this.program && this.gl) this.gl.deleteProgram(this.program);
        for (const g of this.geoBuffers) {
            if (this.gl) { this.gl.deleteBuffer(g.vbo); this.gl.deleteBuffer(g.ibo); }
        }
        if (this.canvas && this.canvas.parentElement)
            this.canvas.parentElement.removeChild(this.canvas);
        this.gl = this.canvas = null;
    }

    _compile(type, src) {
        const s = this.gl.createShader(type);
        this.gl.shaderSource(s, src);
        this.gl.compileShader(s);
        if (!this.gl.getShaderParameter(s, this.gl.COMPILE_STATUS)) {
            const log = this.gl.getShaderInfoLog(s);
            this.gl.deleteShader(s);
            throw new Error(`Shader: ${log}`);
        }
        return s;
    }

    _setProjection(w, h) {
        const a = w / h;
        const arr = a > 1 ? [1 / a, 1, -1 / a, -1] : [1, 1 / a, -1, -1 / a];
        this.gl.uniform4f(this.loc.uProj, arr[0], arr[1], arr[2], arr[3]);
    }
}

export { WebGLRenderer };