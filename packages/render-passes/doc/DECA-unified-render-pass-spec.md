# D.E.C.A. — Unified ViroCore Custom Render Pass (Orb + Splat)

**Status: grounded in confirmed reads of virocore headers/source, `@viro-external/splat-pass`, and `VRORenderContext`/`VROChoreographer`/`VROSceneRendererOpenXR`. Every claim below is either confirmed-by-read (cited to file:line) or explicitly marked SEAM. Nothing here is invented.**

This supersedes the earlier texture-bridge draft (`DECA-webgpu-viro-bridge-spec.md`). That draft assumed a producer/consumer texture handoff. The real architecture is a **single custom render pass inside Viro's own per-eye OpenXR loop** — no bridge, no texture handoff, no double-buffer/fence machinery. Viro owns the frame; the orb and the splat renderer are both draws issued inside it.

---

## 0. The one fact that shapes everything downstream

`VROChoreographer` has a **single** `_customPostOpaquePass` slot (`VROChoreographer.h:236`). Registering a second custom pass **overwrites the first.** `@viro-external/splat-pass`'s registry pattern only tracks one entry per choreographer.

This means the orb cannot simply register its own `setCustomPostOpaquePass` alongside splat-pass — the second registration would silently kill the first. **A multiplexing pass is not optional; it is the load-bearing requirement for orb + splat to coexist at all.**

---

## 1. What was actually read, and where the gaps are

| File | Confirmed | SEAM (unread / unconfirmed) |
|---|---|---|
| `VROFrameListener.h` | Two virtuals — `onFrameWillRender`, `onFrameDidRender` — fire once per **frame** (not per eye) via `VRORenderer::notifyFrameStart()`/`notifyFrameEnd()` inside `prepareFrame`/`endFrame`. | Not a draw hook. Ruled out for rasterization. |
| `VROSceneRendererOpenXR.h/.cpp` | Per-eye loop in `renderFrame()` (:1167–1180) calls `renderEye(eyeIndex, XrView, VROOpenXRSwapchain)`. Inside (:1246–1297): swapchain acquire → `display->bind()` (FBO, `setClearAlpha(0)` for passthrough) → `viewMatrix = xrPoseToMatrix(view.pose).invert()` → `projMatrix = xrFovToProjection(view.fov)` → `_renderer->renderEye(eyeType, viewMatrix, projMatrix, viewport, _driver)` → release. Passthrough composites as a separate `XrCompositionLayerPassthroughFB` beneath the projection layer. | Exact depth-attachment format on the swapchain FBO (`VRODisplayOpenGLOpenXR`) — matters only if orb needs to occlude splats (out of scope). |
| `VROTextureSubstrateMetal.h` / `VROTextureSubstrateOpenGL.h` | Both are **wrap-existing-texture** constructors, not allocators: `VROTextureSubstrateOpenGL(GLenum target, GLuint name, shared_ptr<VRODriverOpenGL> driver, bool owned=true)`; `VROTextureSubstrateMetal(id<MTLTexture> texture)`. | Unused in this architecture — kept in reserve, not part of the unified-pass design. |
| `requiresSceneDepth` / `VROMaterialSubstrateOpenGL` | `VROShaderModifier::setRequiresSceneDepth(bool)` auto-resolves a `scene_depth_texture` sampler bound from `VRORenderContext::_sceneDepthTexture` (`VROMaterialShaderBinding.cpp:204`). **This is read-only depth sampling from a material's fragment shader — not a custom-draw hook.** Gated to HDR-enabled. | `VROMaterialSubstrateOpenGL.h/.cpp` only shallow-scanned; confirmed no `render()` override lives there. |
| `@viro-external/splat-pass` | `VROSplatRenderPass final : public VRORenderPass` (`VROSplatRenderPass.h:59`). `render(scene, outgoingScene, VRORenderPassInputOutput&, VRORenderContext*, shared_ptr<VRODriver>&)`. Reads `context->getViewMatrix()`, `getProjectionMatrix()`, `getFrame()`. GL state RAII via `GLStateScope`. Per-eye decode-skip via `frame == _lastDecodedFrame`. Installed via `ViroSplatPassRegistry::attach(choreographer, SplatPassConfig)` → `choreo->setCustomPostOpaquePass(pass)`. JS resolves the choreographer via `Renderer.getChoreographerRef()` (`Renderer.java:385` → `nativeGetChoreographerRef` in `VRORenderer_JNI.cpp:188`) returning a `jlong` to the `shared_ptr<VROChoreographer>`. | `SplatPassConfig` has no explicit per-eye toggle — relies on `context->getFrame()` monotonicity. `context->getEyeType()` exists (`VRORenderer.cpp:552`) but splat-pass doesn't consume it today. |

