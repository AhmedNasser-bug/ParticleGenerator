/**
 * Core/utils/WebGLUtils.js — stateless WebGL helper functions.
 * Extracted from Renderer to reduce its cyclomatic complexity.
 * All functions are pure: (gl, ...args) → result, no shared state.
 */

/** Compile a GLSL shader. Throws on failure. */
export const compileShader = (gl, type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        const log = gl.getShaderInfoLog(s);
        gl.deleteShader(s);
        throw new Error(`Shader compile: ${log}`);
    }
    return s;
};

/** Link vertex + fragment shaders into a program. Throws on failure. */
export const linkProgram = (gl, vs, fs) => {
    const p = gl.createProgram();
    gl.attachShader(p, vs);
    gl.attachShader(p, fs);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS))
        throw new Error('Program link: ' + gl.getProgramInfoLog(p));
    return p;
};

/** Upload static vertex + index geometry to GPU. Returns buffer handles. */
export const uploadStaticGeo = (gl, geo) => {
    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, geo.vertices, gl.STATIC_DRAW);
    const ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, geo.indices, gl.STATIC_DRAW);
    return { vbo, ibo, indexCount: geo.indices.length, stride: 2 * 4 };
};

/** Enable and bind a per-instance (divisor=1) float attribute. */
export const bindInstAttr = (gl, loc, size, stride, offset) => {
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride, offset);
    gl.vertexAttribDivisor(loc, 1);
};
