# PROMPT-2 — `@viro-external/core`: `ViroCylinderSurface`

You are a **principal-level native React Native + XR engineer**. Production packages,
not demos. Verify every API against real source. Never invent props, classes, or
methods. If a symbol can't be verified, stop and say so. `npx tsc --noEmit` must pass
before any task is "done". No stubs, TODOs, or placeholder bodies in delivered code.

This is **package 2 of 5**. It lives in the `@viro-external/core` package. It has a
hard upstream dependency on **`react-native-viro-mux`** (PROMPT-1), which defines the
`ViroGPUTexture` seam and the `ExternalTextureHandle` / `ViroGPUTextureProps` contract.
You bind textures only through that seam — do not re-implement texture import here.

### Upstream contract you depend on (from PROMPT-1)

```ts
import {
  ViroGPUTexture,
  ExternalTextureHandle,
  registerExternalTexture,
  releaseExternalTexture,
  MovableProps,
  MovableNode,
} from 'react-native-viro-mux';
```

Treat that import surface as fixed. If PROMPT-1's `doc/TextureBridge.md` notes the real
handle type differs from the sketch, follow the doc. Compose `MovableNode` for
movability — do not re-wire `onDrag` yourself.

---

## Phase 0 — scaffold (before any code)

Create at the package root: `AGENTS.md`, `CLAUDE.md`, `TASKS.md`,
`config/defaults.json`, and a `doc/` map (`Architecture.md`, `Geometry.md` —
the cylinder geometry derivation, `BabylonParity.md` — the prop mapping, `Native.md`).

- **`CLAUDE.md`** standing prefs: terse; **Zustand for shared state, never `useState`
  for app state**; functional components; verified APIs only; principal bar; design and
  motion carry semantic weight; performance is a feature.
- **`config/defaults.json`**: default radial segments, default height/radius, default
  `thetaLength`, UV layout policy, cap-generation policy. No inline magic numbers.

## Phase 1 — verify the real Viro geometry path

Clone `https://github.com/ReactVision/viro` and confirm, citing files in
`doc/Geometry.md`:

- Viro has **no native cylinder primitive**. The supported path for custom geometry is
  ViroCore's **`VROGeometry`** with explicit vertex / normal / UV / index buffers.
  Verify the exact `VROGeometry` construction API and how a JS component supplies
  geometry data to it (or whether a native geometry builder must be added to ViroCore).
- Confirm how a `VROGeometry` node receives a **named material** (so the
  `ViroGPUTexture` seam can target it) — this must match the `ViroCameraTexture`
  convention PROMPT-1 documents.

Pin versions verified on npm: Expo SDK 56, RN 0.86 (overrides),
`@reactvision/react-viro` 2.56.0.

## Phase 2 — the deliverable: `ViroCylinderSurface`

A native-geometry cylinder with **Babylon `CreateCylinder` parity**. Map Babylon's real
parameter names to props (these are the verified Babylon names — do not rename
arbitrarily):

```ts
export interface ViroCylinderSurfaceProps {
  height: number;            // Babylon: height
  radiusTop: number;         // Babylon: diameterTop / 2
  radiusBottom: number;      // Babylon: diameterBottom / 2
  radialSegments?: number;   // Babylon: tessellation        (default from config)
  heightSegments?: number;   // Babylon: subdivisions         (default from config)
  openEnded?: boolean;       // Babylon: hasRings / cap flags inverted — document mapping
  thetaStart?: number;       // Babylon: arc start (radians)
  thetaLength?: number;      // Babylon: arc (radians); < 2π = partial wrap
  materialName: string;      // named material for the ViroGPUTexture seam to bind to
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
  // texture binding is done by composing a <ViroGPUTexture materialName=...> sibling,
  // NOT by passing a texture handle here. Keep this component geometry-only.
}
```

Movability: `ViroCylinderSurfaceProps extends MovableProps`. The cylinder is movable as
a **whole node** (compose `MovableNode` from PROMPT-1 around it). `pinchToScale` is
verified-supported (Viro `onPinch` → scale). Default `position` is unset/local origin so
a `SceneZone` parent can own the world transform — never default to `z=-1.5`.

Geometry generation (in `doc/Geometry.md`, then in code):
- Generate vertices/normals/UVs/indices for a parametric cylinder with independent top
  and bottom radii (so it also covers cones and truncated cones), correct UV mapping so
  a wrapped texture (e.g. a `ViroMuxVideo` feeding `ViroGPUTexture`) lands correctly,
  and optional caps when `openEnded` is false.
- `thetaLength < 2π` produces a **partial cylindrical wrap** — this is the exact
  geometry `@viro-external/gui`'s `CylinderPanel` (PROMPT-5) will reuse. Make the
  geometry generator a **pure, exported function** so the GUI layer can import it:

```ts
export function buildCylinderGeometry(opts: {
  height: number; radiusTop: number; radiusBottom: number;
  radialSegments: number; heightSegments: number;
  thetaStart: number; thetaLength: number; openEnded: boolean;
}): { positions: Float32Array; normals: Float32Array; uvs: Float32Array; indices: Uint32Array };
```

## Phase 3 — quality gates

- `npx tsc --noEmit` passes.
- Every Viro symbol cited resolves to real source.
- A wrapped texture (test by composing with a `ViroGPUTexture` sibling) lands with
  correct orientation — verify UVs visually and document the expected result.
- `config/defaults.json` holds every tunable.
- No quality-degradation fallback. No invented `VROGeometry` API.
- `TASKS.md` fully checked.

Stop and ask before forcing a conflicting dependency or inventing geometry APIs.
