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

## Milestone 1 — TypeScript surface

- [ ] `src/store.ts` — Zustand store for splat-pass state (registration,
      device profile, splat counts per registered pass).
- [ ] `src/index.ts` — `registerSplatPass(opts) => SplatPassHandle` and
      `unregisterSplatPass(handle)`. Pure native-bridge registrar; no
      React hooks. Caller composes into their own component.
- [ ] `src/types.ts` — SplatPassOpts (source, timestamp accessor, max
      splat count, quality knob), SplatPassHandle, SplatPassMetrics.
- [ ] `src/NativeSplatPass.ts` — `NativeModules.ViroSplatPass` capability
      probe, mirrors `viro-external-core/src/splat/NativeSplatRenderer.ts`.
- [ ] `npx tsc --noEmit` passes.

## Milestone 2 — Shaders

- [ ] `shaders/splat.vert` — projects each splat to screen, computes 2D
      covariance from the per-eye view matrix, writes depth-key into the
      sort SSBO, emits the per-splat quad.
- [ ] `shaders/splat.frag` — evaluates the 2D Gaussian alpha, mixes the
      per-splat colour through SH if SH coefficients present in the
      source, premultiplied output for blend.
- [ ] `shaders/splat_sort.comp` — GPU bitonic sort over the per-eye
      depth-key SSBO. Workgroup size targets Adreno (32) and Mali (64)
      gracefully; pick at compile via specialization or branch on
      `gl_NumWorkGroups`.
- [ ] `shaders/splat_decode.comp` — temporal evaluation: reads the SPZ
      base block + 4D delta blocks, writes the per-splat live SSBO for
      the current `timestamp`. Static 3D is the degenerate path (memcpy).

## Milestone 3 — Native pass

- [ ] `native/VROSplatRenderPass.{h,cpp}` — subclass `VRORenderPass`.
      Owns three SSBOs (decoded splats, sort keys, indirect draw args),
      one program per shader, and a `GLStateScope` instance.
- [ ] `native/GLStateScope.{h,cpp}` — RAII save/restore for blend,
      depth mask, depth func, active VAO/VBO, current program, bound
      FBO. Verified against `VRODriverOpenGL.h:80-96` frame-boundary
      contract.
- [ ] `native/SplatBuffers.{h,cpp}` — triple-buffered SSBO ring for the
      per-frame splat sets; resize-on-grow with one-shot warning if a
      consumer requests more splats than `maxSplats`.
- [ ] `native/SplatSorter.{h,cpp}` — wraps the sort dispatch + key
      packing (depth fp16 hi-bits, splat-id lo-bits — standard 2-pass
      bitonic key).
- [ ] `native/ViroSplatPassModule.{h,cpp}` — JNI bridge surface for the
      RN module. Hands a `std::shared_ptr<VROSplatRenderPass>` to the
      active `VROChoreographer` via `setCustomPostOpaquePass`.

## Milestone 4 — SPZ decoder

- [ ] CPU SPZ binary reader (header + base block + 4D delta blocks).
- [ ] Upload base + deltas to GPU SSBO at registration time.
- [ ] Per-frame compute decode dispatch in `splat_decode.comp`.
- [ ] Fuzz the parser against fixtures from a published 4D dataset.

## Milestone 5 — Wire to existing `@viro-external/core/splat`

- [ ] `ViroGaussianSplat.tsx` calls `registerSplatPass` on mount and
      `unregisterSplatPass` on unmount.
- [ ] Capability probe in `NativeSplatRenderer.ts` becomes the union of
      `NativeModules.ViroSplatRenderer` (legacy) and
      `NativeModules.ViroSplatPass` (this work) for backwards-compat.
- [ ] Honest error surface when the native pass is absent — no
      particle-field fallback.

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
