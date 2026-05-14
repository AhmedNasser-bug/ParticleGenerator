/**
 * GL/Shaders — GLSL 300 ES source strings for instanced particle rendering.
 *
 * Vertex shader uses per-instance attributes (divisor=1) streamed from the
 * instance VBO in WebGLRenderer. No per-particle uniform uploads needed.
 *
 * Instance buffer layout (INST_FLOATS = 7, stride = 28 bytes):
 *   offset  0 : a_translate.x  (float)
 *   offset  4 : a_translate.y  (float)
 *   offset  8 : a_scale        (float)
 *   offset 12 : a_color.r      (float)
 *   offset 16 : a_color.g      (float)
 *   offset 20 : a_color.b      (float)
 *   offset 24 : a_color.a      (float)
 *
 * Global uniform: u_glow (float) — glow intensity, same for all particles.
 */
const VERTEX = `#version 300 es
in vec2 a_position;   // per-vertex geometry (divisor 0)
in vec2 a_translate;  // per-instance world position (divisor 1)
in float a_scale;     // per-instance uniform scale (divisor 1)
in vec4 a_color;      // per-instance RGBA (divisor 1)

out vec2 v_pos;
out vec4 v_color;

void main() {
    vec2 pos = a_position * a_scale + a_translate;
    gl_Position = vec4(pos, 0.0, 1.0);
    v_pos = a_position;
    v_color = a_color;
}
`;

const FRAGMENT = `#version 300 es
precision highp float;
in vec2 v_pos;
in vec4 v_color;
uniform float u_glow;
out vec4 fragColor;
void main() {
    float d = length(v_pos);
    float glow = u_glow * exp(-d * d * 8.0);
    fragColor = vec4(v_color.rgb + glow * v_color.rgb, v_color.a);
}
`;

export { VERTEX, FRAGMENT };