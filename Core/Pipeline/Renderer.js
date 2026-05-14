/** Core/Pipeline/Renderer.js — CORE TIER. All gl.* calls. Consumes CommandQueue. */
import { Cmd }                                          from './CommandQueue.js';
import { VERTEX, FRAGMENT }                             from './Shaders.js';
import { compileShader, linkProgram, uploadStaticGeo, bindInstAttr } from '../utils/WebGLUtils.js';

const INST_FLOATS = 7; // tx, ty, scale, r, g, b, alpha

class Renderer {
    constructor() {
        this.canvas = null; this.gl = null; this._prog = null;
        this._loc = {}; this._geo = []; this._ivbo = [];
    }

    init(parentEl, shapeGeos) {
        this.canvas = document.createElement('canvas');
        Object.assign(this.canvas.style, {
            position:'absolute', top:'0', left:'0',
            width:'100%', height:'100%', pointerEvents:'none', zIndex:'1',
        });
        const w = Math.max(parentEl.offsetWidth  || window.innerWidth,  1);
        const h = Math.max(parentEl.offsetHeight || window.innerHeight, 1);
        this.canvas.width = w; this.canvas.height = h;
        this.canvas.dataset.particleCanvas = 'true';
        parentEl.style.position = 'relative';
        parentEl.appendChild(this.canvas);

        const gl = this.canvas.getContext('webgl2', {
            antialias:false, alpha:true, premultipliedAlpha:false,
            preserveDrawingBuffer:false, powerPreference:'high-performance', desynchronized:true,
        });
        if (!gl) throw new Error('WebGL2 unavailable');
        gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
        gl.disable(gl.DEPTH_TEST); gl.disable(gl.CULL_FACE);
        gl.viewport(0, 0, w, h);
        this.gl = gl;

        this._prog = linkProgram(gl, compileShader(gl, gl.VERTEX_SHADER, VERTEX),
                                     compileShader(gl, gl.FRAGMENT_SHADER, FRAGMENT));
        gl.useProgram(this._prog);

        this._loc = {
            aPos:   gl.getAttribLocation(this._prog, 'a_position'),
            aTrans: gl.getAttribLocation(this._prog, 'a_translate'),
            aScale: gl.getAttribLocation(this._prog, 'a_scale'),
            aColor: gl.getAttribLocation(this._prog, 'a_color'),
            uGlow:  gl.getUniformLocation(this._prog, 'u_glow'),
        };

        this._geo  = shapeGeos.map((geo) => uploadStaticGeo(gl, geo));
        this._ivbo = shapeGeos.map(() => {
            const buf = gl.createBuffer();
            gl.bindBuffer(gl.ARRAY_BUFFER, buf);
            gl.bufferData(gl.ARRAY_BUFFER, 5000 * INST_FLOATS * 4, gl.DYNAMIC_DRAW);
            return buf;
        });
    }

    execute(queue) {
        const gl = this.gl;
        const { aPos, aTrans, aScale, aColor, uGlow } = this._loc;
        const instStride = INST_FLOATS * 4;

        for (const cmd of queue.drain()) {
            switch (cmd.type) {
                case Cmd.CLEAR:
                    gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT); break;
                case Cmd.SET_GLOW:
                    gl.uniform1f(uGlow, cmd.intensity); break;
                case Cmd.DRAW_INSTANCES: {
                    const geo = this._geo[cmd.shapeIdx], ivbo = this._ivbo[cmd.shapeIdx];
                    if (!geo || cmd.count === 0) break;
                    gl.bindBuffer(gl.ARRAY_BUFFER, ivbo);
                    gl.bufferSubData(gl.ARRAY_BUFFER, 0,
                        cmd.instanceBuffer.subarray(0, cmd.count * INST_FLOATS));
                    gl.bindBuffer(gl.ARRAY_BUFFER, geo.vbo);
                    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, geo.ibo);
                    gl.enableVertexAttribArray(aPos);
                    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, geo.stride, 0);
                    gl.vertexAttribDivisor(aPos, 0);
                    gl.bindBuffer(gl.ARRAY_BUFFER, ivbo);
                    bindInstAttr(gl, aTrans, 2, instStride,  0);
                    bindInstAttr(gl, aScale, 1, instStride,  8);
                    bindInstAttr(gl, aColor, 4, instStride, 12);
                    gl.drawElementsInstanced(gl.TRIANGLES, geo.indexCount, gl.UNSIGNED_SHORT, 0, cmd.count);
                    break;
                }
            }
        }
    }

    resize() {
        if (!this.canvas || !this.gl) return;
        const p = this.canvas.parentElement; if (!p) return;
        const w = Math.max(p.offsetWidth || window.innerWidth, 1);
        const h = Math.max(p.offsetHeight || window.innerHeight, 1);
        this.canvas.width = w; this.canvas.height = h;
        this.gl.viewport(0, 0, w, h);
    }

    destroy() {
        const gl = this.gl;
        if (gl) {
            if (this._prog) gl.deleteProgram(this._prog);
            for (const g of this._geo) { gl.deleteBuffer(g.vbo); gl.deleteBuffer(g.ibo); }
            for (const b of this._ivbo) gl.deleteBuffer(b);
        }
        this.canvas?.parentElement?.removeChild(this.canvas);
        this.gl = this.canvas = null; this._geo = []; this._ivbo = [];
    }
}

export { Renderer };