**The fork point, stated plainly:** `requiresSceneDepth` is *not* the draw hook. The actual custom-draw hook is `VROChoreographer::setCustomPostOpaquePass` (`VROChoreographer.h:92`) — same mechanism splat-pass already uses. There is no separate "modifier system" path for this; extend the render-pass mechanism, not the material-modifier system.

---

## 2. Insertion point

Both orb and splat draws issue from `VRORenderPass::render(...)` on the pass installed at `VROChoreographer::setCustomPostOpaquePass(...)`.

**Call chain:** `VROSceneRendererOpenXR::renderEye` (per eye) → `VRORenderer::renderEye()` (`VRORenderer.cpp:564`) → `_choreographer->render(eye, scene, ..., context, driver)` → the installed custom pass.

**At invocation**, the eye's HDR render target is already bound as `inputs.outputTarget` with depth filled by the prior opaque pass. Choreographer state contract (`VROChoreographer.h:82-88`): `DEPTH_TEST=on`, `DEPTH_MASK=GL_TRUE`, `DEPTH_FUNC=GL_LEQUAL`, `STENCIL_TEST=on`, `CULL_FACE=off`, `BLEND=on` (`SRC_ALPHA`/`1-SRC_ALPHA`). The pass owns state save/restore — splat-pass does this via `GLStateScope`; the orb pass must too.

**"Orb always in front, no mutual occlusion required" (confirmed scope)** → orb draws with `glDepthFunc(GL_ALWAYS)` (or `glDisable(GL_DEPTH_TEST)`) inside its own `GLStateScope`. Splat draws keep depth-test on, occluding against the opaque scene as designed.

Because the choreographer slot is single, **the installed pass must multiplex.**

### 2.1 New: `VROMultiplexRenderPass`

A new class, `VROMultiplexRenderPass final : public VRORenderPass`, in this package (`@viro-external/render-passes`). Holds `std::vector<std::shared_ptr<VRORenderPass>>` in priority order, iterates inside `render()`. `VROSplatRenderPass` becomes one child; the orb pass becomes another.

**Do not modify `VROChoreographer` to hold a list** — that would fork virocore itself, which the project's own constraint (no invented APIs / minimal fork surface) argues against. The multiplex pass is a userland composition, not a core change.

Naming (SEAM — provisional): `@viro-external/render-passes` used throughout this doc and the day-one skeleton. Alternate name floated in the original prompt is `xr-pass`. Rename before native code lands if the alternate is preferred.

---

## 3. Shared contract

The shared interface **already exists in virocore** — it's `VRORenderPass::render(scene, outgoingScene, inputs, context, driver)`. Both orb and splat pass instances implement it. Nothing new needed at the native interface level.

JS-facing side mirrors `registerSplatPass`/`unregisterSplatPass` (`src/index.ts:67`): add a `kind: 'orb' | 'splat'` field and per-kind config sub-object. One JS registrar per kind, one native multiplex registry per choreographer.

```ts
// New file — mirrors splat-pass/src/types.ts shape. Do NOT introduce a new abstract type.
export interface OrbPassOpts {
  sceneNavTag: number;         // same tag→choreographer resolution as splat
  geometry: OrbGeometrySpec;   // three.js scene graph, author-time input only
  shader: TSLShaderSpec;       // TSL author-time input, compiled to GLSL ES 3.00
  priority?: number;           // higher = drawn later inside the multiplex pass
}
```

