# TextureBridge — the `ViroGPUTexture` seam

> **CHANGELOG (read first):**
> - **v0.1.2** — first real producer SHIPPED + verified on PICO 4 Ultra: `ViroMuxPlayerModule` (classic RN module `ViroMuxPlayer`, Kotlin) drives an `androidx.media3` ExoPlayer (1.1.1, `compileOnly` — must match the consumer app's copy, which already ships it for virocore's AVPlayer) into `ViroGPUTextureSurfaces.getSurface(id)`. JS component `ViroMuxBridgeSurface` (movable ViroQuad; register → poll `isExternalTextureReady` → `play(handle.id, hlsUrl, loop, muted)`; stop+release on unmount). Mux HLS plays on a Viro material with the OpenXR scene at 90/90 FPS — this replaces the legacy `ViroMaterialVideo` path, which deadlocks the OpenXR renderer at scene creation.
> - **v0.1.1** — Android native path SHIPPED (`surface-producer` v1). Additions:
>   - `ExternalTextureHandle.kind` gains `"surface-producer"` — the renderer allocates a `SurfaceTexture`-backed `GL_TEXTURE_EXTERNAL_OES` texture and exposes an `android.view.Surface` the producer renders into. The three original kinds remain reserved (a raw GL texture name from a foreign EGL context cannot be imported without context sharing — the v0.1.0 sketch of "producer passes a GL texture id across the bridge" was wrong for the common case and is NOT implemented).
>   - Nitro module `ViroGPUTextureModule` (`src/spec/ViroGPUTextureModule.nitro.ts`, Kotlin impl `android/src/main/java/com/margelo/nitro/viromux/HybridViroGPUTextureModule.kt`).
>   - New JS exports: `registerExternalTexture`, `releaseExternalTexture`, `updateExternalTexture`, `isExternalTextureReady` (`src/ViroGPUTexture.ts`).
>   - CORRECTION: the v0.1.0 claim that a `VROExternalTextureBridge` JNI surface existed in the virocore fork was stale — no such files existed. The actual fork seam is documented below ("Android v1 — what actually ships").
> - **v0.1.0** — initial freeze. `dragType` enum expanded to 4 modes (`FixedDistance | FixedDistanceOrigin | FixedToWorld | FixedToPlane`) after verifying `@reactvision/react-viro@2.56.0` source (`components/Studio/domain/viroNodeFactory.tsx`). The PROMPT-1 sketch listed only 3 modes; the contract reflects reality.

## Android v1 — what actually ships (`surface-producer`)

### Chosen interop

The v1 Android interop is **renderer-owned SurfaceTexture** (not producer-owned
GL id, not AHardwareBuffer — those are the v2 zero-copy path, see below):

```
producer (WebGPU / Skia / MediaCodec / Canvas)
   └─ renders into android.view.Surface  ←  created by the Viro renderer
        └─ SurfaceTexture(oesTexId)      ←  GL_TEXTURE_EXTERNAL_OES in Viro's GL context
             └─ VideoSink.onDrawFrame() → updateTexImage()   (Viro render thread, every frame)
                  └─ VROTextureSubstrateOpenGL → material diffuse slot (samplerExternalOES)
```

This is the exact machinery `VideoTexture` and `AndroidViewTexture` already
use — zero new GL code, battle-tested threading.

### Verified native seam (file:line citations, mikevocalz forks)

| Step | Symbol | Location |
| ---- | ------ | -------- |
| Renderer-owned texture wrapper | `com.viro.core.ExternalSurfaceTexture` (NEW) | virocore `android/sharedCode/src/main/java/com/viro/core/ExternalSurfaceTexture.java` |
| JNI create/delete (NEW) | `Java_com_viro_core_ExternalSurfaceTexture_nativeCreateExternalSurfaceTexture` | virocore `android/sharedCode/src/main/cpp/ExternalSurfaceTexture_JNI.cpp` (reuses `VROAndroidViewTexture`) |
| OES texture + substrate + Surface creation on render thread | `VROAndroidViewTexture::init` | virocore `android/sharedCode/src/main/cpp/VROAndroidViewTexture.cpp:85-108` |
| Surface + SurfaceTexture factory | `PlatformUtil.createVideoSink(int,int,int)` | virocore `com/viro/core/internal/PlatformUtil.java:247-253` |
| Per-frame `updateTexImage()` | `VideoSink.onDrawFrame` | virocore `com/viro/core/internal/VideoSink.java:75-83` |
| Frame-listener pump (OpenXR) | `ViroViewOpenXR.onDrawFrame` | virocore `com/viro/core/ViroViewOpenXR.java:680-682` (list wired at `:191`) |
| Material binding | `Material.setDiffuseTexture(Texture)` | virocore `com/viro/core/Material.java:759-763` |
| Named-material lookup | `MaterialManager.getMaterial(String)` | viro `com/viromedia/bridge/module/MaterialManager.java:99-104` |
| Active-ViroView lookup | `PerfMonitor.getView()` (NEW getter) | viro `com/viromedia/bridge/module/PerfMonitor.java`; set by every navigator at `VRT3DSceneNavigator.java:198-199` |
| `sampler2D → samplerExternalOES` rewrite for EGL-image diffuse textures | `VROShaderFactory::createEGLImageModifier` | virocore `ViroRenderer/VROShaderFactory.cpp:935-944` |

`com.viro.core.Texture` itself has **no** GL-id or SurfaceTexture constructor
(verified: `Texture.java:318/332/343/364/391/414/449/486` are all
Image/Bitmap/ByteBuffer based) — hence the new `ExternalSurfaceTexture`
subclass in the fork.

### Threading contract

