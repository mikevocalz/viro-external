# viro-external — DECISIONS.md (workspace-level)

## 2026-10-01 — Viro 3 / Expo SDK 58 baseline

The July 2026 dependency matrix is historical. The active workspace baseline is now:

| Package / tool | Active baseline |
|---|---|
| `@reactvision/react-viro` | **3.0.1** upstream; local Moyo fork is **3.0.1-moyo.0** |
| `expo` | **SDK 58 / 58.x** |
| `react-native` | **0.88.0-rc.3** (SDK 58 line) |
| `react` | **19.3.0** |
| `react-native-nitro-modules` / `nitrogen` | **0.37.1 / 0.37.1** |
| `@expo/config-plugins` | **58.0.4** |
| `expo-modules-core` | **58.0.9** |
| `zustand` | **5.0.15** |
| `sharp` | **0.35.4** |
| `lucide-static` | **1.49.0** |
| `typescript` | **7.0.2** |
| `pnpm` | **12.8.1** |

### Compatibility rules

1. **Viro 2.x is no longer a valid workspace target.** Every external package must declare a Viro 3 peer range.
2. **Expo SDK 58 wins over the generic npm `react-native@latest` tag.** SDK 58 is on the React Native 0.88 line; do not downgrade to RN 0.87 just because npm's generic latest tag temporarily points there.
3. The root `pnpm.overrides["@reactvision/react-viro"] = "link:../viro"` is intentional for side-by-side development against the Moyo Viro fork. That sibling checkout must be Viro 3.x.

   It costs one extra step. A linked checkout ships `.d.ts` files that `import * as React from "react"`, and resolves that import from its own `node_modules` — which a bare `git clone` does not have. React then resolves to nothing, `React.Component` comes out empty, and every package that renders a Viro component fails with `'ViroNode' cannot be used as a JSX component` (TS2786/TS2607). `skipLibCheck: true` hides the underlying TS2307 inside the fork, so only the call sites report and the cause is not obvious.

   Run `pnpm hydrate:viro-types` after `pnpm install`. It symlinks `react`, `react-native` and `@types/react` from an installed workspace package into the checkout. It is idempotent, it reads the `link:` target out of `pnpm-workspace.yaml` rather than assuming `../viro`, and it no-ops when the checkout brought its own dependencies. Every workflow that typechecks Viro-facing packages calls it.
4. Nitro runtime and Nitrogen codegen move together. After a Nitro version change, regenerate the committed `nitrogen/generated` trees before merging.
5. Package peers are ranges for consumers; workspace dev dependencies are pinned to the validated SDK 58 toolchain.
6. TypeScript is a build-time tool here, so the workspace tracks the current stable compiler rather than Expo's starter-template TypeScript pin. CI/typecheck is the gate for compiler compatibility.
7. pnpm 12 stays pinned for CI, but `pmOnFail: ignore` keeps `pnpm-lock.yaml` single-document so GitHub's dependency graph and Dependabot can continue to read the project dependency graph.

## 2026-07-09 — PROMPT 21 Phase 0: version manifest re-resolution

Re-resolved against npm + Google Maven (`npm view`, `dl.google.com/android/maven2`):

| Package | Manifest pin | Resolved today | Drift |
|---|---|---|---|
| `expo` | 57.0.4 | **57.0.4** | none |
| `react-native` | 0.86.0 | **0.86.0** | none |
| `react-native-nitro-modules` / `nitrogen` | 0.36.1 | **0.36.1 / 0.36.1** | none |
| `@reactvision/react-viro` | 2.57.3 | **2.57.3** | none |
| `@fishjam-cloud/react-native-client` | 0.28.3 | **0.28.3** | none |
| `androidx.media3` | resolve at execution | **1.10.1** (latest stable; 1.11.0-beta01 excluded) | see note |
| reanimated / worklets / gesture-handler | 4.5 / 0.10 / 2.32 | **4.5.1 / 0.10.2 / 3.0.2** | gesture-handler is 3.x on npm latest — SDK 57 bundles 2.32; follow `npx expo install --fix`, never npm latest |

**media3 note:** consuming app (decax9) + virocore `AVPlayer` currently pin **1.1.1**;
workspace rule is ONE ExoPlayer copy (`react-native-viro-mux` declares media3
`compileOnly`). The 1.1.1 → 1.10.1 bump is a G5 decision: read media3 release
notes for `SurfaceTexture` / `VideoFrameMetadataListener` changes AND check what
virocore 2.57.3's `AVPlayer.java` (rewritten in #344) expects, then move app +
virocore + mux together.

