/**
 * Particle/ShapeFactory — produces pure geometry data for particle shapes.
 *
 * Returns a GeometryObject: { vertices: Float32Array, indices: Uint16Array }
 * The WebGLRenderer handles uploading this data to the GPU.
 * No rendering logic, no WebGL references.
 */

/** @typedef {{ vertices: Float32Array, indices: Uint16Array }} GeometryObject */

const circle = (segments = 24) => {
    const pos = [[0, 0]];
    for (let i = 0; i <= segments; i++) {
        const a = (i / segments) * Math.PI * 2;
        pos.push([Math.cos(a), Math.sin(a)]);
    }
    const verts = new Float32Array(pos.length * 2);
    for (let i = 0; i < pos.length; i++) {
        verts[i * 2] = pos[i][0];
        verts[i * 2 + 1] = pos[i][1];
    }
    const idx = [];
    for (let i = 1; i <= segments; i++) idx.push(0, i, i + 1);
    return { vertices: verts, indices: new Uint16Array(idx) };
};

const triangle = () => {
    const verts = new Float32Array([0, 1, -0.866, -0.5, 0.866, -0.5]);
    return { vertices: verts, indices: new Uint16Array([0, 1, 2]) };
};

const square = () => {
    const verts = new Float32Array([-1, -1, 1, -1, 1, 1, -1, 1]);
    return { vertices: verts, indices: new Uint16Array([0, 1, 2, 0, 2, 3]) };
};

const registry = { circle, triangle, square };

const resolve = (name) => (registry[name] || circle)();

const names = () => Object.keys(registry);

export { circle, triangle, square, resolve, names };