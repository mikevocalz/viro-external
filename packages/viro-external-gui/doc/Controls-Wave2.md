# Controls — Wave 2

Eight controls layered on the Wave-1 spine. No Wave-1 base is forked.

| Component                  | Babylon parent              | Composes |
| -------------------------- | --------------------------- | -------- |
| `VolumeBasedPanel`         | `VolumeBasedPanel`          | `Container3D` + a `VolumeMapper` injected by concrete panels |
| `PlanePanel`               | `PlanePanel`                | `VolumeBasedPanel` with a flat-grid mapper |
| `SpherePanel`              | `SpherePanel`               | `VolumeBasedPanel` with a sphere-section mapper + billboarding |
| `ScatterPanel`             | `ScatterPanel`              | `VolumeBasedPanel` with a seeded scatter + iterative relaxation |
| `TouchHolographicButton`   | `TouchHolographicButton`    | `HolographicButton` + Z-push on press |
| `MeshButton3D`             | `MeshButton3D`              | `Control3D` + `Viro3DObject` (verified props) |
| `Slider3D`                 | `Slider3D`                  | `MovableNode` axis-locked thumb + Zustand value |
| `TouchHolographicMenu`     | `TouchHolographicMenu` / `NearMenu` | `ViroSlate variant="glass"` backplate + `PlanePanel` of `TouchHolographicButton`s + `MovableNode` grab |

## Layout derivations

### PlanePanel (non-overlap proof)

`stepX = cellWidth + margin`, `stepY = cellHeight + margin`. By construction `stepX ≥ cellWidth` and `stepY ≥ cellHeight`, so no two cells overlap. Total grid: `columns × stepX − margin` wide, `rows × stepY − margin` tall.

### SpherePanel (`deriveSphereSpacing`)

Cells laid on a sphere of radius `r`. Horizontal step: `stepPhi = 2·asin(cellWidth / (2r)) + marginRadians`. Vertical step: `stepTheta = 2·asin(cellHeight / (2r)) + marginRadians`. Throws when `columns·stepPhi > 2π` or `rows·stepTheta > π` (over-subscribed). Children billboard toward origin: `rotation = [pitch, yaw, 0]` where `pitch = θ`, `yaw = φ`.

### ScatterPanel determinism

Initial scatter from `mulberry32(seed)`. Up to `iteration` passes of pairwise push (separation < `minSep` ⇒ split). Early-exit when a pass moves nothing. Identical `(seed, count, iteration, minSep, area)` ⇒ identical output (verified in self-check).

## Touch input — capability limit (honest, not faked)

`TouchHolographicButton` carries Babylon's `collisionMesh` and `collidableFrontDirection` for API parity but **does not implement near-field poke detection** — the prebuilt ViroReact renderer does not expose a touch/proximity event surface we can hook. The press animation runs from ray `onClickState` (`CLICK_DOWN` → press, `CLICK_UP` → release). When a touch-capable renderer lands (or a Nitro module taps the runtime's near-field events), this flips on without an API change. **This is a capability limit, not a quality-degradation fallback.**

## Slider3D and `axisLock`

`Slider3D` is the canonical reason `axisLock` exists in PROMPT-1: Viro cannot line-lock a drag natively. The thumb is a `MovableNode` with `axisLock` = `['y','z']` (horizontal slider) or `['x','z']` (vertical). Value lives in a Zustand store (`useSliderStore`), never `useState`.

## Movability rule (unchanged from Wave 1)

`TouchHolographicMenu` is movable as a unit by its grab bar; its child `TouchHolographicButton`s drop their own `movable` per `MovablePanelContext`. `Slider3D`'s thumb is an intentional axis-locked internal drag — the only exception.
