# splat-pass — architecture

## Why a render pass, not a frame listener

`VROFrameListener::onFrameDidRender` fires ONCE per frame after both eyes
are presented (verified `ViroRenderer/VRORenderer.cpp:619-632`,
`android/sharedCode/src/main/cpp/VROSceneRendererOpenXR.cpp:1018-1036`).
That's too late — the swap target has already taken its tone-mapped,
gamma-corrected colour. Splats need to live in the linear HDR target,
depth-tested against opaque scene geometry, before tone-mapping eats
their dynamic range.

The right seam is a `VRORenderPass` injected into `VROChoreographer`
between `_baseRenderPass->render(...)` and the bloom / blit / post chain
(`ViroRenderer/VROChoreographer.cpp:280-397`). The Choreographer runs
per-eye (called from `VRORenderer::renderEye` which is called twice by
the OpenXR backend), so a single pass instance fires per eye for free.

The hook lives at
`mikevocalz/virocore` `ViroRenderer/VROChoreographer.h::setCustomPostOpaquePass(std::shared_ptr<VRORenderPass>)`
on branch `v2.55.0-nitro-canvas`.

## Per-eye VP

`VRORenderContext` exposes `getViewMatrix()` (world→eye, includes head
pose) and `getProjectionMatrix()` (eye FoV projection) — both set by
`VRORenderer::renderEye` (`VRORenderer.cpp:550-552`). No
`getViewProjectionMatrix()` exists. The pass multiplies locally as
`P * V`, in column-major.

The eye discriminator is `VRORenderContext::getEyeType()` (`Left` /
`Right` / `Monocular`). The sort SSBO is double-buffered per eye so the
right-eye dispatch doesn't stall waiting on the left-eye sort.

## State management

GL state at frame start (verified `ViroRenderer/VRODriverOpenGL.h:80-96`):

```
DEPTH_TEST      ON
DEPTH_MASK      GL_TRUE
DEPTH_FUNC      GL_LEQUAL
STENCIL_TEST    ON
CULL_FACE       OFF
BLEND           ON
BlendEquation   FUNC_ADD
BlendFunc       SRC_ALPHA, ONE_MINUS_SRC_ALPHA
```

Anything the pass mutates outside this default MUST be restored. The
`GLStateScope` RAII helper captures the relevant subset on construction
and restores on destruction. Naked `glEnable`/`glDisable` outside the
RAII scope is a review-block.

For splats specifically the pass needs:

- `DEPTH_TEST` ON, `DEPTH_MASK` GL_FALSE (depth-test against opaque,
  do not write depth — splats are transparency-style).
- `BLEND` ON with premultiplied alpha (`BlendFunc(ONE,
  ONE_MINUS_SRC_ALPHA)`). The splat fragment shader emits
  premultiplied colour.
- `CULL_FACE` OFF (splat quads are camera-aligned billboards; backface
  culling would drop half of them).

The pass restores all four to the frame-boundary defaults via
`GLStateScope`.

## SSBO layout

Three SSBOs per registered splat set:

1. **Decoded splats** (`std430`, `decodeWorkgroupSize=64`): position
   `vec4`, scale `vec4` (xyz + alpha), rotation `vec4` quaternion,
   colour `vec4` (rgb premultiplied + alpha), SH coefficients (16 × vec4
   if SH is present, otherwise omitted via shader macro). Stride is
   typically 64 bytes (config: `expectedSplatStrideBytes`).

2. **Sort keys** (`std430`): depth-key (fp16 in upper 16 bits) +
   splat-id (uint16 in lower 16 bits) packed into one `uint32` per
   splat. Bitonic sort is in-place, stable for equal keys via the id
   tiebreaker.

3. **Indirect draw args**: one `glDrawArraysIndirectCommand` block fed
   to `glDrawArraysIndirect`. The decode shader writes `count` based on
   the live splat count for the current `timestamp`; the raster pass
   reads it the same frame, no CPU round-trip.

The decoded-splats SSBO is triple-buffered (config: `ringBufferDepth=3`)
to keep the GPU consumer one frame ahead of the producer dispatch and
avoid pipeline stalls.

## 4D temporal evaluation

The source is a 4D-extended SPZ binary: a base block (static reference
splats) plus delta blocks indexed by time. The decode compute shader
reads `timestamp` from a uniform, interpolates the matching delta
block(s) against the base, and writes the live splat SSBO. Static 3D
sources skip the delta application — the decode pass becomes an SSBO
memcpy, gated to fire only when the camera moves enough to require a
re-sort (`sort gated on camera move only` per PROMPT-4 §3).

## #436 placeholder texture

Before any native swap that could hit an empty-material code path (Viro
issue #436 root cause: empty diffuse channel reads texture unit 0,
which on Mali drivers can sample whatever was previously bound), bind
a 1×1 RGBA white texture to GL_TEXTURE0 in the pass's prologue. The
pass restores the previous binding via `GLStateScope`. The bind is
cheap and avoids one entire class of cross-package GL leak.

## Out of scope

- iOS Metal, multiview, WebGPU — see `TASKS.md` "Not in scope".
