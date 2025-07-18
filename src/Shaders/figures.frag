#version 330 core

out vec4 fragColor;

uniform vec3 iResolution; // viewport resolution (in pixels)
uniform float iTime;
uniform sampler2D iBackground;

vec3 lightPos = vec3(3.0, 5.0, 4.0);

// Signed distance function for a sphere centered at origin
float sdfSphere(vec3 p, vec3 c, float r) {
    return length(p - c) - r;
}

// Signed distance function for a box
float sdfBox(vec3 p, vec3 c, vec3 b) {
    vec3 d = abs(p - c) - b;
    return length(max(d, 0.0)) + min(max(d.x, max(d.y, d.z)), 0.0);
}

// Signed distance function for a torus
float sdfTorus(vec3 p, vec3 c, vec2 t)
{
    return length(vec2(length((p - c).xz)-t.x, (p-c).y)) - t.y;
}

// Signed distance function for a cone
float sdfCone(in vec3 p, in vec3 c, in vec2 rh)
{
    vec2 q = vec2(rh.x, -rh.y) / rh.y;
    vec2 w = vec2( length((p - c).xz), (p - c).y );
    
    vec2 a = w - q * clamp( dot(w, q) / dot(q,q), 0.0, 1.0 );
    vec2 b = w - q * vec2( clamp( w.x / q.x, 0.0, 1.0 ), 1.0 );
    float k = sign( q.y );
    float d = min(dot( a, a ), dot(b, b));
    float s = max( k * (w.x * q.y - w.y * q.x), k * (w.y - q.y) );
    return sqrt(d)*sign(s);
}

// Signed distance function for the plane
float sdfPlane(vec3 p)
{
    return p.y;
}

// Distance estimation function for the scene
vec2 map(vec3 p) {
    float d1 = sdfSphere(p, vec3(1, 0, 1), 0.5);
    float d2 = sdfBox(p, vec3(-1, 0, 1), vec3(0.5));
    float d3 = sdfTorus(p, vec3(1.0, 0, -1), vec2(0.5, 0.2));
    float d4 = sdfCone(p, vec3(-1.0, 0.5, -1.0), vec2(0.3, 0.5));
    float d5 = sdfPlane(p - vec3(0.0, -0.5, 0.0));
    float d = min(min(min(d1, d2), min(d3, d4)), d5);

    if (d == d1) return vec2(d, 1.0);
    else if (d == d2) return vec2(d, 2.0);
    else if (d == d3) return vec2(d, 3.0);
    else if (d == d4) return vec2(d, 4.0);
    else if (d == d5) return vec2(d, 5.0);
    else return vec2(d, -1.0);
}


// Normal estimation via central differences
vec3 getNormal(vec3 p) {
    float h = 0.001;

    // Sample positions slightly offset in different directions
    float dx = map(p + vec3(h, 0.0, 0.0)).x - map(p - vec3(h, 0.0, 0.0)).x;
    float dy = map(p + vec3(0.0, h, 0.0)).x - map(p - vec3(0.0, h, 0.0)).x;
    float dz = map(p + vec3(0.0, 0.0, h)).x - map(p - vec3(0.0, 0.0, h)).x;

    // Approximate gradient (i.e., surface normal)
    vec3 normal = vec3(dx, dy, dz);

    return normalize(normal);
}

// Raymarching loop
vec3 raymarch(vec3 ro, vec3 rd, out float material) {
    float t = 0.0;
    vec3 p = vec3(0.0);
    for (int i = 0; i < 100; ++i) {
        p = ro + t * rd;
        vec2 res = map(p);
        float d = res.x;
        material = res.y;
        if (d < 0.01) break;
        t += d;
        if (t > 10.0) {
            material = -1.0;
            return ro + t * rd;
        }
    }

    if (material == 5.0) {
        if(mod(mod(ceil(p.x), 2.0) + mod(ceil(p.z), 2), 2) == 0) material = 6.0;
    }
    return ro + t * rd;
}

// Rotation around Y axis
mat2 rot(float a) {
    float s = sin(a), c = cos(a);
    return mat2(c, -s, s, c);
}

struct objectInfo {
    vec3  baseCol;
    float refl;      // 0 = matte, 1 = perfect mirror
};


vec3 colorFromMaterial(float material) {
    if (material == 1.0) return vec3(1.0, 0.3, 0.3); // red sphere
    if (material == 2.0) return vec3(0.4, 0.6, 0.9); // blue box
    if (material == 3.0) return vec3(0.3, 0.8, 0.3); // green torus
    if (material == 4.0) return vec3(0.8, 0.8, 0.2); // yellow prism
    if (material == 5.0) return vec3(0.8, 0.8, 0.8); // light gray
    if (material == 6.0) return vec3(0.7, 0.7, 0.7); // dark gray
    return vec3(0.1, 0.1, 0.4); // background
}


