# TASKS

Ordered. Don't skip ahead. Each task isolates one failure domain so
review can sign off slice by slice.

## Milestone 0 — virocore seam (LANDED 2026-06-26)

- [x] Bump `org.khronos.openxr:openxr_loader_for_android` to 1.1.60 in
      `mikevocalz/virocore` `android/viroreact/build.gradle`.
- [x] Add `VROChoreographer::setCustomPostOpaquePass()` declaration to
      `ViroRenderer/VROChoreographer.h`.
- [x] Wire 4 invocation sites in `ViroRenderer/VROChoreographer.cpp` —
      one per render-path branch (HDR-bloom / HDR-no-bloom / MRT-RTT /
      direct-to-display).
- [x] Build `viroreact-release.aar` against the bump + hook.
- [x] Refresh `mikevocalz/viro` `android/viro_renderer/viro_renderer-release.aar`.

## Milestone 1 — TypeScript surface (LANDED 2026-06-26)

- [x] `src/store.ts` — Zustand store for splat-pass state.
- [x] `src/index.ts` — `registerSplatPass` / `unregisterSplatPass`.
- [x] `src/types.ts` — SplatPassOpts, SplatPassHandle, SplatPassMetrics.
- [x] `src/NativeSplatPass.ts` — `NativeModules.ViroSplatPass` probe.
- [x] `npx tsc --noEmit` passes.

## Milestone 2 — Shaders (LANDED 2026-06-26)

- [x] `shaders/splat.vert` — EWA projection + 2D Gaussian construction.
- [x] `shaders/splat.frag` — Gaussian alpha + premultiplied output.
- [x] `shaders/splat_sort.comp` — bitonic sort over depth keys
      (workgroup size patched at compile via `SPLAT_SORT_LOCAL_SIZE`).
- [x] `shaders/splat_decode.comp` — SPZ temporal evaluation + degenerate
      static-3D path.
- [x] `native/include/ShaderSources.h` — GLSL embedded as C++ raw
      string literals for VROSplatRenderPass to compile.

## Milestone 3 — Native pass

- [x] `native/{include,src}/VROSplatRenderPass.{h,cpp}` — subclass
      `VRORenderPass`. Three SSBOs, one program per shader, GLStateScope.
- [x] `native/{include,src}/GLStateScope.{h,cpp}` — RAII save/restore.
- [x] `native/{include,src}/SplatBuffers.{h,cpp}` — triple-buffered SSBO
      ring with one-shot maxSplats warning.
- [x] `native/{include,src}/ViroSplatPassRegistry.{h,cpp}` — process
      singleton mapping id → shared_ptr<VROSplatRenderPass>.
- [x] `native/src/ViroSplatPassJNI.cpp` — JNI symbols for
      `com.viromedia.bridge.module.ViroSplatPassModule`.
      Unwraps virocore PersistentRef<VROChoreographer> from jlong,
      forwards into the registry.
- [x] `native/CMakeLists.txt` — produces `libsplat_pass.so`. Requires
      `-DVIROCORE_INCLUDE_DIR` + `-DVIROCORE_ANDROID_INCLUDE_DIR` from
      the host gradle. NO virocore vendoring.
- [x] **virocore** `Renderer.java::getChoreographerRef()` +
      `releaseChoreographerRef(long)` + JNI impl
      `nativeGetChoreographerRef` / `nativeReleaseChoreographerRef` in
      `VRORenderer_JNI.cpp`. Returns a PersistentRef<VROChoreographer>
      handle. **Requires virocore rebuild.**
- [x] **viro_bridge** `ViroSplatPassModule.java` — registers
      `NativeModules.ViroSplatPass`, resolves scene-nav view tag →
      `VRT3DSceneNavigator.getViroView().getRenderer().getChoreographerRef()`,
      forwards to `libsplat_pass.so`.
