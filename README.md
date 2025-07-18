# OpenGL Raymarching SDF Viewer

This project is a real-time OpenGL application that renders signed distance functions (SDFs) using raymarching via a fragment shader. It's a minimal example that uses modern OpenGL (3.3+) and GLFW/GLEW to display procedural 3D visuals with a background texture and interactive uniforms.

## Features

- Fullscreen quad rendered with a raymarching fragment shader.
- Real-time animation with time and mouse-based interaction.
- Loads external texture as a background (skybox or environment).
- Shader reloading support via recompilation at runtime.
- Built-in debug logs for shader compilation and texture loading.

## Requirements

- C++17 or later
- OpenGL 3.3+
- [GLFW](https://www.glfw.org/) (for window/context management)
- [GLEW](http://glew.sourceforge.net/) (for OpenGL extensions)
- [stb_image.h](https://github.com/nothings/stb/blob/master/stb_image.h) (included) for image loading

## Building

You can use CMake or build manually. Here's an example using g++:

```bash
g++ src/main.cpp -o raymarch -lGL -lGLEW -lglfw -ldl
```

Make sure the working directory includes `stb_image.h`, and that the relative paths to the shaders and textures are preserved.

## Running

```bash
./raymarch
```

The program opens a window and renders the scene defined by the `figures.frag` shader. You can interact with the shader using the mouse, and the background image will be blended into the final output.

## Shader Inputs

The following uniforms are passed to the fragment shader:

- `iResolution (vec3)` – The current viewport resolution.
- `iTime (float)` – Time in seconds since the program started.
- `iMouse (vec4)` – Current mouse position.
- `iFrame (int)` – Frame count.
- `iSkybox (sampler2D)` – Texture for background or environment.

## Notes

- This app uses raymarching to render 3D geometry using SDFs.
- You can customize `figures.frag` to define your own shapes and scenes.
- A sample texture is expected at `../src/Backgrounds/mountains.jpg` by default.
