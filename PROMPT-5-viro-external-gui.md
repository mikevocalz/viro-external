# PROMPT-5 — `@viro-external/gui`: Babylon 3D GUI spine (Wave 1)

You are a **principal-level XR UI engineer and top design engineer**. Production
packages, not demos. Verify every API against real source. Never invent props,
classes, or methods. If a symbol can't be verified, stop and say so. `npx tsc --noEmit`
must pass before any task is "done". No stubs, TODOs, or placeholder bodies in
delivered code.

This is **package 5 of 5**, in `@viro-external/gui`. It is a **native ViroReact port of
Babylon.js's `GUI3D` control tree** — the spatial UI toolkit. Babylon's 3D GUI works by
**rendering 2D content (an `AdvancedDynamicTexture`) onto 3D meshes**; that is exactly
the `ViroGPUTexture` → `ViroSlate` pattern from the lower packages, so this layer is
**pure TypeScript composition on top of the primitives** — no new native code.

This prompt builds **Wave 1: the spine** that every other Babylon GUI control extends.
Wave 2 (`SpherePanel`, `ScatterPanel`, `PlanePanel`, `MeshButton3D`,
`TouchHolographicButton`, `Slider3D`, `TouchHolographicMenu`, `VolumeBasedPanel`) is a
later prompt and must subclass/compose the spine you build here.

### Upstream contracts (hard dependencies)

```ts
import { ViroGPUTexture, MovableProps, MovableNode } from 'react-native-viro-mux';     // PROMPT-1
import { ViroSlate, buildCylinderGeometry } from '@viro-external/core'; // PROMPT-3, PROMPT-2
```

Use Viro's **real event system** for pointer/hover/click (`onHover`, `onClick`,
`onClickState`, etc. — verify exact names in `@reactvision/react-viro` 2.56.0 source).
Do not invent event props.

---

## Phase 0 — scaffold

Create at the package root: `AGENTS.md`, `CLAUDE.md`, `TASKS.md`,
`config/defaults.json`, `doc/` (`Architecture.md`, `BabylonGUIMapping.md` — the
class-by-class mapping, `ControlTree.md`, `Layout.md` — the `_arrangeChildren`
algorithms, `Composition.md`).

- **`CLAUDE.md`**: terse; **Zustand for shared/business state, never `useState` for app
  state**; functional components; verified APIs only; principal/design bar (Linear /
  Vercel grade); **design and motion carry semantic weight — hover/press/focus states
  must mean something**; performance is a feature.
- **`config/defaults.json`**: default button size (m), panel margins, hover/press
  animation timings and scales, default font/typography tokens, glass material
  defaults, panel radius defaults. No inline magic numbers.

## Phase 1 — verify the real Babylon GUI3D surface

These are the **verified** Babylon `GUI3D` classes this port mirrors. **The real prop
names are baked into Appendix B at the end of this prompt** — build to them; do not
re-derive them. The Wave-1 classes: `GUI3DManager`, `Container3D`, `Control3D` (base),
`Button3D`, `HolographicButton`, `StackPanel3D`, `CylinderPanel` (extends
`VolumeBasedPanel`), `HolographicSlate`. Content controls render via
`AdvancedDynamicTexture` (`TextBlock`, `Image`, `Rectangle`) — the analog here is 2D
content rendered into a `ViroSlate`/`ViroGPUTexture`.

Document the mapping in `doc/BabylonGUIMapping.md`: Babylon class → this package's
component → which lower-level primitive it composes.

## Phase 2 — Wave 1 deliverables (the spine)

Build these six, in dependency order:

1. **`Control3D`** — abstract base. Owns: a transform (position/rotation/scale),
   pointer state (hover/press/focus) via Viro's real events, the
   `pointerEnter/Out/Down/Up/Click` observable-equivalents as React callbacks, and the
   hook the parent panel's layout calls. Mirrors Babylon `Control3D`'s lifecycle
   (`_createNode`-equivalent → returns the Viro node; `_arrangeChildren` hook for
   containers). No raw world positions — see Phase 3.

2. **`Container3D`** — base container. Holds children, exposes a `blockLayout` flag
   (batch adds, then arrange once — Babylon's real behavior), delegates arrangement to
   subclasses via an `_arrangeChildren`-equivalent. Does no layout itself.

3. **`Button3D`** — a spatial button: a quad/box surface carrying 2D content (text/
   image) rendered through `ViroSlate`/`ViroGPUTexture`, with **semantic** hover/press
   states (scale + material response, timings from config). `onPointerClick` etc. from
   Viro events.

4. **`HolographicButton`** — Babylon's MRTK holographic button: front plate + back
   plate, glass/holographic material, content rendered to texture, hover highlight that
   tracks the pointer. Compose `Button3D` + the `ViroSlate variant="glass"` look. Match
   Babylon's real prop names (`text`, `imageUrl`, `tooltipText`, `backMaterial`,
   `frontMaterial`, `plateMaterial`, `contentResolution`, `contentScaleRatio` — verify
   and map).