## 2026-07-09 — G0 fork assessment (drift from prompt assumptions)

1. **Fork base is `v2.57.2`, NOT 2.56.0.** `~/virocore` = `v2.57.2-16-g186d2145`,
   16 commits ahead (15 ours + 1 upstream-merge). The 2.56.0 claim in the prompt
   is stale. G0 is a mechanical 15-patch cherry-pick onto `v2.57.3`.
2. **Upstream `v2.57.2..v2.57.3` = one squash (#344):** drops `libvrapi.so` /
   deprecates OVR (fixes the Android 16KB launch crash — directly serves our
   16KB mandate), `AVPlayer.java` lifecycle rewrite (ViroVideo teardown
   deadlocks), `VideoTexture` fixes, iOS LiDAR/AR fixes. **No changes** to
   `VRORenderPass`, choreographer pass hooks, texture substrate, or
   `VROSceneRendererOpenXR` → §2/§5 architecture assumptions hold.
3. **Conflict surface (files both sides touch):** `android/sharedCode/CMakeLists.txt`,
   `cpp/jni/VRORenderer_JNI.cpp`, `java/com/viro/core/Renderer.java` —
   our `getChoreographerRef` JNI accessor + custom-pass registration vs their
   OVR removal.
4. **The fork's extension-pass mechanism is `VROChoreographer.setCustomPostOpaquePass`
   + `Renderer.getChoreographerRef()`** — there is no `VROMultiplexRenderPass`
   in this fork's stack (prompt terminology is stale). orb-pass / splat-pass
   attach via the choreographer hook. pano-pass must re-validate its "draws
   first, background" requirement against the choreographer's available hook
   points; note virocore's existing portal-background sphere (our 360 fixes
   already patch `VROPortal.cpp`) is a candidate pre-existing seam for the
   pano sphere instead of a brand-new pass. Decide at G2 design, record here.

## Fork patch stack (v2.57.2..HEAD, to be cherry-picked onto v2.57.3)

017fb6aa PICO compat: OpenXR scene-renderer + multi-profile controller bindings
af7fc39b Add VROExternalSurfaceTexture + surface_texture shader-modifier hook
c028a6c1 VROExternalSurfaceTexture per-platform import (iOS / visionOS / Android)
2a8edc15 Trim VROExternalSurfaceTexture file headers + drop section dividers
701b57e3 Nitro Canvas: propagate _shaderUniformTextures through material copy
61ca87e4 ViroViewOpenXR: stop swallowing KEYCODE_BACK in panel-mode dev builds
83b7f427 VROChoreographer: setCustomPostOpaquePass + OpenXR loader 1.1.60
0e3dd083 Renderer: getChoreographerRef JNI accessor for extension passes
0d732997 fix(openxr): create passthrough layer paused — fixes PICO passthrough
8895f9a5 docs: note for upstream PICO passthrough PR
434737e6 WIP: input controller, Gizmo drag type, ExternalSurfaceTexture bridge
cf3863af feat(openxr): JS-triggerable controller haptics
9685f1a8 fix(openxr): 360 background artifacts + passthrough-toggle crash
37b16e5b fix(openxr): per-eye FBO + own depth renderbuffer — fixes right-eye artifact
186d2145 fix(360): Repeat wrapS on background sphere — kills equirect seam speckle

## 2026-07-09 — G0 rebase executed

- Branch `v2.57.3-xr` in `~/virocore`: all 15 fork patches cherry-picked onto
  `v2.57.3` with ZERO conflicts (the 3-file overlap auto-merged; verified
  `getChoreographerRef`/`setCustomPostOpaquePass` and the OVR removal both
  survived — vrapi references remaining in CMakeLists are comments only).
- `:viroreact:assembleRelease` builds clean (1m44s). AAR dropped into
  `~/viro/android/viro_renderer/viro_renderer-release.aar`.
- **16KB check (G2 pre-verified):** every `.so` in the AAR has LOAD align
  ≥ 0x4000 (libgvr* at 0x10000). `libvrapi.so` no longer ships.
- `-Wl,-z,max-page-size=16384` was already present upstream
  (sharedCode/CMakeLists.txt:528) — our packages' CMake must match (G1).
- **G0 remaining (blocked on device):** orb-pass + splat-pass on-device 72fps
  re-verification on PICO OS6 + Quest 3S — Quest currently disconnected from
  adb. App-side note for that build: purge stripped/merged native-lib
  intermediates in the consumer app or Gradle serves the STALE renderer .so
  (verify against merged_native_libs, not stripped).
