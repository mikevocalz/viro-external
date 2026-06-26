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

## Phase 2 — Native deliverables (PENDING — requires fork work)

- [ ] `src/spec/ViroGPUTextureModule.nitro.ts` — Nitro HybridObject spec.
- [ ] `ios/HybridViroGPUTextureModule.{h,mm}` — Metal/IOSurface binding.
- [ ] `android/.../HybridViroGPUTextureModule.kt` + JNI — OpenGL ES binding.
- [ ] `react-native-viro-mux.podspec` + `build.gradle`.
- [x] **virocore fork work** (per Appendix A point 1): cross-platform C++ `VROExternalTextureBridge::installExternalTextureOnMaterial` lives in `ViroRenderer/VROExternalTextureBridge.{h,cpp}` (works on both Android and iOS — VRO_METAL=0). Android surface: `com.viro.core.Renderer.registerExternalTexture(...)` + JNI in `VRORenderer_JNI.cpp`. iOS surface: `VROExternalTextureBridgeiOS` ObjC++ class wired into `ViroRenderer.xcodeproj`. See `mikevocalz/virocore` `docs/EXTERNAL-TEXTURE-BRIDGE.md`.
- [ ] 16KB ELF alignment enforced in Android `build.gradle` link flags.

**Why deferred:** these require reading ViroKit private headers (iOS) and writing a new JNI bridge in `mikevocalz/virocore` (Android). Doing them safely needs a focused pass on the fork; shipping them as stubs would violate the prompt's "no stubs" rule.

## Phase 3 — quality gates

- [x] `npx tsc --noEmit` set up (`pnpm typecheck`).
- [x] No magic numbers — every tunable in `config/defaults.json`.
- [x] `MovableProps` + `MovableNode` exported, frozen, documented.
- [x] VR-vs-AR drag matrix in `doc/Movability.md`.
- [x] `axisLock` clamp implemented in `MovableNode`.
- [ ] Self-check in `ViroMuxSurface` covers flat/curved branches (inline assert; run via `NODE_ENV=test`).

Remaining gates apply once native work lands.
