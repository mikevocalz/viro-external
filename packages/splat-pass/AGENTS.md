# @viro-external/splat-pass — AGENTS

Read this before any work. House rules apply on top of the workspace root
CLAUDE.md.

## Scope

Native 3D Gaussian Splat (3DGS) render-pass stage for ViroCore on the
Khronos OpenXR backend. NOT a texture, NOT a geometry substrate.

The pass is inserted into `VROChoreographer` via the
`setCustomPostOpaquePass()` extension point added in
`mikevocalz/virocore` (branch `v2.55.0-nitro-canvas`). It runs:

- AFTER `_baseRenderPass->render(...)` for the eye
- BEFORE bloom / blit / post-processing / tone-mapping
- Per-eye automatically (Choreographer runs per-eye)
- Against the linear HDR target with opaque-filled depth

## Decisions baked in

These are NOT to be re-litigated by future agents — they were chosen with
hardware/architect intent against the v2.57.0 source tree.

| Decision | Choice | Rationale |
|---|---|---|
| Per-eye hook | `VROChoreographer::setCustomPostOpaquePass()` | Only path that runs in the linear HDR target before tone-map. `VROFrameListener` is per-frame, fires after both eyes. `VRODriver::didRenderEye` fires after the choreographer returns, i.e. after post-process. |
| Decode | GPU compute (GLES 3.1 SSBO + compute dispatch) | Adreno on PICO 4 Ultra and Quest 3 supports compute. CPU per-tick upload eats main-thread CPU we want for JS bridge / physics. |
| Sort | GPU bitonic sort over per-eye depth keys | Stable, in-place, fixed cost. Falls within one dispatch chain on the same SSBO line. |
| Stereo | Per-eye sort + per-eye draw | OpenXR backend renders eyes serially; no `OVR_multiview` on this path. Confirmed in `VROSceneRendererOpenXR.cpp` (eye loop at `:1018`). |
| State management | RAII `GLStateScope` | Mandatory restore of blend, depth mask, depth func, active VAO/VBO/program, bound FBO. Restore target = frame-boundary state from `VRODriverOpenGL.h:80-96`. |
| OpenXR loader | Pin ≥1.1.60 | Clears PICO OS 5.9.0 loader floor. Upstream Viro 2.57.0 ships 1.1.49. |
| 4D temporal | SSBO 4D-block over an SPZ base; compute decode of current `timestamp` into a per-frame splat SSBO | Keeps the renderer pure-GPU; no per-tick CPU upload. |
| Placeholder texture | 1×1 RGBA bound to diffuse before any swap that could hit empty-material (#436 guard) | Documented inline at the call site. |

## API surface

```ts
import { registerSplatPass, unregisterSplatPass } from '@viro-external/splat-pass';
```

The TS surface is a thin native-bridge registrar. The renderer state
lives in Zustand (see `src/store.ts`); `useState` is banned for app
state.

## Build invariants

- 16KB page-aligned `.so` (NDK r27+).
- `npx tsc --noEmit` passes on the TS wrapper from the package root.
- No stubs in delivered code — placeholders in this package are time-boxed
  in TASKS.md and never ship to consumers.

## Verify before writing native

If touching the native side:

1. `mikevocalz/virocore` branch `v2.55.0-nitro-canvas` HEAD must contain:
   - `VROChoreographer::setCustomPostOpaquePass()` declared in `.h`
   - 4 invocation sites in `VROChoreographer::renderScene` cpp
2. `mikevocalz/viro` branch `decax9-three-panel` must contain a
   `viro_renderer-release.aar` built from that virocore HEAD.
3. `org.khronos.openxr:openxr_loader_for_android:1.1.60` in
   `android/viroreact/build.gradle`.

If any of these drift, STOP and re-pin before generating C++.
