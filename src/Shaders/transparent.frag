#version 330 core

out vec4 FragColor;

uniform sampler2D iBackground;
uniform vec3 iResolution;
uniform float iTime;
uniform vec4 iMouse;
uniform int iFrame;

// SDF: distance to a sphere
float sphereSDF(vec3 p, vec3 center, float radius) {
    return length(p - center) - radius;
}

// Estimate normal from SDF
vec3 estimateNormal(vec3 p) {
    float eps = 0.001;
    vec2 e = vec2(1.0, -1.0) * 0.5773; // tetrahedral
    return normalize(
        e.xyy * sphereSDF(p + e.xyy * eps, vec3(0, 0, 0), 1.0) +
        e.yyx * sphereSDF(p + e.yyx * eps, vec3(0, 0, 0), 1.0) +
        e.yxy * sphereSDF(p + e.yxy * eps, vec3(0, 0, 0), 1.0) +
        e.xxx * sphereSDF(p + e.xxx * eps, vec3(0, 0, 0), 1.0)
    );
}

// Refraction helper (simplified Snell's law)
vec3 refractRay(vec3 I, vec3 N, float eta) {
    float cosi = clamp(dot(-I, N), -1.0, 1.0);
    float cost2 = 1.0 - eta * eta * (1.0 - cosi * cosi);
    return cost2 < 0.0 ? vec3(0.0) : eta * I + (eta * cosi - sqrt(cost2)) * N;
}

void main() {
    vec2 uv = (gl_FragCoord.xy / iResolution.xy) * 2.0 - 1.0;
    uv.x *= iResolution.x / iResolution.y;

    vec3 camPos = vec3(0.0, 0.0, 2.5);
    vec3 rayDir = normalize(vec3(uv, -1.0));

    // Raymarching
    float t = 0.0;
    float dist;
    vec3 pos;
    bool hit = false;
    for (int i = 0; i < 128; ++i) {
        pos = camPos + rayDir * t;
        dist = sphereSDF(pos, vec3(0.0), 1.0);
        if (dist < 0.001) {
            hit = true;
            break;
        }
        t += dist;
        if (t > 10.0) break;
    }

    vec3 color;

    if (hit) {
        // Background color at current screen location
        vec3 bg = texture(iBackground, gl_FragCoord.xy / iResolution.xy).rgb;

        // Compute normal
        vec3 normal = estimateNormal(pos);

        // Refract ray
        float eta = 1.0 / 1.1; // air to glass-ish
        vec3 refractedDir = refractRay(rayDir, normal, eta);

        // Background sample at refracted position (simplified)
        vec3 refractPos = pos + refractedDir * 2.5;
        vec2 refractUV = refractPos.xy * 0.5 + 0.5;
        refractUV.x *= iResolution.y / iResolution.x; // undo aspect

        vec3 refractedColor = texture(iBackground, refractUV).rgb;

        // Blend refraction with background (like transparency)
        float alpha = 0.9;
        vec3 tinted = mix(refractedColor, vec3(0.2, 0.5, 1.0), 1.0 - alpha); // bluish tint
        color = mix(bg, tinted, alpha);
    } else {
        color = texture(iBackground, gl_FragCoord.xy / iResolution.xy).rgb;
    }

    FragColor = vec4(color, 1.0);
}
