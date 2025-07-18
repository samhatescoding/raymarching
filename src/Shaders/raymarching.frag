

#version 330 core

out vec4 fragColor;

uniform vec3 iResolution; // viewport resolution (in pixels)
uniform float iTime;
uniform sampler2D iBackground;

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

struct Object {
    int type;       // Type of Object
    int shade;      // Type of Shading
    vec3  color;  // Base color
    float refl;     // Reflectivity
    float trans;    // Transparency
};


float map(vec3 p, out Object o) {
    Object objs[5];
    float d[5];

    d[0] = sdfPlane(p - vec3(0.0, -0.5, 0.0));
    d[1] = sdfSphere(p, vec3(1, 0, 1), 0.5);
    d[2] = sdfBox(p, vec3(-1, 0, 1), vec3(0.5));
    d[3] = sdfTorus(p, vec3(1.0, 0, -1), vec2(0.5, 0.2));
    d[4] = sdfCone(p, vec3(-1.0, 0.5, -1.0), vec2(0.3, 0.5));

    objs[0] = Object(0, 0, vec3(0.9), 0.0, 0.0);            // Ground plane
    objs[1] = Object(1, 0, vec3(0.8, 0.9, 1.0), 1.0, 0.0);  // Reflective sphere
    objs[2] = Object(2, 0, vec3(0.6, 0.6, 0.9), 0.2, 0.0);  // Slightly reflective box
    objs[3] = Object(3, 0, vec3(0.2, 0.8, 0.3), 0.0, 0.6);  // Transparent torus
    objs[4] = Object(4, 0, vec3(1.0, 1.0, 0.0), 0.0, 0.0);  // Yellow cone
    

    Object result = objs[0];
    float dMin = d[0];
    for (int i = 1; i < 5; ++i) {
        if (d[i] < dMin) {
            dMin = d[i];
            o = objs[i];
        }
    }

    return dMin;
}

// Normal estimation via central differences
vec3 getNormal(vec3 p) {
    float h = 0.001;

    // Sample positions slightly offset in different directions
    Object tmp;
    float dx = map(p + vec3(h, 0.0, 0.0), tmp) - map(p - vec3(h, 0.0, 0.0), tmp);
    float dy = map(p + vec3(0.0, h, 0.0), tmp) - map(p - vec3(0.0, h, 0.0), tmp);
    float dz = map(p + vec3(0.0, 0.0, h), tmp) - map(p - vec3(0.0, 0.0, h), tmp);

    // Approximate gradient (i.e., surface normal)
    vec3 normal = vec3(dx, dy, dz);

    return normalize(normal);
}




// Raymarching loop
vec3 raymarch(vec3 ro, vec3 rd, out Object o) {
    float t = 0.0;
    vec3 p = vec3(0.0);

    for (int i = 0; i < 100; ++i) {
        p = ro + t * rd;

        float d = map(p, o);

        if (d < 0.01) break;
        t += d;
        if (t > 10.0) {
            o.type = -1;
            return ro + t * rd;
        }
    }

    if (o.type == 0) {
        if(mod(mod(ceil(p.x), 2.0) + mod(ceil(p.z), 2), 2) == 0) o.color = vec3(0.6);
    }

    return ro + t * rd;
}





/* =========== Skybox ========== */

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






/* ========== Shadows ========== */

// Secondary raymarching loop for shadows
float shadow(vec3 ro, vec3 l) {
    float res = 1.0;
    float t = 0.01;
    float k = 16.0; // softness control: higher = harder shadows
    Object tmp;

    for (int i = 0; i < 64; ++i) {
        vec3 p = ro + t * l;
        float h = map(p, tmp);

        // If we hit something, fully in shadow
        if (h < 0.001) return 0.0;

        // Penumbra approximation: accumulate softness
        res = min(res, k * h / t);

        t += h;
        if (t > 20.0) break;
    }

    return clamp(res, 0.0, 1.0);
}





/* ========== Shading ========== */

#define NUM_LIGHTS 2

struct Light {
    vec3 pos;
    vec3 Ia; // Ambient intensity
    vec3 Id; // Diffuse intensity
    vec3 Is; // Specular intensity
};

Light lights[NUM_LIGHTS];

// Computes lighting using Blinn-Phong with multiple lights
vec3 shadeBlinnPhong(vec3 baseColor, Light lights[NUM_LIGHTS], vec3 p, vec3 ro, out vec3 n) {
    n = getNormal(p);
    vec3 v = normalize(ro - p);
    vec3 result = vec3(0.0);

    for (int i = 0; i < NUM_LIGHTS; ++i) {
        vec3 l = lights[i].pos - p;
        float dist = length(l);
        l = normalize(l);

        float attenuation = 1.0 / (dist * dist);
        float shadowFactor = shadow(p + n * 0.01, l);

        // Ambient
        vec3 ambient = lights[i].Ia * baseColor;

        // Diffuse
        float diff = max(dot(n, l), 0.0);
        vec3 diffuse = lights[i].Id * baseColor * diff * attenuation * shadowFactor;

        // Specular
        vec3 h = normalize(l + v); // Blinn-Phong uses halfway vector
        float spec = pow(max(dot(n, h), 0.0), 32.0);
        vec3 specular = lights[i].Is * spec * attenuation * shadowFactor;

        result += ambient + diffuse + specular;
    }

    return result;
}


























// Rotation around Y axis
mat2 rot(float a) {
    float s = sin(a), c = cos(a);
    return mat2(c, -s, s, c);
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

    // Define lights
    lights[0].pos = vec3(2.0, 1.0, 0.0);
    lights[0].Ia  = vec3(0.1);
    lights[0].Id  = vec3(0.8);
    lights[0].Is  = vec3(1.0);

    lights[1].pos = vec3(-2.0, 1.0, 0.0);
    lights[1].Ia  = vec3(0.05);
    lights[1].Id  = vec3(0.5);
    lights[1].Is  = vec3(0.7);

    // Raymarch
    Object o;
    vec3 p = raymarch(ro, rd, o);

    vec3 color = vec3(0.0);

    if (o.type >= 0.0) {
        for(int i = 0; i < 2; i++){
            // === Lighting ===
            vec3 n;
            vec3 lighting = shadeBlinnPhong(o.color, lights, p, ro, n);
            color += lighting;
        }
    } else {
        uv = skybox(rd);
        color = texture(iBackground, uv).rgb;
    }

    fragColor = vec4(color, 1.0);
}