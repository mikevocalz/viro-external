# PROMPT-7 — `@viro-external` (the meta-package: single-import surface)

You are a **principal-level package / DX engineer**. Production packages, not demos.
Verify every API against real source. Never invent exports. If a symbol can't be
verified to exist in a sibling package, stop and say so. `npx tsc --noEmit` must pass
before any task is "done". No stubs, TODOs, or placeholder bodies in delivered code.

This is **PROMPT-7**, the thin umbrella package. It produces **no new components and no
new native code.** Its only job is to give consumers one install and one import surface
over the three real packages, with a clean dependency graph and honest docs. If you find
yourself writing a component here, you are in the wrong package — stop.

### The family it unifies (all must already exist)

```
react-native-viro-mux   (PROMPT-1)  — native bridge: ViroGPUTexture, MovableProps, MovableNode, ViroMuxVideo, ViroMuxSurface
@viro-external/core     (PROMPT-2/3/4) — ViroCylinderSurface, ViroSlate, ViroGaussianSplat (+ buildCylinderGeometry)
@viro-external/gui      (PROMPT-5/6)   — Control3D, Container3D, Button3D, HolographicButton, StackPanel3D,
                                          CylinderPanel, HolographicSlate, VolumeBasedPanel, PlanePanel, SpherePanel,
                                          ScatterPanel, TouchHolographicButton, MeshButton3D, Slider3D, TouchHolographicMenu
```

---

## Phase 0 — verify the real export surfaces first

Do **not** write re-exports from memory. For each sibling package, read its actual
`package.json` `exports`/`main`/`types` and its public `index.ts`, and enumerate the
**real** exported symbols. The list above is the intent; the source is the truth. If a
symbol in the list isn't actually exported by its package, flag it — do not invent it,
do not silently drop it.

## Phase 1 — scaffold

At the package root: `AGENTS.md`, `CLAUDE.md`, `TASKS.md`, `README.md`, and a `doc/`
map (`Install.md`, `Imports.md` — the subpath map, `Versioning.md`,
`Compatibility.md` — Expo SDK 56 / RN 0.86 overrides / `@reactvision/react-viro`
2.56.0 / PICO + Quest + visionOS notes).

- `CLAUDE.md`: terse; verified APIs only; principal/DX bar; **no re-export of a symbol
  that isn't really exported by a sibling**; semver discipline.
- `package.json`:
  - `dependencies` (not peer, not bundled): exact-pinned `react-native-viro-mux`,
    `@viro-external/core`, `@viro-external/gui` at their real published versions.
  - `peerDependencies`: `react`, `react-native`, `expo`, `@reactvision/react-viro`
    (matching the siblings' ranges — read them, don't guess).
  - `exports` map with subpaths (see Phase 2).
  - `sideEffects: false` so bundlers tree-shake unused re-exports.

## Phase 2 — the export surface (subpaths, not one flat barrel)

Provide a root barrel **and** stable subpaths, so consumers can import broadly or
narrowly and tree-shaking works:

```ts
// @viro-external            -> root barrel: re-exports core + gui + the movable contract
// @viro-external/core       -> re-export of @viro-external/core
// @viro-external/gui        -> re-export of @viro-external/gui
// @viro-external/bridge     -> re-export of react-native-viro-mux (the seam + Mux + Movable*)
```

Rules:
- The root barrel re-exports **types and components**, including `MovableProps` /
  `MovableNode` and `ViroGPUTexture` from the bridge (consumers shouldn't need to know
  the bridge package name).
- **No symbol-name collisions.** `HolographicSlate` (gui) and `ViroSlate` (core) are
  distinct and both surface; document that `HolographicSlate` is the Babylon-named
  wrapper over the `ViroSlate` primitive so consumers pick deliberately.
- Re-export, never re-declare. Every line is `export { X } from '...'` or
  `export type { X } from '...'`. No wrapper components, no prop massaging.
- If two siblings ever export the same name, **stop and flag it** — do not alias-paper
  over a real collision.

## Phase 3 — docs that prevent misuse

- `doc/Install.md`: one install line; note this pulls the three real packages; note the
  native rebuild requirement (bridge + splat are native — no Expo Go, no OTA).
- `doc/Imports.md`: a table of every public symbol → which subpath it lives on → its
  source package. Generated from the **real** export enumeration in Phase 0, not memory.
- `doc/Compatibility.md`: the verified stack matrix and the honest XR-target notes
  (4D splats are upper-tier-device only; AR-only drag modes vs VR/OpenXR; visionOS is a
  separate native driver).

## Phase 4 — quality gates

- `npx tsc --noEmit` passes against the **real** sibling type surfaces (build the
  siblings first or resolve via workspace).
- Every re-exported symbol resolves to a real export in its source package — verified,
  not assumed. Zero invented or dangling re-exports.
- Subpath `exports` resolve correctly in a clean consumer project (Metro + tsc); root
  barrel tree-shakes (`sideEffects: false`).
- No components, no native code, no prop massaging added here.
- `doc/Imports.md` matches the actual exports 1:1; `TASKS.md` fully checked.

Stop and ask before inventing an export, aliasing over a real name collision, or adding
anything that isn't a pure re-export.