5. **`StackPanel3D`** — `Container3D` with linear layout: `isVertical`, `margin`
   (verified Babylon props). `_arrangeChildren` stacks children along one axis with the
   given margin, no overlaps by construction. Document the algorithm in `doc/Layout.md`.

6. **`HolographicSlate`** — re-export / thin wrap of `@viro-external/core`'s `ViroSlate`
   under the Babylon name, with Babylon's slate affordances (title bar, follow/grab
   behavior if reachable). This is the spatial window control. `CylinderPanel` (Wave 1
   below) and Wave-2 panels host content inside slates.

Also build **`CylinderPanel`** (it's Wave-1 because it's the curved-layout exemplar):
`VolumeBasedPanel`-style container that arranges children on a cylindrical arc using
`buildCylinderGeometry` from PROMPT-2 for the surface and an `_arrangeChildren` that
distributes children across `arcDegrees` at a given `radius`. Compute angular spacing
from item count + item width so items never overlap (document the `minStepDegrees`
derivation). Verified Babylon props: `radius`, `margin`, `columns`/`rows` where
applicable.

## Phase 3 — placement discipline (non-negotiable)

This package must **not** scatter content with hand-typed world positions. Enforce the
named-zone composition model:

- Author against a `SceneRig` / `SceneZone` model (or a `ZONES` table) where the **zone
  owns the world transform** and children sit at local origin. Canonical zones, head at
  origin, forward = `-Z`, meters: `primary [0,-0.10,-1.5]`, `peripheralLeft
  [-0.96,-0.10,-1.15] yaw +40°`, `peripheralRight [0.96,-0.10,-1.15] yaw -40°`,
  `dock [0,-0.55,-1.0] pitch +20°`, `statusBar [0,0.55,-1.4] pitch -12°`,
  `nearLeft/nearRight [±0.32,-0.32,-0.55]`. Document these in `doc/Composition.md`.
- **Exactly one** element in `primary`. Controls/toolbars → `dock`. Secondary content →
  peripherals. Many items → a managed panel (`StackPanel3D` / `CylinderPanel`) that does
  its own internal non-overlap layout, placed *inside* one zone.
- Comfort envelope is enforced: primary content 1.0–2.0m, within ±30° vertical/
  horizontal cones, panel centers dropped ~0.10–0.26m below head Y; nothing closer than
  0.5m except `nearLeft`/`nearRight`. No two parallel panels within 0.3m in Z. No
  interactive hitboxes within 0.05m (account for touch-button hitbox inflation).
- Every component default position is **unset/local origin** so a zone parent owns the
  transform. Never default to `z=-1.5`.

## Phase 3.5 — movability discipline (containers move, children don't drag loose)

Movability composes `MovableNode` from PROMPT-1. The rule that prevents a broken UX:

- **Containers are movable; their children are not independently draggable.**
  `StackPanel3D`, `CylinderPanel`, `HolographicSlate`, and any panel may accept
  `MovableProps` and move as a unit. Their child `Button3D` / `HolographicButton`
  instances move **with the parent** via the parent `ViroNode` transform — they must
  **not** each wire their own `onDrag`, or the layout falls apart (a button dragged out
  of its panel breaks `_arrangeChildren`).
- A bare `Button3D` / `HolographicButton` placed directly in a scene (no panel parent)
  **may** be `movable` — but inside a panel, the panel owns movement. Enforce this: if a
  control detects a movable panel ancestor, it ignores its own `movable` prop and logs a
  dev warning.
- `HolographicSlate` movability = Babylon's slate grab/follow: the **title bar is the
  grab handle**, inherited from `ViroSlate` (PROMPT-3). Don't re-implement it here.
- Default `dragType` for GUI is `FixedDistance` (VR/OpenXR-appropriate). Honor the
  VR-vs-AR drag-mode matrix PROMPT-1 documents — don't assume AR-only modes
  (`FixedToWorld`) are available on PICO/Quest.

## Phase 4 — quality gates

- `npx tsc --noEmit` passes.
- Each control maps to a verified Babylon class with verified prop names, documented in
  `doc/BabylonGUIMapping.md`.
- Hover/press/focus states are present and semantically meaningful (timings from config).
- `StackPanel3D` and `CylinderPanel` produce provably non-overlapping layouts; the
  `minStepDegrees` derivation is documented and the arc respects it.
- No hand-typed world positions; zone model used throughout; comfort cone respected.
- Movability composes `MovableNode`; panels move as a unit; child controls do not wire
  their own `onDrag`; a control with a movable panel ancestor ignores its own `movable`.
- `config/defaults.json` holds every tunable; no quality-degradation fallback; no
  invented Babylon or Viro APIs.
- `TASKS.md` fully checked; Wave-2 controls left as documented subclass/compose points.

Stop and ask before forcing a conflicting dependency or inventing any API you can't
find in Babylon or Viro source.

---

## Appendix B — Verified Babylon GUI3D control + prop surface (baked in)

Confirmed against the Babylon.js GUI3D API docs and the `react-babylonjs` reconciler
(`brianzinn/react-babylonjs`), which enumerates the canonical 3D control set. Build the
port's prop names to match Babylon's real names so the mapping is faithful and
predictable. Do not invent or rename.

