# @viro-external/render-passes — TASKS

Day-one state: spec-only. Native + TS surface not yet implemented.

## Sequence — do not reorder

1. **Resolve SEAMs blocking implementation** (spec §8)
   - [x] `VROMatrix4f` layout — column-major confirmed (`VROMatrix4f.cpp:191/211/236/321`). GLSL upload path can use `GL_FALSE` for transpose.
   - [ ] Decide final package name (`render-passes` in day-one skeleton; alternate `xr-pass`).
   - [x] Grep D.E.C.A. orb source — `~/orb` uses classic **WebGL2 + EffectComposer + ShaderMaterial.onBeforeCompile GLSL**, NOT WebGPU / TSL. Spec §5 corrected. `~/decax9/app/orb.tsx` is a separate Viro-native orb; unrelated.
   - [ ] **NEW SEAM (tone-map / bloom parity)** — the three.js orb uses `ACESFilmicToneMapping` + `UnrealBloomPass`. Wire Viro's `VROChoreographer::getToneMapping()` + `getGaussianBlurPass()` equivalents at scene init and screenshot-diff against the reference orb before migration ships.

2. **Native scaffold** — done
   - [x] `native/include/VROMultiplexRenderPass.h` + `.cpp` — subclass
         `VRORenderPass`, sorted-by-priority child vector, snapshot-under-lock
         dispatch, `MultiplexPass:` probe log. No `GLStateScope` wrap on
         children (per contract).
   - [x] `native/include/ViroExternalPassRegistry.h` + `.cpp` — one
         multiplex per choreographer, installed on first attach via
         `setCustomPostOpaquePass(multiplex)`, uninstalled when child count
         hits zero.
   - [x] `native/src/ViroExternalPassJNI.cpp` — diagnostics-only
         (`nativeChildCount`, `nativeChildIds`). Attach path is C++-only
         because `shared_ptr<VRORenderPass>` doesn't cross JNI cleanly;
         sibling packages link against this .so directly.
   - [x] `native/CMakeLists.txt` — produces `libviro_external_render_passes.so`,
         requires `VIROCORE_INCLUDE_DIR`, `VIROCORE_ANDROID_INCLUDE_DIR`,
         `VIROCORE_LIB_DIR` from the host gradle.
   - [x] **Gradle host wiring** — resolved by conversion to Expo module.
         `expo-module-gradle-plugin` autolinks via `expo-module.config.json`;
         the host app only needs `VIROCORE_INCLUDE_DIR` / `VIROCORE_ANDROID_INCLUDE_DIR` /
         `VIROCORE_LIB_DIR` in its root `build.gradle` (same three vars splat-pass
         already requires, so this is zero net cost).

2a. **Expo module surface** — done
   - [x] `expo-module.config.json` — declares `RenderPassesModule` on Android.
   - [x] `android/build.gradle` — uses `expo-module-gradle-plugin`,
         `externalNativeBuild` points at `../native/CMakeLists.txt`.
   - [x] `android/src/main/AndroidManifest.xml` — empty stub, required by AGP.
   - [x] `android/src/main/java/expo/modules/renderpasses/RenderPassesModule.kt` —
         `Module()` DSL: `childCount`, `childIds` Function decls.
   - [x] `android/src/main/java/expo/modules/renderpasses/RenderPassesNative.kt` —
         top-level `object` holding `external fun` decls; loads `viro_external_render_passes`.
   - [x] `native/src/ViroExternalPassJNI.cpp` — symbol names retargeted to
         `Java_expo_modules_renderpasses_RenderPassesNative_*`.
   - [x] `src/index.ts` — `requireOptionalNativeModule('RenderPasses')`,
         re-exports `isAvailable`, `childCount`, `childIds`.

