# Native-iOS — binding map

## ViroKit symbols this module calls

| Use case                       | Symbol                                             | Source location |
| ------------------------------ | -------------------------------------------------- | --------------- |
| Mux HLS → video texture        | `VROVideoTextureiOS::loadVideo(AVPlayerItem *)`    | ViroKit (prebuilt) — verify exact signature before linking |
| Material substrate swap        | `VROTextureSubstrateMetal`                         | virocore `VROGeometrySubstrateMetal.cpp` |
| Texture wrapper                | `VROTexture(VROTextureType, VROTextureInternalFormat, std::unique_ptr<VROTextureSubstrate>)` | virocore `VROTexture.h` |

## External texture import

`IOSurfaceRef` is the shared-memory primitive. WebGPU (Dawn / Safari WebGPU) and Skia (Graphite) both produce `MTLTexture`s that can be created from an `IOSurface`. The seam:

1. Producer creates an `MTLTexture` backed by an `IOSurfaceRef`.
2. Producer passes the `IOSurfaceID` (a `uint32_t`) across the JS bridge via the Nitro module.
3. Native side resolves the `IOSurfaceID` → `IOSurfaceRef` → `MTLTexture` (Viro's `MTLDevice`).
4. Wraps in `VROTextureSubstrateMetal` → `VROTexture` → binds to the target material.

## Nitro module

Spec lives in `src/spec/ViroGPUTextureModule.nitro.ts` (declarative TS, codegen target).

Native impl files (`ios/HybridViroGPUTextureModule.{h,mm}`) are tracked in `TASKS.md` — they require the virocore fork to land the C++ `registerExternalTexture` entry point per `TextureBridge.md`. Not shipped as a stub.

## Build

- `react-native-viro-mux.podspec` declares the dependency on `ViroReact` (peer) and `NitroModules` (peer).
- The podspec is **not** in this scaffold yet; it is a Phase 2-native deliverable tracked in `TASKS.md`.
