#version 330 core

layout (location = 0) in vec2 aPos;
out vec2 fragCoord;

uniform vec3 iResolution;

void main() {
    fragCoord = (aPos + 1.0) * 0.5 * iResolution.xy;
    gl_Position = vec4(aPos, 0.0, 1.0);
}
