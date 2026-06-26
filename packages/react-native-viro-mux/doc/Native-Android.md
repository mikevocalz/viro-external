# Native-Android — binding map

## viro-core symbols this module calls

| Use case                       | Symbol                                                       | Source location |
| ------------------------------ | ------------------------------------------------------------ | --------------- |
| Mux HLS → video texture        | `com.viro.core.VideoTexture(android.net.Uri)`                | viro-core (prebuilt) |
| Material substrate             | `VROTextureSubstrateOpenGL(GL_TEXTURE_EXTERNAL_OES \| GL_TEXTURE_2D, textureId, driver, sRGB)` | virocore `VROTextureSubstrateOpenGL.cpp` |
| Texture wrapper                | `VROTexture(VROTextureType::TextureEGLImage, VROTextureInternalFormat::RGBA8, substrate)` | virocore `VROTexture.h` |

## External texture import

GL texture id + optional `EGLImageKHR` (shared EGL context). WebGPU (Dawn vk-on-Android) or Skia (Graphite via Vulkan) produce a Vulkan image; an external memory extension exports it to OpenGL ES via `EGL_ANDROID_native_buffer` / `EGL_KHR_image`.

The seam:

1. Producer creates a Vulkan image, exports to `EGLImageKHR`.
2. Producer creates a GL texture name and binds the `EGLImage` via `glEGLImageTargetTexture2DOES`.
3. Producer passes the GL texture id (int) across the bridge.
4. Native side wraps in `VROTextureSubstrateOpenGL(GL_TEXTURE_EXTERNAL_OES, id, driver, /*sRGB*/ true)` and binds to the material.

## 16KB page alignment (PICO / Android 15)

The pico-support branch of `mikevocalz/virocore` enforces 16KB ELF alignment on `libopenxr_loader.so` / `libc++_shared.so`. Apply the same `-Wl,-z,max-page-size=16384` link flag to this module's `.so`:

```gradle
externalNativeBuild {
  cmake {
    cppFlags "-std=c++17"
    arguments "-DANDROID_STL=c++_shared",
              "-DCMAKE_ANDROID_ARCH_ABI=arm64-v8a",
              "-DCMAKE_SHARED_LINKER_FLAGS=-Wl,-z,max-page-size=16384"
  }
}
```

Validate the produced `.so` with `mikevocalz/virocore/scripts/verify-16kb-alignment.py`.

## Nitro module

Spec lives in `src/spec/ViroGPUTextureModule.nitro.ts`.

Native impl files (`android/src/main/java/.../HybridViroGPUTextureModule.kt` + JNI bridge) are tracked in `TASKS.md` — they require the virocore JNI surface that exposes the C++ `registerExternalTexture` to Java/Kotlin. Not shipped as a stub.
