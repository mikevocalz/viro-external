# PROMPT-1 — `react-native-viro-mux` (the native texture bridge)

You are a **principal-level native React Native + XR engineer**. You build production
packages, not demos. You verify every API against real source before you use it. You
never invent props, classes, or methods. If a symbol cannot be verified, you stop and
say so rather than fabricate. `npx tsc --noEmit` must pass before any task is "done".
There are no stubs, TODOs, or placeholder bodies in delivered code.

This is **package 1 of 5** in a family. It is the lowest layer: it defines the
`ViroGPUTexture` seam that the other four packages bind to. The other packages
(`@viro-external/core` × 3, `@viro-external/gui` × 1) declare a dependency on the
public contract you define here. **Treat the public TS surface of `ViroGPUTexture` as a
stable contract** — other agents are writing against it in parallel.

---

## Phase 0 — scaffold the working agreement first (before any code)

Create these at the package root and treat them as the source of truth:

- **`AGENTS.md`** — how an agent works in this repo: read `config/defaults.json`
  before touching any tunable; never invent native or JS APIs; clone and read the real
  ReactVision/Viro source before writing any native binding; no stubs in delivered
  code; `npx tsc --noEmit` must pass before a task is done; the `doc/` page wins over
  the README if they disagree.
- **`CLAUDE.md`** — standing prefs: terse output; **Zustand for any shared/business
  state, never `useState` for app state**; functional components; verified APIs only;
  principal/staff engineer quality bar (FAANG / Linear / Vercel grade); design and
  motion must carry semantic weight; performance is a feature.
- **`TASKS.md`** — a living task ledger with checkboxes, organized by the phases below.
  Update it as you go.
- **`config/defaults.json`** — single source of truth for every tunable: default
  texture resolution, color space, mipmap policy, max concurrent textures, Mux
  playback defaults, curvature default. No magic numbers inline anywhere.
- **`doc/`** map: `Architecture.md`, `TextureBridge.md` (the `ViroGPUTexture` seam —
  this is the load-bearing doc), `MuxPlayback.md`, `Native-iOS.md`, `Native-Android.md`.

## Phase 1 — verify the real Viro API before writing a line of native code

Clone `https://github.com/ReactVision/viro` and read the actual renderer source. Do
not proceed on memory. Confirm and cite file/symbol locations in `doc/TextureBridge.md`:

- Viro's renderer is a **prebuilt binary**; the supported extension pattern is Viro's
  own **`ViroCameraTexture` convention** — a non-visual sibling component that sets a
  texture on a **named material**, which a visual component then references. This is
  the pattern every texture this package produces must follow.
- iOS: `VROVideoTextureiOS::loadVideo(AVPlayerItem*)` accepts an `AVPlayerItem`
  directly. Verify the exact signature and namespace in ViroKit.
- Android: `com.viro.core.VideoTexture(Uri)`. Verify the constructor and the texture
  registration path.
- **The external-texture mechanism is already verified — build to it, do not
  re-investigate.** See the "Verified native seam" appendix at the end of this prompt.
  In short: ViroCore's camera background is constructed as
  `VROTextureSubstrateOpenGL(GL_TEXTURE_EXTERNAL_OES, textureId, driver, true)` wrapped
  in `VROTexture(VROTextureType::TextureEGLImage, VROTextureInternalFormat::RGBA8, ...)`
  on Android, and `VROTextureSubstrateMetal` on iOS. The `ViroGPUTexture` seam is this
  exact path, repointed from the camera texture id to an externally-supplied texture id.
  This is a **ViroCore fork** change (your `@mikevocalz/react-viro` `pico-support`
  branch), not a stock-Viro JS API — there is no JS-level external-texture API in stock
  Viro, and the prompt does not pretend otherwise.

Target stack (verify each version on npm before pinning — do not guess):
Expo SDK 56, React Native 0.86 (via overrides), `@reactvision/react-viro` **2.56.0**,
Nitro Modules for the native bridge. RN 0.86 + Viro overrides is bleeding edge and may
break — acknowledged; proceed.

## Phase 2 — the three deliverables

**(a) `ViroMuxVideo`** — plays a Mux asset as a Viro video texture.
- Props (verified, no inventions): `playbackId: string`, `tokens?` (signed playback /
  DRM), `paused?: boolean`, `muted?: boolean`, `loop?: boolean`, `materialName: string`
  (the named material the texture binds to), event callbacks from Viro's **real** event
  system only (`onBufferStart`, `onBufferEnd`, `onFinish`, `onError` — confirm exact
  names in source).
