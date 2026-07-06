# TASKS — react-native-viro-mux

## Phase 0 — scaffolding (DONE)

- [x] `AGENTS.md`
- [x] `CLAUDE.md`
- [x] `TASKS.md`
- [x] `config/defaults.json`
- [x] `doc/Architecture.md`
- [x] `doc/TextureBridge.md`
- [x] `doc/Movability.md`
- [x] `doc/MuxPlayback.md`
- [x] `doc/Native-iOS.md`
- [x] `doc/Native-Android.md`
- [x] `package.json` (pinned, versions verified on npm)
- [x] `tsconfig.json`

## Phase 1 — verified Viro API citations (DONE)

- [x] `dragType` enum confirmed: `FixedDistance | FixedDistanceOrigin | FixedToWorld | FixedToPlane` (AR/ViroCommonProps.ts:32). Contract updated.
- [x] `ViroPinchState` confirmed: PINCH_START=1, PINCH_MOVE=2, PINCH_END=3 (Types/ViroEvents.ts:79).
- [x] `onDrag` signature: `(dragToPos: Viro3DPoint, source: ViroSource)` (AR/ViroCommonProps.ts:61).
- [x] `ViroMaterialVideo` props confirmed: `material`, `paused`, `loop`, `muted`, `volume`, `onBufferStart`, `onBufferEnd`, `onFinish`, `onError`, `onUpdateTime` (components/ViroMaterialVideo.tsx).
- [x] `ViroGeometry` mesh API confirmed: `vertices`, `normals`, `texcoords`, `triangleIndices` (components/ViroGeometry.tsx:16-21).
- [x] `ViroMaterials.createMaterials` API confirmed.

## Phase 2 — JS deliverables (DONE)

- [x] `src/contract.ts` — frozen public TS surface.
- [x] `src/MovableNode.tsx` — single drag/pinch/axisLock implementation.
- [x] `src/createPlaceholderMaterial.ts` — 1×1 placeholder helper (issue #436).
- [x] `src/ViroMuxVideo.tsx` — Mux HLS → material binding.
- [x] `src/ViroMuxSurface.tsx` — flat↔curved quad with verified ViroGeometry mesh.
- [x] `src/index.ts` — public exports.

## Phase 2 — Native deliverables (Android DONE 2026-07-03; iOS pending)

- [x] `src/spec/ViroGPUTextureModule.nitro.ts` — Nitro HybridObject spec (android-kotlin; iOS declared later). *(2026-07-03)*
- [ ] `ios/HybridViroGPUTextureModule.{h,mm}` — Metal/IOSurface binding. **iOS later.**
- [x] `android/.../HybridViroGPUTextureModule.kt` — surface-producer v1 binding via `com.viro.core.ExternalSurfaceTexture` (new fork class). No package-local GL/JNI beyond `cpp-adapter.cpp`; the GL work rides virocore's VideoSink machinery. *(2026-07-03)*
- [ ] `react-native-viro-mux.podspec` — **iOS later** (android `build.gradle` + `CMakeLists.txt` + `react-native.config.js` shipped 2026-07-03).
- [x] Nitrogen codegen pinned: `nitrogen@0.35.9` devDep (matches `react-native-nitro-modules@0.35.9`; npm latest 0.36.1 intentionally NOT used — codegen must match the installed core). `pnpm specs` regenerates. *(2026-07-03)*
- [x] **virocore fork work** *(2026-07-03 — CORRECTED)*: the previous claim here (a `VROExternalTextureBridge.{h,cpp}` + `Renderer.registerExternalTexture` JNI + `docs/EXTERNAL-TEXTURE-BRIDGE.md`) was **stale — none of those files existed in the fork**. What actually shipped:
  - `android/sharedCode/src/main/java/com/viro/core/ExternalSurfaceTexture.java` — `Texture` subclass; renderer-owned SurfaceTexture + producer-facing Surface (delivered via `SurfaceListener` from the render thread).
  - `android/sharedCode/src/main/cpp/ExternalSurfaceTexture_JNI.cpp` — reuses `VROAndroidViewTexture` C++ verbatim (its `setVideoSink` callback resolves via `GetObjectClass`, so it binds to any Java class with that method — VROAndroidViewTexture.cpp:105-107).
  - `android/sharedCode/CMakeLists.txt` — new JNI file added to the source list.
  - viro bridge: `PerfMonitor.getView()` getter (every VRT navigator already registers its ViroView there — VRT3DSceneNavigator.java:198-199) so headless modules can resolve the active ViroContext without a view tag.
  - Related pre-existing (compiled, but NOT yet Java-reachable) zero-copy seam kept for v2: `VROExternalSurfaceTexture` + `VROMaterial::setExternalSurfaceTexture` (see doc/TextureBridge.md "v2").
- [x] 16KB ELF alignment enforced: `-DANDROID_SUPPORT_FLEXIBLE_PAGE_SIZES=ON` (build.gradle) + `-Wl,-z,max-page-size=16384` (CMakeLists.txt). *(2026-07-03)*
- [ ] **v2 (zero-copy AHB/EGLImage)**: wire virocore's `VROExternalSurfaceTexture` Route B through this module with a fence-gated `updateTexture` (producer side exists in `nitro-canvas-in-Vision`).
- [x] **On-device verification** *(2026-07-04, PICO 4 Ultra, decax9 orb-test)*: `ViroGPUTexture: bind(1): bound 1280x720 surface-producer texture to material 'viroMuxBridge_1'` → ExoPlayer `renderedFirstFrame(1)` / `STATE_READY` / `isPlaying(1)=true`; OpenXR scene kept rendering (OrbPass #0→#3600, PxrMetric 90/90 FPS). No GL errors.
- [x] **ExoPlayer producer** *(2026-07-04)*: `android/.../ViroMuxPlayerModule.kt` — classic RN module (`NativeModules.ViroMuxPlayer`), one `androidx.media3` ExoPlayer per texture id, `play/pause/stop`, renders into `ViroGPUTextureSurfaces.getSurface(id)`. media3 pinned `compileOnly 1.1.1` to match the app-shipped artifacts (never bundle a second copy). JS: `src/ViroMuxBridgeSurface.tsx` (movable ViroQuad + register→poll→play lifecycle), exported from index.ts. The legacy `ViroMaterialVideo` path (`ViroMuxVideo`/`ViroMuxSurface`) deadlocks OpenXR — use the bridge path.

## Phase 3 — quality gates

- [x] `npx tsc --noEmit` set up (`pnpm typecheck`).
- [x] No magic numbers — every tunable in `config/defaults.json`.
- [x] `MovableProps` + `MovableNode` exported, frozen, documented.
- [x] VR-vs-AR drag matrix in `doc/Movability.md`.
- [x] `axisLock` clamp implemented in `MovableNode`.
- [ ] Self-check in `ViroMuxSurface` covers flat/curved branches (inline assert; run via `NODE_ENV=test`).

Remaining gates apply once native work lands.