Both orb and splat share:
- `sceneNavTag: number` — `findNodeHandle` result, resolved to `Renderer.getChoreographerRef()` in the JNI shim
- `priority?: number` — ordering within the multiplex pass
- Handle shape from `SplatPassHandle` — `id`, `release()`, plus per-kind metrics accessors

**What's genuinely shared vs. not — stated honestly, not force-unified:**

- **Depth-sort and stereo/multiview machinery do NOT unify.** Splat's sort is a CPU bucket sort on a worker thread (`VROSplatRenderPass.h:104-113`), keyed on view matrix, publishing a sorted index SSBO. The orb is a small mesh — GPU depth-test is sufficient, it needs no sort. Forcing a shared sort pipeline here would be over-engineering for no benefit.
- **What actually unifies:** the `VRORenderPass::render()` interface, the multiplex dispatch, and the per-eye matrix source (`context->getViewMatrix()/getProjectionMatrix()/getEyeType()/getFrame()`). That's the real, meaningful unification — not "one shared renderer," but "one shared insertion point and one shared context contract."

This is a correction from the earlier draft's framing: "unify orb + splat into one pass" means *one multiplexed insertion point*, not one shared rendering algorithm. The two draws remain algorithmically independent children of `VROMultiplexRenderPass`.

---

## 4. Per-eye matrix sourcing

Reuse `VRORenderContext` accessors. **Do not recompute eye offsets or reimplement IPD math anywhere in the orb pass** — this was a real risk called out in the earlier stereo discussion, and it's now closed: the accessor chain already exists and splat-pass already depends on it.

| Value | Accessor | Set where |
|---|---|---|
| View matrix (eye-space) | `context->getViewMatrix()` | `VRORenderer::renderEye()` (`VRORenderer.cpp:550`), from `xrPoseToMatrix(view.pose).invert()` (`VROSceneRendererOpenXR.cpp:1281`) |
| Projection matrix | `context->getProjectionMatrix()` | `VRORenderer.cpp:551`, from `xrFovToProjection(view.fov)` (`:1282`) |
| Eye type | `context->getEyeType()` — `VROEyeType::Left/Right/Monocular` | Set via `context->setEyeType(eye)` at `VRORenderer.cpp:552` |
| Frame counter | `context->getFrame()` | Monotonic, `_frame++` inside `VRORenderer::prepareFrame`; already consumed by splat-pass at `VROSplatRenderPass.cpp:498` |

`VROMatrix4f` is **column-major**, confirmed by direct read: translation column lives at `_mtx[12/13/14]` (`VROMatrix4f.cpp:191, 236, 321`), matrix-vector transform reads `_mtx[0/4/8]` as the first three column elements (`VROMatrix4f.cpp:211`). Matches splat-pass's usage. Column-major is also GLSL's default `mat4` layout, so orb GLSL 3.00 ES receiving `context->getViewMatrix().getArray()` via `glUniformMatrix4fv(..., GL_FALSE, ...)` works without transposition.

---

## 5. What three.js becomes

Three.js is **scene-graph authoring + shader authoring only.** Viro owns the frame. Three.js does not run its render loop, ever, in production.

**Grounded in a real read of `~/orb/src/main.ts` and `~/orb/src/orb.ts`.** The current orb uses classic three.js **WebGL2** (`THREE.WebGLRenderer`, `main.ts:35`) plus `EffectComposer` postprocessing (`main.ts:101-159`), driven by `composer.render()` inside `requestAnimationFrame` (`main.ts:278-279`). Shaders are authored via `THREE.ShaderMaterial` + `onBeforeCompile` GLSL injection (`orb.ts:241, 299, 334`), **not TSL / WebGPU**. Correcting this from the original prompt's TSL/WebGPU framing — the delta below reflects the actual codebase.

