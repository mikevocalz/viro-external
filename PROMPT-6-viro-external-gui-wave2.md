# PROMPT-6 — `@viro-external/gui`: Babylon 3D GUI Wave 2 (the rest of the tree)

You are a **principal-level XR UI engineer and top design engineer**. Production
packages, not demos. Verify every API against real source. Never invent props,
classes, or methods. If a symbol can't be verified, stop and say so. `npx tsc --noEmit`
must pass before any task is "done". No stubs, TODOs, or placeholder bodies in
delivered code.

This is **PROMPT-6**, the second wave of `@viro-external/gui`. It **extends the Wave-1
spine from PROMPT-5** — it must not re-implement bases, layout primitives, or
movability. Every control here is a subclass or sibling of something Wave 1 already
built. If a Wave-1 base is missing a hook you need, **stop and flag it** rather than
fork the base.

### Hard dependency: the Wave-1 spine (PROMPT-5)

```ts
import {
  Control3D,            // abstract base
  Container3D,          // base container w/ blockLayout + _arrangeChildren hook
  Button3D,
  HolographicButton,
  StackPanel3D,
  CylinderPanel,        // VolumeBasedPanel-style curved layout exemplar
  HolographicSlate,
} from '@viro-external/gui';
```

And the lower layers it transitively relies on:

```ts
import { ViroGPUTexture, MovableProps, MovableNode } from 'react-native-viro-mux';     // PROMPT-1
import { ViroSlate, buildCylinderGeometry } from '@viro-external/core';                // PROMPT-3, PROMPT-2
```

Use Viro's **real** event system (`onClick`, `onClickState`, `onHover`, `onDrag`,
`onPinch`, `onFuse`, `onTouch` — verify names in `@reactvision/react-viro` 2.56.0). No
invented events. Honor the **VR-vs-AR drag-mode matrix** PROMPT-1 documented; default
`dragType` is `FixedDistance`.

---

## Phase 0 — scaffold (additive to PROMPT-5's package)

This lands in the same `@viro-external/gui` package PROMPT-5 created. Update, don't
fork: extend `TASKS.md` with a Wave-2 section; extend `config/defaults.json` with the
new tunables (slider track length, menu grid spacing, sphere/scatter radii, touch
push-depth); add `doc/` pages `VolumeBasedPanel.md`, `Controls-Wave2.md`. Keep
`CLAUDE.md` prefs identical (Zustand for state, verified APIs only, principal/design
bar, semantic motion, performance is a feature).

## Phase 1 — verify the real Babylon classes (confirm before mapping)

Confirm each against the **verified prop tables baked into PROMPT-5 Appendix B** (the
Wave-2 section lists every prop for these eight controls). Build to those names; do not
re-derive. The eight Wave-2 controls and their real Babylon parents:

- `VolumeBasedPanel` — abstract base for the volume layout panels (extends
  `Container3D`). Owns `margin`, `columns`, `rows`, and the per-child mapping onto a
  volume surface via an `_arrangeChildren`-equivalent.
- `PlanePanel` extends `VolumeBasedPanel` — children laid on a flat plane grid.
- `SpherePanel` extends `VolumeBasedPanel` — children mapped onto a sphere section
  (verify `radius`).
- `ScatterPanel` extends `VolumeBasedPanel` — children scattered, then iteratively
  de-overlapped (verify `iteration` prop).
- `TouchHolographicButton` extends `HolographicButton` — adds near/touch interaction
  (poke), front-plate push depth.
- `MeshButton3D` extends `Button3D` — uses an arbitrary mesh as the button (here: a
  `Viro3DObject` GLB) instead of a generated plate.
- `Slider3D` — a 3D slider (verify `minimum`, `maximum`, `value`, `step`).
- `TouchHolographicMenu` (a.k.a. the MRTK near menu) — a `StackPanel3D`/grid of
  `TouchHolographicButton`s with a backplate and grab bar.

