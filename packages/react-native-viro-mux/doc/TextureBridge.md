# TextureBridge — the `ViroGPUTexture` seam

> **CHANGELOG (read first):**
> - **v0.1.0** — initial freeze. `dragType` enum expanded to 4 modes (`FixedDistance | FixedDistanceOrigin | FixedToWorld | FixedToPlane`) after verifying `@reactvision/react-viro@2.56.0` source (`components/Studio/domain/viroNodeFactory.tsx`). The PROMPT-1 sketch listed only 3 modes; the contract reflects reality.

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