3. **TS bridge**
   - [ ] `src/NativeRenderPasses.ts` — Turbo module surface.
   - [ ] `src/store.ts` — Zustand mirror (registered pass list, per-child metrics).
   - [ ] `src/index.ts` — `registerRenderPass` / `unregisterRenderPass` +
         re-exports. Mirrors `@viro-external/splat-pass/src/index.ts` shape.
   - [ ] `src/types.ts` — `RenderPassKind`, `RenderPassOpts`, `RenderPassHandle`.

4. **splat-pass migration** — done at the C++ layer
   - [x] `splat-pass/native/src/ViroSplatPassRegistry.cpp` — attach now calls
         `ViroExternalPassRegistry::attachChild(choreo, pass, cfg.priority)`
         instead of `choreo->setCustomPostOpaquePass(pass)`. Detach calls
         `detachChild(id)`. Old direct-attach path deleted, no fallback.
   - [x] `splat-pass/native/CMakeLists.txt` — links against
         `libviro_external_render_passes.so`, requires new cache vars
         `RENDER_PASSES_INCLUDE_DIR` / `RENDER_PASSES_LIB_DIR` from host gradle.
   - [x] Host gradle wiring (decax9):
         • `decax9/package.json` — added `@viro-external/render-passes` file: link
         • `splat-pass/plugin/index.js` — plugin now emits BOTH `add_subdirectory`
           lines (render-passes before splat-pass). Survives `expo prebuild --clean`.
         • `decax9/android/app/src/main/jni/CMakeLists.txt` — matches plugin output.
         • No new gradle cache vars — render-passes only needs the same three
           virocore paths splat-pass already sees via inheritance.
   - [x] .so build verified — `libviro_external_render_passes.so` (1.34 MB) and
         `libsplat_pass.so` (1.5 MB) both link cleanly. Splat-pass has expected
         undefined refs to `ViroExternalPassRegistry::{attachChild, detachChild, shared}`,
         resolved at load time via DT_NEEDED. Direct CMake build; full gradle
         `assemblePicoDebug` blocked by unrelated `react-native-webgpu` (needs API 26)
         and expo-modules-core JSI drift (needs RN 0.86).
   - [ ] Bump decax9 to current npm packages (per feedback_current_packages):
         • `react-native` 0.85 → 0.86, `expo` 56 → 57 with expo-* companions
         • `minSdkVersion` 24 → 26 to satisfy react-native-webgpu@0.5.16 AHardwareBuffer refs
         • This is a separate multi-step operation; queued but not attempted here.
   - [ ] `splat-pass/src/index.ts` still uses its own JS registrar shape;
         no JS change needed since ids remain opaque strings (contract
         preserved — `ext-N` instead of `splat-N`, but consumers treat as opaque).

5. **Six-gate on-device verification** (spec §6)
   Setup: install `~/decax9/android/app/build/outputs/apk/pico/debug/app-pico-debug.apk`
   on PICO. Metro: `EXPO_UNSTABLE_MCP_SERVER=1 npm start` from `~/decax9`.
   For gate 5, use the canary — `attachNoOp(getChoreographerRef(), 0)` from
   `@viro-external/render-passes` before splat-pass registers.
   - [ ] Gate 1: `MultiplexPass: installed on choreographer=0x...` on first attach.
   - [ ] Gate 2: `MultiplexPass: dispatch #0 children=1 [ext-0]` within 1 frame.
         `NoOpPass: render() #0 eye=0 frame=...` from the canary.
   - [ ] Gate 3: `NoOpPass: render() ... eye=0` AND `eye=1` in same frame batch.
   - [ ] Gate 4: (orb-only) skipped for canary — no draws to check.
   - [ ] Gate 5: canary + splat both fire — `MultiplexPass: dispatch #60 children=2 [ext-0, ext-1]`.
   - [ ] Gate 6: `detachNoOp(id)` → `MultiplexPass: detach id=ext-0 children=1`, splat still draws.
         Detach splat too → `MultiplexPass: uninstalled from choreographer=0x...`.
