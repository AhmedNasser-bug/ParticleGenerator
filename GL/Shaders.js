/**
 * GL/Shaders — GLSL source strings.
 *
 * Vertex shader: projects position, passes color + alpha.
 * Fragment shader: applies distance-based glow when u_glowIntensity > 0.
 *
 * Glow formula:
 *   fragColor.rgb += glowIntensity * exp(-dist² * 8) * color.rgb
 *   This creates a soft luminous halo around each particle.
 */
const VERTEX = `#version 300 es
in vec2 a_position;
in vec4 a_color;
uniform vec4 u_projection;
uniform vec2 u_translate;
uniform float u_scale;
out vec4 v_color;
out vec2 v_pos;
void main() {
    vec2 pos = a_position * u_scale + u_translate;
    vec2 clip = vec2(pos.x * u_projection.x + u_projection.z, pos.y * u_projection.y + u_projection.w);
    gl_Position = vec4(clip, 0.0, 1.0);
    v_color = a_color;
    v_pos = a_position;
}
`;

const FRAGMENT = `#version 300 es
precision highp float;
in vec4 v_color;
in vec2 v_pos;
uniform float u_glow;
out vec4 fragColor;
void main() {
    vec4 c = v_color;
    // Glow: luminous halo based on distance from particle center
    float d = length(v_pos);
    float glow = u_glow * exp(-d * d * 8.0);
    fragColor = vec4(c.rgb + glow * c.rgb, c.a);
}
`;

export { VERTEX, FRAGMENT };