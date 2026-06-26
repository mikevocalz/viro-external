# Babylon parity — `ViroCylinderSurface` prop map

Babylon.js `MeshBuilder.CreateCylinder(name, options, scene)` accepts:

| Babylon option       | Type       | Our prop              | Notes |
| -------------------- | ---------- | --------------------- | ----- |
| `height`             | `number`   | `height`              | Identical. |
| `diameterTop`        | `number`   | `radiusTop`           | We expose radius (= diameter/2) — simpler math, matches three.js. Document the /2 mapping for migrators. |
| `diameterBottom`     | `number`   | `radiusBottom`        | Same. |
| `tessellation`       | `number`   | `radialSegments`      | Renamed for three.js parity and clarity. |
| `subdivisions`       | `number`   | `heightSegments`      | Renamed for the same reason. |
| `arc`                | `number` (0..1) | `thetaLength` (radians) | Babylon's `arc` is a 0..1 fraction of 2π. Ours is radians directly. `thetaLength = arc * 2π`. |
| `hasRings`           | `boolean`  | (not exposed)         | Babylon-specific shading aid; not needed. |
| `cap`                | `Mesh.NO_CAP \| CAP_START \| CAP_END \| CAP_ALL` | `openEnded` | We collapse to a boolean: `openEnded=true` ⇒ `NO_CAP`; `openEnded=false` ⇒ `CAP_ALL`. Per-end caps were not requested; if needed later, expose `cap?: 'none' \| 'top' \| 'bottom' \| 'both'`. |
| `enclose`            | `boolean`  | (not exposed)         | Partial-arc side caps. Not requested — composers add `ViroQuad` siblings. |
| (no Babylon equivalent) |        | `thetaStart`          | Three.js parity — lets you rotate the arc start. |
