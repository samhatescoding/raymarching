#version 330 core
out vec4 FragColor;

uniform sampler2D iSkybox;
uniform vec3 iResolution;
uniform vec4 iMouse;
uniform float iTime;
uniform int iFrame;

// ---------- Camera Utilities ----------
vec3 getCameraRay(vec2 fragUV, vec2 mouseUV) {
    vec2 ndc = fragUV * 2.0 - 1.0;
    ndc.x *= iResolution.x / iResolution.y;
    vec3 ray = normalize(vec3(ndc, -1.0));

    float yaw   = (mouseUV.x / iResolution.x - 0.5) * 2.0 * 3.141592;
    float pitch = (mouseUV.y / iResolution.y - 0.5) * 3.141592;

    mat3 rotY = mat3(
         cos(yaw), 0.0, -sin(yaw),
         0.0,      1.0,  0.0,
         sin(yaw), 0.0,  cos(yaw)
    );

    mat3 rotX = mat3(
        1.0, 0.0,        0.0,
        0.0, cos(pitch), sin(pitch),
        0.0, -sin(pitch), cos(pitch)
    );

    return rotY * rotX * ray;
}

// ---------- Skybox Sampler ----------
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

    return clamp(uv, 0.001, 0.999); // prevent sampling errors at seams
}

vec3 sampleSkybox(vec3 dir) {
    return texture(iSkybox, cubeUV(dir)).rgb;
}

// ---------- Transparent Sphere ----------
float sphereSDF(vec3 p, vec3 center, float radius) {
    return length(p - center) - radius;
}

vec3 estimateNormal(vec3 p) {
    float eps = 0.001;
    vec2 e = vec2(1.0, -1.0) * 0.5773;
    return normalize(
        e.xyy * sphereSDF(p + e.xyy * eps, vec3(0, 0, 0), 1.0) +
        e.yyx * sphereSDF(p + e.yyx * eps, vec3(0, 0, 0), 1.0) +
        e.yxy * sphereSDF(p + e.yxy * eps, vec3(0, 0, 0), 1.0) +
        e.xxx * sphereSDF(p + e.xxx * eps, vec3(0, 0, 0), 1.0)
    );
}

vec3 refractRay(vec3 I, vec3 N, float eta) {
    float cosi = clamp(dot(-I, N), -1.0, 1.0);
    float cost2 = 1.0 - eta * eta * (1.0 - cosi * cosi);
    return cost2 < 0.0 ? vec3(0.0) : eta * I + (eta * cosi - sqrt(cost2)) * N;
}

// ---------- Main ----------
void main() {
    vec2 fragUV = gl_FragCoord.xy / iResolution.xy;
    vec2 mouseUV = iMouse.xy;

    vec3 camPos = vec3(0.0, 0.0, 2.5);
    vec3 rayDir = getCameraRay(fragUV, mouseUV);

    // Raymarching to detect sphere
    float t = 0.0;
    bool hit = false;
    vec3 pos;
    for (int i = 0; i < 128; ++i) {
        pos = camPos + rayDir * t;
        float d = sphereSDF(pos, vec3(0), 1.0);
        if (d < 0.001) {
            hit = true;
            break;
        }
        t += d;
        if (t > 10.0) break;
    }

    vec3 color;
    vec3 bg = sampleSkybox(rayDir);

    if (hit) {
        vec3 normal = estimateNormal(pos);
        vec3 refracted = refractRay(rayDir, normal, 1.0 / 1.1);
        vec3 refractedColor = sampleSkybox(refracted);

        // Blue tint blend
        float alpha = 0.7;
        vec3 blueTinted = mix(refractedColor, vec3(0.2, 0.5, 1.0), 1.0 - alpha);
        color = mix(bg, blueTinted, alpha);
    } else {
        color = bg;
    }

    FragColor = vec4(color, 1.0);
}
