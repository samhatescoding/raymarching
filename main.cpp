#include <GL/glew.h>
#include <GLFW/glfw3.h>
#include <iostream>
#include <fstream>
#include <sstream>
#include <cmath>
#include <string>

// Including stb_image for image loading
#define STB_IMAGE_IMPLEMENTATION
#include "stb_image.h"


int WIDTH = 1920;
int HEIGHT = 1080;


std::string loadShaderSource(const char* filepath) {
    std::ifstream file(filepath);
    if (!file.is_open()) {
        std::cerr << "[ERROR] Failed to open shader file: " << filepath << std::endl;
        return "";
    }

    std::stringstream ss;
    ss << file.rdbuf();
    std::string src = ss.str();

    std::cout << "[INFO] Shader loaded from " << filepath << ", size: " << src.size() << " bytes\n";
    std::cout << "------- " << filepath << " -------\n";
    std::cout << src << "\n";
    std::cout << "----------------------------------\n";

    return src;
}

GLuint compileShader(GLenum type, const char* source, const std::string& name) {
    GLuint shader = glCreateShader(type);
    glShaderSource(shader, 1, &source, nullptr);
    glCompileShader(shader);

    GLint success;
    glGetShaderiv(shader, GL_COMPILE_STATUS, &success);
    if (!success) {
        char info[2048];
        glGetShaderInfoLog(shader, 2048, nullptr, info);
        std::cerr << "[ERROR] Compilation failed for " << name << ":\n" << info << std::endl;
    } else {
        std::cout << "[INFO] " << name << " compiled successfully.\n";
    }

    return shader;
}

GLuint createShaderProgram(const char* vertexPath, const char* fragPath) {
    std::string vsrc = loadShaderSource(vertexPath);
    std::string fsrc = loadShaderSource(fragPath);

    GLuint vShader = compileShader(GL_VERTEX_SHADER, vsrc.c_str(), vertexPath);
    GLuint fShader = compileShader(GL_FRAGMENT_SHADER, fsrc.c_str(), fragPath);

    GLuint program = glCreateProgram();
    glAttachShader(program, vShader);
    glAttachShader(program, fShader);
    glLinkProgram(program);

    GLint success;
    glGetProgramiv(program, GL_LINK_STATUS, &success);
    if (!success) {
        char info[2048];
        glGetProgramInfoLog(program, 2048, nullptr, info);
        std::cerr << "[ERROR] Program link failed:\n" << info << std::endl;
    } else {
        std::cout << "[INFO] Shader program linked successfully.\n";
    }

    glDeleteShader(vShader);
    glDeleteShader(fShader);

    return program;
}

GLuint loadTexture(const char* path) {
    std::cout << "[DEBUG] Attempting to load texture: " << path << "\n";
    int w, h, channels;
    stbi_set_flip_vertically_on_load(true);  // For OpenGL's UVs
    unsigned char* data = stbi_load(path, &w, &h, &channels, 0);
    if (!data) {
        std::cerr << "[ERROR] Failed to load image: " << path << "\n";
        return 0;
    }

    GLenum format = (channels == 3) ? GL_RGB : GL_RGBA;
    std::cout << "[DEBUG] Image loaded. Size: " << w << "x" << h << ", Channels: " << channels << "\n";

    GLuint texID;
    glGenTextures(1, &texID);
    glBindTexture(GL_TEXTURE_2D, texID);

    glTexImage2D(GL_TEXTURE_2D, 0, format, w, h, 0, format, GL_UNSIGNED_BYTE, data);
    glGenerateMipmap(GL_TEXTURE_2D);

    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_S, GL_CLAMP_TO_EDGE);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_WRAP_T, GL_CLAMP_TO_EDGE);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MIN_FILTER, GL_LINEAR);
    glTexParameteri(GL_TEXTURE_2D, GL_TEXTURE_MAG_FILTER, GL_LINEAR);

    stbi_image_free(data);
    return texID;
}

int main() {
    if (!glfwInit()) {
        std::cerr << "[ERROR] Failed to initialize GLFW\n";
        return -1;
    }

    glfwWindowHint(GLFW_CONTEXT_VERSION_MAJOR, 3);
    glfwWindowHint(GLFW_CONTEXT_VERSION_MINOR, 3);
    GLFWwindow* window = glfwCreateWindow(WIDTH, HEIGHT, "Raymarching SDF", nullptr, nullptr);
    if (!window) {
        std::cerr << "[ERROR] Failed to create GLFW window\n";
        glfwTerminate();
        return -1;
    }
    glfwMakeContextCurrent(window);
    glewExperimental = true;
    GLenum glewErr = glewInit();
    if (glewErr != GLEW_OK) {
        std::cerr << "[ERROR] Failed to initialize GLEW: " << glewGetErrorString(glewErr) << "\n";
        return -1;
    }

    std::cout << "[INFO] OpenGL Version: " << glGetString(GL_VERSION) << "\n";

    GLuint shaderProgram = createShaderProgram("../src/shaders/basic.vert", "../src/shaders/figures.frag");

    float quad[] = {
        -1, -1,
         1, -1,
        -1,  1,
        -1,  1,
         1, -1,
         1,  1
    };

    GLuint VAO, VBO;
    glGenVertexArrays(1, &VAO); glBindVertexArray(VAO);
    glGenBuffers(1, &VBO); glBindBuffer(GL_ARRAY_BUFFER, VBO);
    glBufferData(GL_ARRAY_BUFFER, sizeof(quad), quad, GL_STATIC_DRAW);
    glVertexAttribPointer(0, 2, GL_FLOAT, GL_FALSE, 2 * sizeof(float), 0);
    glEnableVertexAttribArray(0);

    float startTime = glfwGetTime();
    int frame = 0;

    unsigned char* pixels = new unsigned char[WIDTH * HEIGHT * 3]; // RGB

    /* Problematic lines: */
    GLuint bgTex = loadTexture("../src/Backgrounds/mountains.jpg");
    if (bgTex == 0) return -1;

    // Main loop
    while (!glfwWindowShouldClose(window)) {
        int width, height;
        glfwGetFramebufferSize(window, &width, &height);
        glViewport(0, 0, width, height);
        glClear(GL_COLOR_BUFFER_BIT);

        glUseProgram(shaderProgram);

        float time = glfwGetTime() - startTime;
        double mouseX, mouseY;
        glfwGetCursorPos(window, &mouseX, &mouseY);

        glUniform3f(glGetUniformLocation(shaderProgram, "iResolution"), (float)width, (float)height, 1.0f);
        glUniform1f(glGetUniformLocation(shaderProgram, "iTime"), time);
        glUniform4f(glGetUniformLocation(shaderProgram, "iMouse"), (float)mouseX, (float)mouseY, 0.0f, 0.0f);
        glUniform1i(glGetUniformLocation(shaderProgram, "iFrame"), frame++);

        glBindVertexArray(VAO);

        glEnable(GL_BLEND);
        glBlendFunc(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA);


        /* For a wallpaper background: */
        glActiveTexture(GL_TEXTURE0);
        glBindTexture(GL_TEXTURE_2D, bgTex);
        glUniform1i(glGetUniformLocation(shaderProgram, "iSkybox"), 0);

        glDrawArrays(GL_TRIANGLES, 0, 6);

        glReadPixels(0, 0, width, height, GL_RGB, GL_UNSIGNED_BYTE, pixels);


        glfwSwapBuffers(window);
        glfwPollEvents();
    }

    glfwDestroyWindow(window);
    glfwTerminate();
    return 0;
}
