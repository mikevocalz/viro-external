# PROMPT-3 — `@viro-external/core`: `ViroSlate`

You are a **principal-level native React Native + XR engineer**. Production packages,
not demos. Verify every API against real source. Never invent props, classes, or
methods. If a symbol can't be verified, stop and say so. `npx tsc --noEmit` must pass
before any task is "done". No stubs, TODOs, or placeholder bodies in delivered code.

This is **package 3 of 5**, in `@viro-external/core`. It is the React-Native /
ViroReact equivalent of Babylon's **`HolographicSlate`**: a flat-or-curved spatial
panel that displays **arbitrary 2D content rendered to a texture** — the spatial
analog of a window. It has a hard upstream dependency on **`react-native-viro-mux`**
(PROMPT-1) for the `ViroGPUTexture` seam, and a soft dependency on
**`ViroCylinderSurface`** (PROMPT-2) for the curved variant's geometry.

### Upstream contracts

```ts
import { ViroGPUTexture, registerExternalTexture, releaseExternalTexture, MovableProps, MovableNode } from 'react-native-viro-mux';
import { buildCylinderGeometry } from '@viro-external/core'; // for curvature > 0
```

Compose `MovableNode` for movability — do not re-wire `onDrag`.

---

## Phase 0 — scaffold

Create at the package root: `AGENTS.md`, `CLAUDE.md`, `TASKS.md`,
`config/defaults.json`, `doc/` (`Architecture.md`, `OffscreenRender.md` — the
2D→texture pipeline, `Curvature.md`, `Composition.md`).

- **`CLAUDE.md`**: terse; **Zustand for shared state, never `useState` for app state**;
  functional components; verified APIs only; principal bar; design/motion carry
  semantic weight; performance is a feature.
- **`config/defaults.json`**: default slate size (meters), default texture resolution,
  supersampling factor, default curvature, corner radius, default material name prefix,
  background/glass material defaults. No inline magic numbers.

## Phase 1 — verify the offscreen-render path

The slate works the way Babylon's 3D GUI works: **render 2D content to an offscreen
target, bind that target as a texture on a 3D surface.** Confirm, citing real source:

- The offscreen render target: a Skia (Graphite) surface or a WebGPU render target,
  rendered off-screen, producing an `ExternalTextureHandle` via PROMPT-1's
  `registerExternalTexture`. Verify the Skia Graphite offscreen-surface API
  (`@shopify/react-native-skia@next`) and the WebGPU render-target API against their
  real current docs/source — pin versions verified on npm.
- The flat surface: a Viro quad. The curved surface: `buildCylinderGeometry` from
  PROMPT-2 with `thetaLength < 2π`, radius derived from `curvature`.
- Texture binding via the `ViroGPUTexture` seam + named material — no separate import
  mechanism.

## Phase 2 — the deliverable: `ViroSlate`

```ts
export interface ViroSlateProps {
  // content: arbitrary RN/Skia 2D content rendered to the slate's texture.
  children?: React.ReactNode;          // rendered into the offscreen target
  title?: string;

  widthMeters: number;
  heightMeters: number;
  resolution?: [number, number];       // texture pixel size; default from config
  supersample?: number;                // AA; default from config

  curvature?: number;                  // 0 = flat, 1 = fully curved (uses cylinder geo)
  cornerRadius?: number;
  variant?: 'solid' | 'glass';         // glass = Liquid-Glass-style material

  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];

  onContentSizeChange?: (size: { width: number; height: number }) => void;
  onError?: (error: Error) => void;
}
```

Movability: `ViroSlateProps extends MovableProps`. This maps directly to Babylon
`HolographicSlate`'s grab/follow behavior. When `movable`, the **title bar is the grab
handle** (dragging the content area should not move the slate — only the title bar /
chrome does), implemented by attaching the `MovableNode` drag affordance to the title
region, not the whole surface. Default `dragType` is `FixedDistance` (good for
VR/OpenXR). Release the external texture on unmount regardless of movability.

Behavior:
- Children render to the offscreen target at `resolution × supersample`, downsampled
  for AA, presented through `ViroGPUTexture`.
- `curvature > 0` swaps the quad for cylinder geometry (subtle curve, like a slightly
  wrapped window — not a full tube).
- `variant="glass"` applies a translucent, depth-aware material (this is the premium
  Liquid-Glass look — it must mean something: use it for floating/secondary surfaces).
- **Placement is the consumer's job.** Do not hardcode positions. The scene-composition
  layer assigns this to a named zone (`primary`, `peripheralLeft`, etc.). Default
  position is unset/local origin so a `SceneZone` parent owns the world transform.
- Release the external texture on unmount (`releaseExternalTexture`). No leaks.

`ViroSlate` is the primitive that `@viro-external/gui` (PROMPT-5) re-exports as its
`HolographicSlate`. Keep the API clean enough that the GUI layer wraps it with zero
hacks.

## Phase 3 — quality gates

- `npx tsc --noEmit` passes.
- Offscreen render → texture → slate verified end to end with real content.
- External texture released on unmount; no GPU memory leak across mount/unmount cycles.
- `config/defaults.json` holds every tunable.
- No quality-degradation fallback; no invented Skia/WebGPU/Viro APIs.
- `TASKS.md` fully checked.

Stop and ask before forcing a conflicting dependency or inventing any API.
