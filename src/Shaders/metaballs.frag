#version 330 core

out vec4 FragColor;
in vec2 fragCoord;

// Uniforms
uniform float iTime;
uniform vec3 iResolution;

// Signed Distance Function for a sphere
float sphereSDF(vec3 p, vec3 center, float radius) {
    return length(p - center) - radius;
}

// Soft blending for multiple SDFs (metaball effect)
float smoothMin(float a, float b, float k) {
    float h = clamp(0.5 + 0.5 * (b - a) / k, 0.0, 1.0);
    return mix(b, a, h) - k * h * (1.0 - h);
}

// Blob SDF composed of multiple spheres
float blobSDF(vec3 p) {
    vec3 c1 = vec3(sin(iTime), cos(iTime), sin(iTime * 0.3)) * 0.5;
    vec3 c2 = vec3(cos(iTime * 1.2), sin(iTime * 0.8), cos(iTime * 0.5)) * 0.5;
    vec3 c3 = vec3(sin(iTime * 0.7), cos(iTime * 1.3), sin(iTime * 0.4)) * 0.5;

    float s1 = sphereSDF(p, c1, 0.4);
    float s2 = sphereSDF(p, c2, 0.4);
    float s3 = sphereSDF(p, c3, 0.4);

    float sm = smoothMin(s1, s2, 0.4);
    sm = smoothMin(sm, s3, 0.4);

    return sm;
}

// Raymarching
float raymarch(vec3 ro, vec3 rd) {
    float t = 0.0;
    for (int i = 0; i < 100; i++) {
        vec3 p = ro + rd * t;
        float d = blobSDF(p);
        if (d < 0.001) break;
        t += d * 0.5;
        if (t > 10.0) break;
    }
    return t;
}

// Estimate normal via gradient
vec3 getNormal(vec3 p) {
    float eps = 0.001;
    vec2 h = vec2(eps, 0.0);
    float dx = blobSDF(p + h.xyy) - blobSDF(p - h.xyy);
    float dy = blobSDF(p + h.yxy) - blobSDF(p - h.yxy);
    float dz = blobSDF(p + h.yyx) - blobSDF(p - h.yyx);
    return normalize(vec3(dx, dy, dz));
}

// Basic lighting
vec4 shade(vec3 p, vec3 rd) {
    vec3 normal = getNormal(p);
    vec3 lightDir = normalize(vec3(0.5, 1.0, 0.8));
    float diff = max(dot(normal, lightDir), 0.0);
    float spec = pow(max(dot(reflect(-lightDir, normal), -rd), 0.0), 32.0);

    // Color and alpha
    vec3 baseColor = vec3(0.2, 0.8, 1.0); // watery-blue
    float alpha = 0.25 + 0.25 * diff;     // More transparent in shadows

    vec3 color = baseColor * diff + vec3(1.0) * spec;
    return vec4(color, 0.3);
}

// Main
void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;
    
    // Camera
    vec3 ro = vec3(0.0, 0.0, 3.0);
    vec3 rd = normalize(vec3(uv, -1.5));

    // Raymarching
    float t = raymarch(ro, rd);
    if (t < 10.0) {
        vec3 p = ro + rd * t;
        FragColor = shade(p, rd); // returns vec4 with alpha
    } else {
        // Gradient from bottom to top
        float t = fragCoord.y / iResolution.y;
        vec3 sky = mix(vec3(0.1, 0.1, 0.2), vec3(1.0, 0.7, 0.2), t); // dark blue to sky blue
        FragColor = vec4(sky, 1.0);
    }
}
