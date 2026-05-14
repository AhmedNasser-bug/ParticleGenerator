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
        // Use window dimensions — parentEl.offsetWidth is 0 before layout completes
        const w = window.innerWidth  || 1;
        const h = window.innerHeight || 1;
        this.canvas.width = w; this.canvas.height = h;
        this.canvas.dataset.particleCanvas = 'true';
        parentEl.appendChild(this.canvas);
        // Keep canvas resolution in sync with actual layout
        this._ro = new ResizeObserver(() => this.resize());
        this._ro.observe(parentEl);

        const gl = this.canvas.getContext('webgl2', {
            antialias:false, alpha:true,
            preserveDrawingBuffer:false, powerPreference:'high-performance',
        });
        if (!gl) throw new Error('WebGL2 unavailable');
        gl.enable(gl.BLEND); gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
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

        this._vaos = shapeGeos.map((geo, i) => {
            const vao = gl.createVertexArray();
            gl.bindVertexArray(vao);
            
            gl.bindBuffer(gl.ARRAY_BUFFER, geo.vbo);
            gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, geo.ibo);
            gl.enableVertexAttribArray(this._loc.aPos);
            gl.vertexAttribPointer(this._loc.aPos, 2, gl.FLOAT, false, geo.stride, 0);
            gl.vertexAttribDivisor(this._loc.aPos, 0);

            gl.bindBuffer(gl.ARRAY_BUFFER, this._ivbo[i]);
            bindInstAttr(gl, this._loc.aTrans, 2, 28,  0);
            bindInstAttr(gl, this._loc.aScale, 1, 28,  8);
            bindInstAttr(gl, this._loc.aColor, 4, 28, 12);
            
            gl.bindVertexArray(null);
            return vao;
        });
    }

    execute(queue) {
        const gl = this.gl;
        const { uGlow } = this._loc;

        for (const cmd of queue.drain()) {
            switch (cmd.type) {
                case Cmd.CLEAR:
                    gl.clearColor(0,0,0,0); gl.clear(gl.COLOR_BUFFER_BIT); break;
                case Cmd.SET_GLOW:
                    gl.uniform1f(uGlow, cmd.intensity); break;
                case Cmd.DRAW_INSTANCES: {
                    const geo = this._geo[cmd.shapeIdx], ivbo = this._ivbo[cmd.shapeIdx], vao = this._vaos[cmd.shapeIdx];
                    if (!geo || cmd.count === 0) break;
                    
                    gl.bindBuffer(gl.ARRAY_BUFFER, ivbo);
                    const reqBytes = cmd.count * 28; // INST_FLOATS * 4
                    if (!ivbo._capacity || reqBytes > ivbo._capacity) {
                        const newCap = Math.max(reqBytes, (ivbo._capacity || 0) * 2, 5000 * 28);
                        gl.bufferData(gl.ARRAY_BUFFER, newCap, gl.DYNAMIC_DRAW);
                        ivbo._capacity = newCap;
                    }
                    gl.bufferSubData(gl.ARRAY_BUFFER, 0, cmd.instanceBuffer.subarray(0, cmd.count * 7)); // INST_FLOATS

                    gl.bindVertexArray(vao);
                    gl.drawElementsInstanced(gl.TRIANGLES, geo.indexCount, gl.UNSIGNED_SHORT, 0, cmd.count);
                    gl.bindVertexArray(null);
                    break;
                }
            }
        }
    }

    resize() {
        if (!this.canvas || !this.gl) return;
        const w = Math.max(window.innerWidth,  1);
        const h = Math.max(window.innerHeight, 1);
        if (this.canvas.width === w && this.canvas.height === h) return;
        this.canvas.width = w; this.canvas.height = h;
        this.gl.viewport(0, 0, w, h);
    }

    destroy() {
        this._ro?.disconnect();
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