- `registerExternalTexture` (JS thread, sync) → allocates the handle id, posts binding to the **main thread**.
- Binding (main thread, retried 40×250ms) → resolves ViroView + material, constructs `ExternalSurfaceTexture` (JNI dispatches `init` to the **render thread** via `VROPlatformDispatchAsyncRenderer`), calls `Material.setDiffuseTexture`.
- Surface delivery (render thread) → `setVideoSink(Surface)` → published to `ViroGPUTextureSurfaces` (Kotlin, `ConcurrentHashMap`); JS observes via `isExternalTextureReady(handle)`.
- Frame consumption (render thread) → `VideoSink.onDrawFrame` calls `updateTexImage()` when `onFrameAvailable` fired. XR renders continuously, so no explicit invalidate is needed; **`updateTexture()` is a no-op on this path**.
- Producer writes: any thread (Surface producers are thread-safe by contract).

### Lifecycle

- Handle id is the surface-registry key AND the `nativeToken`.
- `releaseExternalTexture(handle)`: unbinds the material's diffuse slot (only if still ours), disposes the renderer wrapper (`VROPlatformDestroyVideoSink` removes the frame listener and releases the Surface). Idempotent. Producer GPU memory untouched.
- CAVEAT: re-running `ViroMaterials.createMaterials` for the same material name recreates the native material and drops the binding — register the texture after the final material definition.

### v2 (zero-copy, NOT wired yet)

virocore already contains a compiled AHardwareBuffer/EGLImage import seam —
`VROExternalSurfaceTexture` (`ViroRenderer/VROExternalSurfaceTexture.h:61-87`)
with Route B `eglCreateImageKHR(EGL_NATIVE_BUFFER_ANDROID)` +
`glEGLImageTargetTexture2DOES`
(`android/sharedCode/src/main/cpp/VROExternalSurfaceTextureImpl.cpp:92-137`)
and `VROMaterial::setExternalSurfaceTexture`
(`ViroRenderer/VROMaterial.cpp:526`). It lacks a Java/JNI entry and a
per-frame consume pump; the producer side lives in `nitro-canvas-in-Vision`.
Wiring that through this module (fence-gated `updateTexture`) is the v2 work
item in TASKS.md.

## Why this exists

Stock `@reactvision/react-viro` has no JS-level external-texture API. The only documented "non-visual sibling component sets a texture on a named material that a visual component references" pattern in shipping code is `ViroCameraTexture` (camera background).

This package generalizes that pattern: any externally produced GPU texture (WebGPU, Skia, offscreen FBO, compute pass output) can be presented through the same substrate path the camera feed uses.

## Verified native seam (citations)

These symbols are confirmed in the `mikevocalz/virocore` source (the `pico-support` branch I just pushed). The numbers refer to upstream `ReactVision/virocore` master where the canonical implementations live; the fork carries the new external-texture call site.

### Android (OpenGL ES) — `VROARSessionARCore.cpp`

Camera background texture construction (this is the seam pattern):

```cpp
std::unique_ptr<VROTextureSubstrate> substrate =
    std::make_unique<VROTextureSubstrateOpenGL>(GL_TEXTURE_EXTERNAL_OES,
                                                _cameraTextureId, driver, true);
_background = std::make_shared<VROTexture>(VROTextureType::TextureEGLImage,
                                           VROTextureInternalFormat::RGBA8,
                                           std::move(substrate));
```

### iOS (Metal) — `VROGeometrySubstrateMetal.cpp`

```cpp
VROTextureSubstrateMetal *substrate =
    dynamic_cast<VROTextureSubstrateMetal *>(textures[j]->getSubstrate(driver));
```

So the seam wraps a shared `MTLTexture` (backed by an `IOSurface` so WebGPU/Skia and Viro share GPU memory) in a `VROTextureSubstrateMetal`, then a `VROTexture`, then assigns it to the target material via the material's substrate.

## `ExternalTextureHandle` per platform

| Platform | Underlying type                                            | Lifetime owner |
| -------- | ---------------------------------------------------------- | -------------- |
| Android  | GL texture id + optional `EGLImageKHR` (shared EGL ctx)    | Caller (WebGPU/Skia) |
| iOS      | `IOSurfaceRef` (or `MTLTextureRef` wrapping an `IOSurface`)| Caller         |

The TS surface treats this as an opaque opaque-handle (`number` on Android, `number` representing an `IOSurfaceID` on iOS, normalized into a `bigint`-safe `number` because RN bridge cannot move pointers). The native module is responsible for resolving the handle back to a GPU object.

`releaseExternalTexture` deletes the `VROTexture` / substrate wrapper. It **does not** free the underlying GL/Metal texture — that is owned by the producer (WebGPU/Skia).

## `ViroMaterials.createMaterials` quirk

Per `virocore` issue #436, registering a material with **no** `diffuseTexture` can crash on first run. Always register a placeholder 1×1 `diffuseTexture` before the native swap. The helper `createPlaceholderMaterial(name)` in `src/createPlaceholderMaterial.ts` bakes this in.

## 16KB page-alignment (PICO / Android 15)

The fork's native `.so` outputs must keep the 16KB alignment already established for `libopenxr_loader.so` and `libc++_shared.so`. Carry into this module's build config. See `mikevocalz/virocore` `scripts/verify-16kb-alignment.py`.

## What lives where

| Concern                          | This package | virocore fork |
| -------------------------------- | ------------ | ------------- |
| JS contract (`src/contract.ts`)  | ✅           |               |
| Nitro module spec                | ✅           |               |
| Native impl (iOS/Android)        | ✅ (Nitro)   | ✅ (substrate wiring) |
| Placeholder material helper      | ✅           |               |
| The C++ `registerExternalTexture` call site that creates the substrate and binds it to a material | | ✅ (per Appendix A point 1 — work item, not yet in fork) |
