# Layout algorithms

## StackPanel3D

```
for each child i ∈ [0, N):
  offset = -(N-1)/2 * step + i * step
  if isVertical: place at [0, offset, 0]
  else:          place at [offset, 0, 0]
where step = childAdvance + margin
```

`childAdvance` is the child's bounding-axis advance, defaulting to `button.widthMeters` (horizontal) or `button.heightMeters` (vertical). Babylon's `_arrangeChildren` uses each control's own bounds when known; we fall back to the default size when a child doesn't expose one.

Non-overlap is by construction: `step ≥ childAdvance` always.

## CylinderPanel

Cylindrical arc grid: `rows × columns` slots distributed on a vertical cylinder of radius `r`.

```
angularSpan      = 2 * asin(itemWidth / (2 * r)) + marginRadians
minStepDegrees   = degrees(angularSpan)
totalDegrees     = columns * minStepDegrees
arcDegrees       = clamp(totalDegrees, 0, 360)
for each child (col, row):
  theta  = -arcDegrees/2 + (col + 0.5) * (arcDegrees / columns)
  y      = (rows-1)/2 * (itemHeight + margin) - row * (itemHeight + margin)
  pos    = [r * sin(rad(theta)), y, -r * cos(rad(theta))]
  facing = orientation enum (see below)
```

### `minStepDegrees` derivation (proof of non-overlap)

For two adjacent items at angles `θ` and `θ + step`, separation on the cylinder surface is `2 r sin(step / 2)`. To never overlap an item of width `itemWidth`:

```
2 r sin(step/2) ≥ itemWidth
step ≥ 2 asin(itemWidth / (2r))
```

We add `marginRadians` so adjacent items leave breathing room. `minStepDegrees = degrees(2 asin(itemWidth/(2r)) + marginRadians)`. If `columns * minStepDegrees > 360`, the panel is **over-subscribed** and we throw — the design is wrong, not the layout.

### Orientation

| Enum                       | Child facing rule |
| -------------------------- | ----------------- |
| `FACEORIGIN_ORIENTATION`   | rotation aligns child surface with `[0,0,0]` (children face the user at origin). |
| `FACEORIGIN_REVERSED`      | reversed of above (back faces origin). |
| `FACEFORWARD_ORIENTATION`  | all children face forward `(0,0,-1)` regardless of arc position. |
| `FACEFORWARD_REVERSED`     | reversed of above. |