**Canonical Babylon GUI3D control set (the full tree; Wave 1 = the starred ones):**
`abstractButton3D`, `button3D` ★, `container3D` ★, `contentDisplay3D`, `control3D` ★,
`cylinderPanel` ★, `handMenu`, `holographicBackplate`, `holographicButton` ★,
`holographicSlate` ★, `meshButton3D`, `nearMenu`, `planePanel`, `scatterPanel`,
`slider3D`, `spherePanel`, `stackPanel3D` ★, `touchButton3D`, `touchHolographicButton`,
`touchHolographicMenu`, `touchMeshButton3D`, `volumeBasedPanel`.

**Verified props per Wave-1 control** (Babylon real names → port prop):

- `Control3D` (base): `position: Vector3` → `position: [x,y,z]`; `scaling` →
  `scale`; `isVisible` → `visible`; `pointerEnterAnimation` / `pointerOutAnimation` /
  `pointerDownAnimation` / `pointerUpAnimation` (the hover/press animation hooks — map
  to the semantic state animations, timings from `config/defaults.json`);
  observables `onPointerEnterObservable` / `onPointerOutObservable` /
  `onPointerDownObservable` / `onPointerUpObservable` / `onPointerClickObservable`
  → React callbacks `onPointerEnter` / `onPointerOut` / `onPointerDown` /
  `onPointerUp` / `onPointerClick`, each driven by Viro's real events
  (`onHover`/`onClickState`). `Control3D` also exposes `addBehavior` /`removeBehavior`
  (the follow/grab behaviors) — map the grab behavior to `MovableNode`.

- `Container3D`: `blockLayout: boolean` (batch children, arrange once — real Babylon
  prop, carry it); `children`. Layout delegated to `_arrangeChildren` in subclasses.

- `Button3D`: `text: string`; `imageUrl: string`; `fontColor` (hex);
  `contentResolution: number` (the `AdvancedDynamicTexture` pixel size → your
  `ViroSlate` resolution); `contentScaleRatio: number` (default 2 in Babylon — carry as
  default in config). Content is a `TextBlock` + optional `Image` rendered to the
  texture.

- `HolographicButton` (extends `Button3D`): adds `tooltipText: Nullable<string>`
  (hover tooltip, null disables — Default null); `backMaterial` / `frontMaterial` /
  `plateMaterial` (the MRTK back-plate / front-plate / content-plate materials → map to
  the glass `ViroSlate variant="glass"` + plate materials); `renderingGroupId`. The
  front-plate hover highlight tracks the pointer.

- `StackPanel3D` (extends `Container3D`): `isVertical: boolean` (Default false →
  horizontal); `margin: number` (spacing between children, meters). `_arrangeChildren`
  stacks along the chosen axis with `margin`.

- `CylinderPanel` (extends `VolumeBasedPanel`): `radius: number` (cylinder radius for
  the arc); plus the inherited `VolumeBasedPanel` props `margin: number`,
  `columns: number`, `rows: number`, and `orientation`
  (`FACEORIGIN_ORIENTATION` / `FACEORIGIN_REVERSED` / `FACEFORWARD_ORIENTATION` /
  `FACEFORWARD_REVERSED` — carry the orientation enum). Surface geometry via
  `buildCylinderGeometry` from PROMPT-2.

- `HolographicSlate`: `titleBarHeight`; `titleBarMargin`; `dimensions: Vector2`
  (slate size → `widthMeters`/`heightMeters` on `ViroSlate`); `minDimensions`;
  `defaultBehavior` (the follow / six-DoF grab behavior → `MovableNode`, grab handle =
  title bar); `renderingGroupId`. This wraps the `ViroSlate` primitive from PROMPT-3.

**Wave-2 props (for PROMPT-6, baked here so both prompts agree):**
- `VolumeBasedPanel` (base): `margin`, `columns`, `rows`, `orientation` (enum above).
- `SpherePanel` (extends `VolumeBasedPanel`): `radius: number`.
- `ScatterPanel` (extends `VolumeBasedPanel`): `iteration: number` (relaxation passes,
  Babylon default 100 — carry as config default).
- `PlanePanel` (extends `VolumeBasedPanel`): grid only, no extra props beyond the base.
- `Slider3D`: `minimum: number`; `maximum: number`; `value: number`; `step: number`;
  `isHorizontal: boolean`. Value in Zustand, never `useState`.
- `TouchHolographicButton` (extends `HolographicButton`): all `HolographicButton` props
  plus near/poke interaction; in Babylon the touch logic lives in `TouchButton3D`
  (`collisionMesh`, `collidableFrontDirection`) — map poke to Viro touch/proximity
  events, push-depth from config.
- `MeshButton3D` (extends `Button3D`): construct from an arbitrary mesh — here a
  `Viro3DObject` GLB; same `Button3D` content/state props applied to the mesh.
- `TouchHolographicMenu` / `NearMenu` / `HandMenu`: a `VolumeBasedPanel`/`StackPanel3D`
  grid of `TouchHolographicButton`s on a `holographicBackplate`, with a grab bar
  (`MovableNode`) as the only movable handle.