**Used from three.js:**
- Scene graph construction (`Mesh`, `Group`, `BufferGeometry`, node transforms from `orb.ts`) — walked once at load into a Viro-side buffer/VBO layout owned by the orb pass
- The GLSL fragments from `onBeforeCompile` — the injected chunks in `orb.ts:241/299/334` are lifted verbatim into `_programOrb` GLSL 3.00 ES sources (mirrors splat's `_programRaster`, `VROSplatRenderPass.h:122`)
- `GLTFLoader` (`orb.ts:2`) as an asset loader at package build time or first-run cache — the parsed geometry lands in the same VBO path; three.js runtime not needed
- `BufferGeometry` attribute layouts as a data source, converted to interleaved VBOs at pass init

**NOT used — Viro owns these instead (call sites in `~/orb/src/main.ts`):**
- `THREE.WebGLRenderer` (`:35`), `renderer.setSize` (`:37`), `renderer.setPixelRatio` (`:36`), `renderer.outputColorSpace` (`:40`), `renderer.toneMapping` / `toneMappingExposure` (`:38-39`) — Viro's choreographer owns viewport, tone-map, colorspace.
- `EffectComposer` + `RenderPass`/`UnrealBloomPass`/`ShaderPass`/`OutputPass` (`:101-159`) — Viro's own bloom / tone-mapping / gamma pipeline runs after the custom pass. Postprocessing does not survive migration. Any cinematic-pass effect that must survive gets reimplemented inside the orb's fragment shader or dropped.
- `composer.render()` + `requestAnimationFrame(frame)` (`:278-279`) — Viro's render thread ticks. JS never drives frame timing.
- `PMREMGenerator` (`:53`) — Viro material environment maps are driven by `ViroSceneLightingEnvironment`, not PMREM at render time.
- `OrbitControls` (`:162`) — XR camera is `context->getViewMatrix()/getProjectionMatrix()` from OpenXR. Any `THREE.Camera` in author-time scaffolding is a debug convenience only.
- `renderer.autoClear` / WebGL state mutations — GL state is `GLStateScope`'d by the native pass, not by three.js.

**Note on tone-mapping / bloom parity:** the original orb depends on `ACESFilmicToneMapping` at `renderer.toneMapping` and a bloom chain via `UnrealBloomPass`. Viro's choreographer offers `getToneMapping()` / `getGaussianBlurPass()` (see `VROChoreographer.h:160, 177`) — parity is achievable but is a **scene-level configuration decision**, not something the orb pass itself owns. Document that assumption before shipping so the visual regression is not surprising.

`SEAM` closed for the DECA orb (`~/orb`) — the migration delta above reflects a direct read of `~/orb/src/main.ts` and `~/orb/src/orb.ts`. If a different orb source exists elsewhere (`~/deca`, `~/decaOne`, embedded in `~/decax9`), re-run the grep before migration. The `~/decax9/app/orb.tsx` file is a **different, Viro-native orb already using ViroSphere primitives** — that's a separate implementation, not the one this spec targets.

---

## 6. Six-gate on-device verification sequence

Rewritten for one unified pass. **No double-buffer/fence gates** — those belonged to the texture-bridge design and no longer apply.

1. **Registry attach.** `logcat -s Viro` shows `ExternalPass: attach id=orb-0 priority=0`. Fresh boot → `registerOrbPass` from JS → line appears within 1 frame. Failure mode: JNI tag resolution — `sceneNavTag` didn't resolve to a live `VRT3DSceneNavigator`.
2. **First `render()` call.** Mirrors splat-pass's `render()` call #0 probe (`VROSplatRenderPass.cpp:462-470`) — add the same probe to the orb pass. Line appears once, then every 60th frame. Failure mode: choreographer never invoked the pass — usually HDR is off (`VROChoreographer.h:106`).
3. **Per-eye separation.** Log `context->getEyeType()` on frame #0; confirm both `Left` and `Right` fire in the same frame. Failure mode: monocular fallback active (dev-client on non-VR device) — orb still draws, but stereo isn't exercised.
4. **Depth policy verified.** Set orb material to `glDepthFunc(GL_ALWAYS)` per the always-in-front scope. Place a Viro `ViroBox` at z=-1, orb at z=-2. Screenshot: orb visibly draws over the box. Failure mode: GL state not restored — subsequent Viro geometry renders wrong. Check `GLStateScope` covers every `glEnable`/`glDepthMask` touched.
5. **Splat coexistence.** Register orb first, splat second. Both draw in the same frame. Log line: `MultiplexPass: dispatch [orb-0, splat-1]`. Failure mode: single-slot overwrite — proves the multiplex pass is missing and the second registrar silently overwrote the first. This is the direct on-device evidence for §2.1.
6. **Release → clean detach.** Call `handle.release()` for orb; verify splat still draws next frame. Detach splat too; verify Viro scene renders unchanged (choreographer slot cleared to `nullptr`). Failure mode: `unregisterPass` didn't clear the multiplex entry — verify via `MultiplexPass: children=0`.

---

## 7. Constraint check

- **`npx tsc --noEmit` clean** — new TS types are pure additions in a new package; no virocore `.d.ts` touched. Not yet enforced — verify once the package skeleton lands.
- **Zustand only for shared state touching this pass** — mirror `useSplatPassStore` (`splat-pass/src/store.ts`) with a `useOrbPassStore` and/or shared `useExternalPassStore`. No React context, no `useEffect` for native lifecycle.
- **Cannot share sort/stereo machinery** — stated explicitly in §3. Splat's CPU-bucket-sort worker is splat-specific; orb doesn't need it. Unification is at the `VRORenderPass::render()` interface + `context->` matrix accessors, nothing lower.
- **`requiresSceneDepth` is read-only, not the draw hook** — confirmed at `VROMaterialShaderBinding.cpp:204`. The custom-draw hook is `VROChoreographer::setCustomPostOpaquePass`, not the modifier system. Do not build toward the modifier system for this.

---

## 8. Remaining SEAMs — do not fabricate past these

- `VROMaterialSubstrateOpenGL.h/.cpp` — only shallow-scanned. Read fully before any material-level custom binding work.
- `VRODisplayOpenGLOpenXR` — depth attachment format on the swapchain FBO not confirmed. Matters only if orb-occludes-splats scope changes later.
- ~~`VROMatrix4f.h`~~ — **closed**. Column-major confirmed via `VROMatrix4f.cpp:191/211/236/321`.
- Package name — `@viro-external/render-passes` used in the day-one skeleton; alternate `xr-pass` floated in the original prompt. Rename before native code lands if preferred.
- ~~**Current D.E.C.A. orb source**~~ — **closed for `~/orb`**. §5 updated with real call sites from `main.ts` and `orb.ts`. Note: `~/decax9/app/orb.tsx` is a separate Viro-native orb, unrelated to this migration. If a third orb source lives at `~/deca` or `~/decaOne`, re-check.
- **Tone-mapping / bloom parity** — new SEAM raised by the §5 correction. The three.js orb depends on `ACESFilmicToneMapping` + `UnrealBloomPass`. Viro offers equivalents via `VROChoreographer::getToneMapping()` / `getGaussianBlurPass()`, but the visual match must be verified. Configure at scene-init before the orb pass registers.

---

## 9. What changed from the original texture-bridge draft

For your own record, since the two documents describe genuinely different architectures:

| | Texture-bridge draft (superseded) | This document |
|---|---|---|
| Relationship | Producer (WebGPU) / consumer (Viro), texture handoff | One render pass, orb + splat as children |
| Sync | Double-buffer + fence per handle | None needed — same frame, same context |
| Stereo | Manually packed SBS texture, UV-split material | Native per-eye loop, `context->getEyeType()` |
| three.js role | Owns its own renderer, `WebGPURenderer.render()` | Scene-graph + TSL authoring only, no runtime renderer |
| Depth | No shared depth — texture is flat output | Shares the choreographer's HDR depth target directly |
| Splat unification | N/A (not addressed) | Explicit: shared insertion point, NOT shared sort machinery |

The texture-bridge file (`DECA-webgpu-viro-bridge-spec.md`) should be treated as obsolete for the orb. It may still be relevant if a *different* future producer needs a true texture handoff (e.g., a foreign decoder surface), but the orb is not that case.