- [x] **viro_bridge** `VRT3DSceneNavigator.getViroView()` accessor +
      `ReactViroPackage` registration of the new module.

> Skipped: `SplatSorter` wrapper class. Sort dispatch lives inline in
> VROSplatRenderPass.cpp::runSortPass(). Pull out when a second consumer
> needs the sort independently.

## Milestone 4 — SPZ decoder (PARTIAL 2026-06-26)

- [x] `native/{include,src}/SpzReader.{h,cpp}` — header parse + magic
      validation. Self-check passes (too-small, bad magic, good v=2 +
      antialiased flag).
- [x] **Quantized body decode**: i24 positions (with fractionalBits
      divisor), i8 quaternion with positive-w reconstruction +
      normalize, u8 alpha + RGB + log-scale. Output is direct
      raster-shader `Splat` float32 (64 bytes/splat). Self-check
      validates synthetic round-trip on a 1-splat body.
- [x] SH tail length validation — files with shDegree > 0 parse
      cleanly. Decode of SH coefficients deferred until raster shader
      gains view-dependent shading.
- [x] **GPU upload on attach**: JNI nativeAttach takes `byte[] spzBytes`,
      decodes via SpzReader, calls `pass->stagePendingSource(...)`. The
      pass uploads to the decoded-splats SSBO on the next render frame.
- [x] **Java-side fetcher**: file://, content://, http(s)://, bare paths
      — all flow through `ViroSplatPassModule.fetchSourceBytes()` on a
      worker thread before nativeAttach runs.
- [ ] 4D delta block reader. Same shape but stride × frameCount; needs
      a 4D fixture to test against.
- [ ] Per-frame compute decode dispatch in `splat_decode.comp` (only
      relevant for 4D — static 3D bypasses decode since SpzReader
      emits the raster format directly).
- [ ] Fuzz the parser against fixtures from a published 4D dataset.

## Milestone 5 — Wire to existing `@viro-external/core/splat` (PARTIAL 2026-06-26)

- [x] `ViroGaussianSplat.tsx` calls `registerSplatPass` on mount and
      `release()` on unmount via try/catch require of
      `@viro-external/splat-pass`. Honest fall-through when the package
      isn't installed (legacy path stays the only option).
- [x] Capability probe in `NativeSplatRenderer.ts` is now the union of
      `NativeModules.ViroSplatRenderer` (legacy) and
      `NativeModules.ViroSplatPass` (this work).
- [x] Honest error surface when neither path is present — no
      particle-field fallback. (Unchanged from baseline.)
- [x] Pure splat-pass path: ViroGaussianSplat drops the placeholder
      ViroQuad when `isNativeSplatPassAvailable()`. MovableNode wrapper
      stays for hit-test / drag affordances.
- [x] Device profile detection: `VROSplatRenderPass::lazyInit` reads
      `glGetString(GL_RENDERER)` once, publishes `quest3` / `quest2` /
      `mali` / `powervr` / `unknown` to the JNI deviceProfile() call.
- [x] `INTEGRATION.md` — host-app wiring docs (gradle, CMake -D vars,
      logcat tags, supported URI schemes).

## Milestone 6 — On-device validation

- [ ] PICO 4 Ultra: compute dispatch fires, no GL_INVALID_OPERATION,
      sort produces back-to-front order against a fixed view.
- [ ] Quest 3: same checks, multiview disabled (serial eye loop).
- [ ] State leak check: render orb route after splat unmount — opaque
      geometry must look identical pixel-for-pixel to a no-splat run
      (use the existing decax9 orb screenshot harness).

## Not in scope

- WebGPU / TypeGPU. This package is GLES-only via Viro's existing
  `VROChoreographer`. A separate `@viro-external/splat-pass-wgpu`
  package can land later when react-native-wgpu is on PICO.
- Skinning / animation on the splat set beyond the SPZ 4D delta blocks.
- iOS Metal port. Same plumbing in spirit, different rendering layer;
  separate milestone.
