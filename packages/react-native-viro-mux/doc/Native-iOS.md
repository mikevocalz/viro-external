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

The spec declares only `@Android`. The iOS implementation is tracked in `TASKS.md`; it requires the virocore fork to land the C++ `registerExternalTexture` entry point per `TextureBridge.md`. Not shipped as a stub.

Under Nitro V1, adding iOS means: an `@Apple` decorator on the spec, Swift or C++ sources under `apple/` (V1's default `swiftSources`), a `Package.swift` calling `addNitrogenTargets(to:)`, `swiftpmConfig` in `package.json`, and a metadata-only podspec. V1 needs Swift 6.4 and SwiftPM integration through `npx react-native spm`.

## Build

- iOS builds through SwiftPM (`Package.swift`) under Nitro V1. The podspec, when added, is discovery metadata only (no `source_files`).
- Neither file is in this package yet; both are Phase 2-native deliverables tracked in `TASKS.md`.
