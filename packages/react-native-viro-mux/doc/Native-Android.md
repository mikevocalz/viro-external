# Native-Android — binding map

> **v0.1.1 (2026-07-03):** the "producer passes a GL texture id across the
> bridge" seam sketched below was NOT implementable as written — a GL name
> from a foreign EGL context is meaningless in Viro's context without context
> sharing. The shipped v1 is the **surface-producer** path; full verified
> citations live in `TextureBridge.md` ("Android v1 — what actually ships").

## viro-core symbols this module calls (v1, verified)

| Use case                       | Symbol                                                       | Source location |
| ------------------------------ | ------------------------------------------------------------ | --------------- |
| Mux HLS → video texture        | `com.viro.core.VideoTexture(ViroContext, Uri, ...)`          | virocore `com/viro/core/VideoTexture.java:154` |
| Renderer-owned external surface texture | `com.viro.core.ExternalSurfaceTexture(ViroContext, w, h, SurfaceListener)` (NEW, fork) | virocore `com/viro/core/ExternalSurfaceTexture.java` |
| Named-material lookup          | `MaterialManager.getMaterial(String)`                        | viro `com/viromedia/bridge/module/MaterialManager.java:99` |
| Material binding               | `Material.setDiffuseTexture(Texture)`                        | virocore `com/viro/core/Material.java:759` |
| Active ViroView / ViroContext  | `PerfMonitor.getView()` (NEW, fork) → `ViroView.getViroContext()` | viro `PerfMonitor.java`; virocore `ViroView.java:240` |
| Per-frame consume              | `VideoSink.onDrawFrame()` → `SurfaceTexture.updateTexImage()` (automatic) | virocore `com/viro/core/internal/VideoSink.java:75-83`, pumped by `ViroViewOpenXR.java:680-682` |

## External texture import (v2 — reserved, not wired)

GL texture id + optional `EGLImageKHR` (shared EGL context). WebGPU (Dawn vk-on-Android) or Skia (Graphite via Vulkan) produce a Vulkan image; an external memory extension exports it to OpenGL ES via `EGL_ANDROID_native_buffer` / `EGL_KHR_image`.

virocore already carries the import half, compiled but not yet Java-reachable:
`VROExternalSurfaceTextureImpl_importHandle` — Route B AHardwareBuffer →
`eglCreateImageKHR(EGL_NATIVE_BUFFER_ANDROID)` + `glEGLImageTargetTexture2DOES`
(`android/sharedCode/src/main/cpp/VROExternalSurfaceTextureImpl.cpp:92-137`),
Route A pass-through OES name (`:143-155`). Exposing it through this module
(with a fence-gated `updateTexture`) is the v2 work item in TASKS.md.

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

## Nitro module (shipped 2026-07-03)

- Spec: `src/spec/ViroGPUTextureModule.nitro.ts` (android-kotlin; iOS added later).
- Impl: `android/src/main/java/com/margelo/nitro/viromux/HybridViroGPUTextureModule.kt`.
- Producer surface registry: `.../ViroGPUTextureSurfaces.kt` (`getSurface(id)` for native producers).
- JNI: only `android/src/main/cpp/cpp-adapter.cpp` (`JNI_OnLoad` → generated `registerAllNatives()`); all GL work rides virocore's VideoSink machinery — no GL code in this package.
- Codegen: `pnpm specs` (nitrogen pinned at `0.35.9` to match `react-native-nitro-modules@0.35.9`; do NOT bump to latest independently).
- Autolinking: `react-native.config.js` (android only) + `ViroMuxPackage.kt` loads `libNitroViroMux.so`.
