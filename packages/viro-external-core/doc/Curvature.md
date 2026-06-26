# Curvature — flat ↔ curved slate

| `curvature` | Geometry path                                  | Visual |
| ----------- | ---------------------------------------------- | ------ |
| `0`         | `ViroQuad` (flat).                             | A window flush with its facing plane. |
| `(0, 1]`    | `ViroGeometry` from `buildCylinderGeometry` with `thetaLength = curvature * (2π/3)`, `radius = widthMeters / 2 / sin(thetaLength/2)`. | A slightly-wrapped panel; at `1` it spans ~120° of arc. |

The arc is *vertical* (the cylinder's axis is vertical, the curve sweeps horizontally), which matches the natural reading posture for content panels.

UVs come straight from `buildCylinderGeometry`: `u` along the arc (left→right), `v` along the height (top→bottom). A texture rendered at the same aspect ratio as the slate maps 1:1.
