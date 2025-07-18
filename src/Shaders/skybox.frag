#version 330 core
out vec4 FragColor;

uniform sampler2D iSkybox;
uniform vec3 iResolution;
uniform vec4 iMouse;  // x = mouseX, y = mouseY

// Converts screen UV + mouse control into ray direction
vec3 getCameraRay(vec2 fragUV, vec2 mouseUV) {
    // NDC: [-1, 1] with correct aspect ratio
    vec2 ndc = fragUV * 2.0 - 1.0;
    ndc.x *= iResolution.x / iResolution.y;
    vec3 ray = normalize(vec3(ndc, -1.0));

    // Map mouse to yaw (horizontal) and pitch (vertical)
    float yaw   = (mouseUV.x / iResolution.x - 0.5) * 2.0 * 3.141592; // -π to π
    float pitch = (mouseUV.y / iResolution.y - 0.5) * 3.141592;       // -π/2 to π/2

    // Yaw around Y-axis
    mat3 rotY = mat3(
         cos(yaw), 0.0, -sin(yaw),
         0.0,      1.0,  0.0,
         sin(yaw), 0.0,  cos(yaw)
    );

    // Pitch around X-axis
    mat3 rotX = mat3(
        1.0, 0.0,        0.0,
        0.0, cos(pitch), sin(pitch),
        0.0, -sin(pitch), cos(pitch)
    );

    return rotY * rotX * ray;
}

// Uses your provided correct horizontal cross layout
vec2 cubeUV(vec3 dir) {
    vec3 a = abs(dir);
    float ma;
    vec2 uv;
    vec2 offset;

    if (a.x > a.y && a.x > a.z) {
        ma = a.x;
        if (dir.x >= 0.0) {
            offset = vec2(2.0, 1.0);
            uv = vec2(dir.z, dir.y) / ma;
        } else {
            offset = vec2(0.0, 1.0);
            uv = vec2(-dir.z, dir.y) / ma;
        }
    } else if (a.y >= a.x && a.y >= a.z) {
        ma = a.y;
        if (dir.y > 0.0) {
            offset = vec2(1.0, 2.0);
            uv = vec2(dir.x, dir.z) / ma;
        } else {
            offset = vec2(1.0, 0.0);
            uv = vec2(dir.x, -dir.z) / ma;
        }
    } else {
        ma = a.z;
        if (dir.z > 0.0) {
            offset = vec2(3.0, 1.0);
            uv = vec2(-dir.x, dir.y) / ma;
        } else {
            offset = vec2(1.0, 1.0);
            uv = vec2(dir.x, dir.y) / ma;
        }
    }

    uv = 0.5 * (uv + 1.0);

    // This line causes white lines at the edges:
    //uv = (uv + offset) / vec2(4.0, 3.0);

    // It can be fixed by these:
    vec2 tileSize = vec2(1.0 / 4.0, 1.0 / 3.0);
    uv = clamp(uv, 0.001, 0.999); // stay away from face edges
    uv = uv * tileSize + offset * tileSize;

    return uv; // prevent sampling errors at seams
}

void main() {
    vec2 fragUV = gl_FragCoord.xy / iResolution.xy;
    vec2 mouseUV = iMouse.xy;

    vec3 rayDir = getCameraRay(fragUV, mouseUV);
    vec2 uv = cubeUV(rayDir);
    vec3 color = texture(iSkybox, uv).rgb;

    FragColor = vec4(color, 1.0);
}