- Feeds the Mux HLS manifest (`https://stream.mux.com/{PLAYBACK_ID}.m3u8`) into an
  `AVPlayerItem` (iOS) / ExoPlayer-backed `Uri` (Android), binds the output to the
  texture via the `ViroCameraTexture` convention.
- Mux Data telemetry attaches at the **player layer, below the bridge** — never above
  it. Keep analytics out of the Viro layer.

**(b) `ViroMuxSurface`** — a flat↔curved quad that displays a `ViroMuxVideo` texture.
- `curvature: number` (0 = flat, 1 = fully curved), verified geometry. Flat is a Viro
  quad; curved is a real curved surface, not a faked billboard.
- `width`/`height` in meters. Default placement is left to the consumer (the GUI and
  scene-composition layers own zones); do **not** hardcode `z=-1.5`.

**(c) `ViroGPUTexture`** — THE SEAM. An external GPU texture surface that accepts a
texture from outside Viro and binds it to a named material via the
`ViroCameraTexture` convention. Sources it must accept:
- A WebGPU / TypeGPU render-target texture.
- A Skia (Graphite) surface texture.
- An offscreen FBO handle (this is what `@viro-external/core`'s `ViroSlate` will feed).
- The output of a compute pass (this is what `ViroGaussianSplat` will feed).

Define and **freeze** this public TS contract — other packages import it:

```ts
export interface ExternalTextureHandle {
  // the verified, real handle type for the platform's external texture import path.
  // Document precisely what this is on each platform in doc/TextureBridge.md.
}

export interface ViroGPUTextureProps {
  materialName: string;            // named material the texture binds to
  texture: ExternalTextureHandle;  // the external texture to present
  colorSpace?: 'srgb' | 'linear';  // default from config/defaults.json
  flipY?: boolean;
  onTextureBound?: () => void;
  onError?: (error: Error) => void;
}

export function registerExternalTexture(/* verified args */): ExternalTextureHandle;
export function releaseExternalTexture(handle: ExternalTextureHandle): void;
```

The exact shape of `ExternalTextureHandle` and the register/release functions must
reflect what the prebuilt Viro binary actually exposes. If the real mechanism differs
from this sketch, **update the contract to match reality and document the change at the
top of `doc/TextureBridge.md`** so the other four agents can adapt.

## Phase 2.5 — the shared `MovableProps` contract (define and freeze here)

Movability is a verified Viro capability, not a per-component reinvention. Confirm
against `@reactvision/react-viro` 2.56.0 source and the Interaction/Events docs:
`onDrag` makes a node draggable; `dragType` is one of `FixedDistance` |
`FixedToWorld` | `FixedToPlane`; `FixedToPlane` takes a `dragPlane`
(`planePoint` + `planeNormal` + `maxDistance`); `onPinch` reports `pinchState` +
`scaleFactor`. **Verify which drag modes work in VR / OpenXR vs AR** — `FixedToWorld`
and `onHover` are documented AR-only; on PICO/Quest/OpenXR the reachable modes are
`FixedDistance` and `FixedToPlane` plus controller/hand-ray input. Document the
VR-vs-AR matrix in `doc/TextureBridge.md` (or a new `doc/Movability.md`).

Define and **freeze** this shared interface; all four downstream packages import it:

```ts
export interface MovableProps {
  movable?: boolean;                       // wraps the component in a ViroNode + wires onDrag
  dragType?: 'FixedDistance' | 'FixedToWorld' | 'FixedToPlane';
  dragPlane?: { planePoint: [number,number,number]; planeNormal: [number,number,number]; maxDistance: number };
  axisLock?: ('x' | 'y' | 'z')[];          // OUR addition: Viro cannot lock to a single
                                           // axis natively (FixedToPlane locks to a plane,
                                           // not a line). Implement by re-clamping the
                                           // locked components inside the onDrag handler.
  onMoveStart?: () => void;
  onMove?: (worldPos: [number, number, number]) => void;   // wraps onDrag
  onMoveEnd?: (worldPos: [number, number, number]) => void;
  pinchToScale?: boolean;                  // wires onPinch -> scale update on pinch end
}

// The reusable wrapper every downstream component composes:
export function MovableNode(props: MovableProps & { children: React.ReactNode }): JSX.Element;
```

`MovableNode` is the single implementation of drag/pinch/axis-lock. Downstream packages
must NOT re-wire `onDrag` themselves — they compose `MovableNode` (or spread
`MovableProps` into it). The `axisLock` clamp lives here, once. Put drag defaults
(default `dragType`, default `maxDistance`) in `config/defaults.json`.

## Phase 3 — quality gates

- `npx tsc --noEmit` passes.
- Every native symbol cited in `doc/` resolves to a real file/line in the Viro source.
- `config/defaults.json` holds every tunable; no inline magic numbers.
- No quality-degradation fallback paths. Capability detection (native module present
  or not) is allowed and correct; faking the texture when the module is absent is not.
- `MovableProps` + `MovableNode` are exported, frozen, and documented; the VR-vs-AR
  drag-mode matrix is in `doc/`; the `axisLock` clamp is implemented and tested.
- `TASKS.md` fully checked.

Stop and ask me before forcing any conflicting dependency or inventing any API you
cannot find in source.

---

## Appendix A — Verified native seam (the `ViroGPUTexture` patch, baked in)

These symbols are confirmed from ViroCore source (`ReactVision/virocore`, master).
Build against them; do not re-investigate whether an external-texture path exists — it
does, and this is it.

**Android (OpenGL ES), confirmed in `VROARSessionARCore.cpp`:** the camera background
texture is created exactly as

```cpp
std::unique_ptr<VROTextureSubstrate> substrate =
    std::make_unique<VROTextureSubstrateOpenGL>(GL_TEXTURE_EXTERNAL_OES,
                                                _cameraTextureId, driver, true);
_background = std::make_shared<VROTexture>(VROTextureType::TextureEGLImage,
                                           VROTextureInternalFormat::RGBA8,
                                           std::move(substrate));
```

So the seam on Android is: accept an externally-created GL texture id (the WebGPU/Skia
output, shared via an `EGLImage` / shared EGL context), wrap it with
`VROTextureSubstrateOpenGL(GL_TEXTURE_EXTERNAL_OES or GL_TEXTURE_2D, externalTextureId,
driver, /*sRGB*/ ...)`, wrap that in a `VROTexture`, and assign it to the target
material's diffuse slot via the material's substrate. Reuse the exact substrate/texture
types above — they are the renderer's real internal texture path, identical to the
camera feed.

**iOS (Metal), confirmed in `VROGeometrySubstrateMetal.cpp`:** textures resolve through
`VROTextureSubstrateMetal` (`textures[j]->getSubstrate(driver)` casts to
`VROTextureSubstrateMetal *`). The iOS seam wraps a shared `MTLTexture` (backed by an
`IOSurface` so WebGPU/Skia and Viro share GPU memory) in a `VROTextureSubstrateMetal`,
then a `VROTexture`, assigned to the material the same way.

**The fork work (this is the real deliverable of PROMPT-1, on the `pico-support`
branch of `@mikevocalz/react-viro` / virocore):**

1. Add a native method on the renderer that takes an external texture handle
   (GL id + EGLImage on Android; `IOSurface`/`MTLTexture` on iOS) and a target material
   name, builds the `VROTexture` via the substrate types above, and binds it to that
   material's diffuse texture. This is the C++ implementation of
   `registerExternalTexture`.
2. Expose it to JS through a Nitro module — that JS surface is `ViroGPUTexture` /
   `registerExternalTexture` / `releaseExternalTexture`.
3. The JS material itself is created with the **verified public API**
   `ViroMaterials.createMaterials({ <materialName>: { diffuseTexture: <placeholder> } })`
   (confirmed real Viro API); the native call then swaps that material's substrate for
   the external one. Components reference it via the standard `materials={["<name>"]}`
   prop (confirmed real Viro prop on `ViroBox`/`ViroQuad`/`Viro3DObject`/etc.).
4. `releaseExternalTexture` deletes the `VROTexture`/substrate wrapper (not the
   underlying GL/Metal texture, which WebGPU/Skia owns) and restores or clears the
   material slot.

**16KB page-alignment note (PICO / Android 15):** the fork's native `.so` outputs must
keep the 16KB alignment fix already established for `libopenxr_loader.so` /
`libc++_shared.so`. Carry it into this module's build config.

**`ViroMaterials.createMaterials` quirk (confirmed via virocore issue #436):**
registering a material with **no** `diffuseTexture` can crash on first run. Always
register the placeholder material with a 1×1 `diffuseTexture` before the native swap;
never register an empty material. Bake this into the material-creation helper.
