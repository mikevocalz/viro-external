# @viro-external/orb-pass — AGENTS

D.E.C.A. orb as a `VRORenderPass` child of the multiplex.
Ported from `~/orb/src/orb.ts:262-273` (three.js `onBeforeCompile` GLSL) into a
straight GLES 3.00 ES program. Viro owns the frame; three.js does not run its
render loop at runtime — the orb's shader source is the only three.js
artifact that ships.

## Where things live

- `native/include/VROOrbRenderPass.h` — public C++ interface
- `native/src/VROOrbRenderPass.cpp` — icosphere VBO + shader + render()
- `native/src/ViroOrbPassJNI.cpp` — JNI attach/detach for
  `com.viromedia.bridge.module.ViroOrbPassModule` (lives in `~/viro/android/viro_bridge`)
- `src/index.ts` — `registerOrbPass` / `unregisterOrbPass` JS registrar
- `plugin/index.js` — appends `add_subdirectory(orb-pass/native)` to the
  host app's CMakeLists (runs after splat-pass's plugin)

## MVP scope (what's here today)

- Hardcoded icosphere (subdivided once — 42 verts, 80 faces)
- Ember-pulse fragment (fbm noise + smoothstep(uIgnition) mix)
- Hardcoded world position + scale (0, 1.4, -1.5), scale 0.20
- Always-in-front depth policy (glDepthFunc(GL_ALWAYS), depth-mask false)
- No morph targets, no rings, no shell, no GLTF loader, no per-eye offset math

## What is NOT here (deliberately deferred)

- Rings + shell layers from the original orb
- Morph target visemes / lipsync
- GLTF loader — orb model comes from the icosphere for now
- Volumetric fog / bloom parity — Viro's choreographer will provide bloom
  via `getGaussianBlurPass()` at scene init; not the orb's responsibility

## When rebuilding after changes

Native C++: the host app's CMake picks up changes via `add_subdirectory`.
`cd ~/decax9/android && ./gradlew :app:externalNativeBuildPicoDebug`.

Java (`ViroOrbPassModule.java`): rebuild viro_bridge, drop the AAR:
```bash
cd ~/viro/android && ./gradlew :viro_bridge:assembleRelease
cp viro_bridge/build/outputs/aar/viro_bridge-release.aar ~/viro/android/react_viro/react_viro-release.aar
cd ~/decax9 && npx expo prebuild --clean && cd android && ./gradlew :app:assemblePicoDebug -x lint
```
