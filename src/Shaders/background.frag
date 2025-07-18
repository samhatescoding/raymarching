    #version 330 core

    out vec4 FragColor;

    uniform sampler2D iBackground;
    uniform vec3 iResolution;

    void main() {
        vec2 uv = gl_FragCoord.xy / iResolution.xy;
        vec3 color = texture(iBackground, uv).rgb;
        FragColor = vec4(color, 1.0);
    }
