# Geometry — cylinder/cone derivation

## Verified Viro geometry path

`@reactvision/react-viro@2.56.0` exposes `ViroGeometry` (`components/ViroGeometry.tsx:16-21`) with explicit buffers:

```ts
type Props = {
  vertices?: Viro3DPoint[];
  normals?: Viro3DPoint[];
  texcoords?: Viro2DPoint[];
  triangleIndices?: Viro3DPoint[];
};
```

`Viro3DPoint = [number, number, number]` (`Types/ViroUtils.ts:17`), `Viro2DPoint = [number, number]`.

Materials bind via the standard `materials={["<name>"]}` prop inherited from `ViroBase` (confirmed: `ViroGeometry.tsx` converts string→array and forwards into native props).

This is the same convention used by `ViroCameraTexture`. The texture seam from `react-native-viro-mux` writes to the named material — `ViroCylinderSurface` does not import textures itself.

## Cylinder geometry — parameterization

A cylinder with independent top/bottom radii (covers cone, truncated cone, partial wrap):

- `height` — axial span (centered on origin: y ∈ [-h/2, +h/2]).
- `radiusTop`, `radiusBottom` — radii at y=+h/2 and y=-h/2.
- `radialSegments` — angular slices.
- `heightSegments` — axial slices.
- `thetaStart`, `thetaLength` — sweep window in radians. `2π` = closed; `< 2π` = open arc.
- `openEnded` — when `false`, generate top/bottom caps; when `true`, caps skipped.

### Vertex grid (lateral surface)

For `i ∈ [0, radialSegments]`, `j ∈ [0, heightSegments]`:

```
theta = thetaStart + (i / radialSegments) * thetaLength
v     = j / heightSegments                        // 0 at top, 1 at bottom
y     = h/2 - v * h
r     = radiusTop + v * (radiusBottom - radiusTop) // linear taper
x     = r * cos(theta)
z     = r * sin(theta)
```

### UV mapping

Lateral: `u = i / radialSegments`, `v = j / heightSegments`. This matches how a `ViroMuxVideo` texture lands: time advances along `u`, vertical fills `v`. Wrap mode is set by the material; the geometry assumes UV ∈ [0,1].

### Normals — slanted-surface correctness

For a truncated cone the surface normal is NOT purely radial — it tilts axially proportional to `(radiusBottom − radiusTop) / height`. Per-vertex normal:

```
slope = (radiusBottom - radiusTop) / height
n_radial_x = cos(theta)
n_radial_z = sin(theta)
nx = n_radial_x
ny = slope                                 // pre-normalize
nz = n_radial_z
n  = normalize([nx, ny, nz])
```

`slope = 0` ⇒ pure radial (vertical cylinder). Non-zero ⇒ tilted cone normals.

### Indices

```
a = j * (radialSegments + 1) + i
b = a + 1
c = a + (radialSegments + 1)
d = c + 1
triangles: (a, c, b) and (b, c, d)        // CCW when viewed from outside
```

### Caps (when `openEnded === false`)

- Top cap (only if `radiusTop > 0`): center vertex at `(0, h/2, 0)`, fan around the top ring. Normal = `(0, 1, 0)`. UVs map ring to a disk: `u = 0.5 + 0.5 cos(theta)`, `v = 0.5 + 0.5 sin(theta)` (center: `(0.5, 0.5)`).
- Bottom cap (only if `radiusBottom > 0`): symmetric, normal = `(0, -1, 0)`.

When a radius is `0` the corresponding cap collapses to the apex (cone) and its cap is implicit in the lateral surface — skip the cap fan.

### Partial wrap (`thetaLength < 2π`)

The end seams are open by default. No side caps are generated; the geometry is the open arc only. Consumers that need closed sides should compose two `ViroQuad` siblings (this is what `CylinderPanel` does in `@viro-external/gui`).

## Babylon parity

See `BabylonParity.md`.