Document parent → this-component → which Wave-1 base/primitive it composes in
`doc/Controls-Wave2.md`.

## Phase 2 — deliverables, in dependency order

1. **`VolumeBasedPanel`** (build first — three panels extend it). `Container3D`
   subclass. Implements the shared volume-layout machinery: collect children, compute a
   target position+orientation per child on the panel's volume, call the base
   `_arrangeChildren` hook. Expose `margin`, `columns`, `rows`. Each concrete panel
   below only supplies its volume-mapping function.

2. **`PlanePanel`** — flat grid mapping (rows × columns, `margin`-spaced). Provably
   non-overlapping by construction; document the cell-size derivation.

3. **`SpherePanel`** — maps the same grid onto a spherical section at `radius`; each
   child faces the user (billboard toward center). Document the angular-spacing
   derivation so cells never overlap at the given `radius`.

4. **`ScatterPanel`** — initial scatter + iterative relaxation (`iteration` passes) to
   remove overlaps. Deterministic given a seed (Zustand-held, not `Math.random` inline).

5. **`TouchHolographicButton`** — extends `HolographicButton`: adds poke/near input
   (front-plate compresses by a configured push-depth on touch, springs back), using
   Viro's real touch/proximity events. Where on-device near-field input isn't reachable
   through the prebuilt renderer, fall back to ray `onClick` and **document the
   limitation honestly** (this is a capability limit, not a quality fallback).

6. **`MeshButton3D`** — extends `Button3D`: wraps a `Viro3DObject` GLB as the button
   body, with the same semantic hover/press states (material/scale response) applied to
   the mesh. Verify `Viro3DObject` GLB loading + material override against source.

7. **`Slider3D`** — track + thumb; thumb is a `MovableNode` constrained to the track
   axis via `axisLock` (this is exactly why `axisLock` exists — Viro can't line-lock a
   drag natively). Emits `value` ∈ [`minimum`, `maximum`] snapped to `step`. State in
   Zustand, never `useState`.

8. **`TouchHolographicMenu`** — a backplate (`ViroSlate variant="glass"`) hosting a grid
   of `TouchHolographicButton`s laid out by `StackPanel3D`/`PlanePanel`, with a grab bar
   that is the **only** movable handle (movability via the container rule from PROMPT-5:
   the menu moves as a unit; its buttons do not drag loose).

## Phase 3 — discipline (inherited, restated)

- **No hand-typed world positions.** Use the `SceneRig`/`SceneZone` zone model from
  PROMPT-5's `doc/Composition.md`. A panel goes *inside one zone*; it does its own
  internal non-overlap layout.
- **Movability:** containers move as a unit via `MovableNode`; child controls never wire
  their own `onDrag`; a control with a movable ancestor ignores its own `movable`. The
  one exception is `Slider3D`'s thumb, which is an intentional axis-locked internal drag.
- Hover/press/poke states must be **semantically meaningful** (timings from
  `config/defaults.json`), not decorative.
- Comfort cone, panel-spacing, and hitbox-separation rules from PROMPT-5 apply
  unchanged.

## Phase 4 — quality gates

- `npx tsc --noEmit` passes.
- Each control maps to a verified Babylon class with verified prop names, documented.
- `PlanePanel`, `SpherePanel`, `ScatterPanel` produce provably non-overlapping layouts;
  derivations documented; `ScatterPanel` is deterministic given a seed.
- `Slider3D` thumb is axis-locked to the track and snaps to `step`; value in Zustand.
- `TouchHolographicMenu` moves only by its grab bar; child buttons don't drag loose.
- Near/touch input either works or its absence is documented as a capability limit (no
  faked poke, no quality-degradation fallback).
- No invented Babylon or Viro APIs; `config/defaults.json` holds every tunable;
  `TASKS.md` Wave-2 section fully checked.

Stop and ask before forking any Wave-1 base, forcing a conflicting dependency, or
inventing any API you can't find in Babylon or Viro source.