// Secondary raymarching loop for shadows
float shadow(vec3 ro, vec3 l) {
    float res = 1.0;
    float t = 0.01;
    float k = 16.0; // softness control: higher = harder shadows

    for (int i = 0; i < 64; ++i) {
        vec3 p = ro + t * l;
        float h = map(p).x;

        // If we hit something, fully in shadow
        if (h < 0.001) return 0.0;

        // Penumbra approximation: accumulate softness
        res = min(res, k * h / t);

        t += h;
        if (t > 20.0) break;
    }

    return clamp(res, 0.0, 1.0);
}



// Computes lighting using Blinn-Phong
vec3 light(vec3 baseColor, vec3 lightPos, vec3 p, vec3 ro, out vec3 n){

    // === Lighting setup ===
    n = getNormal(p);
    vec3 v = normalize(ro - p);
    vec3 l = lightPos - p;
    float dist = length(l);
    l = normalize(l);

    float attenuation = 1.0 / (dist * dist);
    float shadowFactor = shadow(p + n * 0.01, l);


    // Ambient
    vec3 ambient = 0.33 * baseColor;

    // Diffuse
    float diff = max(dot(n, l), 0.0);
    vec3 diffuse = baseColor * diff * attenuation * shadowFactor;

    // Specular
    float spec = pow(max(dot(v, reflect(-l, n)), 0.0), 32.0);
    vec3 specular = vec3(1.0) * spec * attenuation * shadowFactor;

    return ambient + diffuse + specular;
}




// Uses your provided correct horizontal cross layout
vec2 skybox(vec3 dir) {
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




vec3 reflect(float reflectivity, vec3 lightPos, vec3 lighting, vec3 p, vec3 rd, vec3 n, int bounces) {
    vec3 result = lighting;
    vec3 incomingColor = lighting;
    vec3 rayOrigin = p + n * 0.01;
    vec3 rayDir = reflect(rd, n);
    
    float bounceReflectivity = reflectivity;

    for (int i = 0; i < bounces; ++i) {
        float mat;
        vec3 hit = raymarch(rayOrigin, rayDir, mat);

        vec3 bounceLighting;
        if (mat < 0.0) {
            // Sample skybox if ray doesn't hit geometry
            vec2 skyUV = skybox(rayDir); // Use `skybox()` UV mapping function
            vec3 skyColor = texture(iBackground, skyUV).rgb;
            result = mix(result, skyColor, bounceReflectivity);
            break;
        } else {
            // Object hit
            vec3 n2 = getNormal(hit);
            if (bounceReflectivity >= 0.99) {
                // Mirror reflection: skip lighting and just bounce again
                rayOrigin = hit + n2 * 0.01;
                rayDir = reflect(rayDir, n2);
                continue;
            }

            vec3 baseColor = colorFromMaterial(mat);
            bounceLighting = light(baseColor, lightPos, hit, rayOrigin, n2);

            rayOrigin = hit + n2 * 0.01;
            rayDir = reflect(rayDir, n2);
        }

        incomingColor = mix(bounceLighting, incomingColor, bounceReflectivity);
        result = mix(result, incomingColor, bounceReflectivity);

        bounceReflectivity *= reflectivity;
    }

    return result;
}

void main() {
    vec2 uv = (gl_FragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;

    // Camera setup
    vec3 ro = vec3(0.0, 2.0, 5.5);   // ray origin
    vec3 target = vec3(0.0, -0.5, -1.0); // camera direction
    vec3 rd = normalize(vec3(uv, 0) + target); // ray direction

    // Rotate camera around Y axis over time
    float t = iTime;
    ro.xz *= rot(0.25 * t);
    rd.xz *= rot(0.25 * t);

    // Raymarch
    float mat;
    vec3 p = raymarch(ro, rd, mat);

    vec3 color = vec3(0.0);

    vec3 vectors[2] = vec3[2](
        vec3(2.0, 1.0, 0.0),
        vec3(-2.0, 1.0, 0.0)
    );


    if (mat == 1.0) {

        for(int i = 0; i < 2; i++){
            // === Lighting ===
            vec3 n;
            vec3 baseColor = colorFromMaterial(mat);
            vec3 lightPos = vectors[i];
            vec3 lighting = light(baseColor, lightPos, p, ro, n);


            // === Reflection ===
            color += lighting;
        }
    } else if (mat >= 1.0) {
        for(int i = 0; i < 2; i++){
            // === Lighting ===
            vec3 n;
            vec3 baseColor = colorFromMaterial(mat);
            vec3 lightPos = vectors[i];
            vec3 lighting = light(baseColor, lightPos, p, ro, n);


            // === Reflection ===
            color += reflect(0.1, lightPos, lighting, p, rd, n, 2);
        }
    } else {
        uv = skybox(rd);
        color = texture(iBackground, uv).rgb;
    }

    fragColor = vec4(color, 1.0);
}
