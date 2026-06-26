# Imports — public symbol map

Every symbol below is **verified** against its source package's `src/index.ts`. Generated from real exports, not memory.

## Subpaths

| Subpath                      | Source package              |
| ---------------------------- | --------------------------- |
| `@viro-external/meta`        | All three (root barrel)     |
| `@viro-external/meta/bridge` | `react-native-viro-mux`     |
| `@viro-external/meta/core`   | `@viro-external/core`       |
| `@viro-external/meta/gui`    | `@viro-external/gui`        |

## Bridge — `react-native-viro-mux`

| Symbol                       | Kind  |
| ---------------------------- | ----- |
| `ExternalTextureHandle`      | type  |
| `ExternalTextureSource`      | type  |
| `ViroGPUTextureProps`        | type  |
| `ViroGPUTextureModule`       | type  |
| `ViroDragType`               | type  |
| `ViroDragPlane`              | type  |
| `Vec3`                       | type  |
| `AxisLock`                   | type  |
| `MovableProps`               | type  |
| `MovableNodeComponent`       | type  |
| `MovableNode`                | value |
| `createPlaceholderMaterial`  | value |
| `ViroMuxVideo`               | value |
| `ViroMuxVideoProps`          | type  |
| `MuxTokens`                  | type  |
| `ViroMuxSurface`             | value |
| `ViroMuxSurfaceProps`        | type  |

## Core — `@viro-external/core`

| Symbol                          | Kind  |
| ------------------------------- | ----- |
| `ViroCylinderSurface`           | value |
| `ViroCylinderSurfaceProps`      | type  |
| `buildCylinderGeometry`         | value |
| `BuildCylinderOptions`          | type  |
| `CylinderGeometryBuffers`       | type  |
| `ViroSlate`                     | value |
| `ViroSlateMaterialNames`        | value |
| `ViroSlateProps`                | type  |
| `ViroGaussianSplat`             | value |
| `ViroGaussianSplatProps`        | type  |
| `ViroGaussianSplatSource`       | type  |
| `ViroGaussianSplatMeta`         | type  |
| `SplatSourceFormat`             | type  |
| `isNativeSplatRendererAvailable`| value |
| `fallbackDeviceProfile`         | value |
| `NativeSplatRendererModule`     | type  |

## GUI — `@viro-external/gui`

### Wave 1

| Symbol                | Kind  |
| --------------------- | ----- |
| `Control3D`           | value |
| `Control3DProps`      | type  |
| `PointerEvent`        | type  |
| `Container3D`         | value |
| `Container3DProps`    | type  |
| `ArrangedChild`       | type  |
| `ArrangeContext`      | type  |
| `Button3D`            | value |
| `Button3DProps`       | type  |
| `HolographicButton`   | value |
| `HolographicButtonProps` | type |
| `StackPanel3D`        | value |
| `StackPanel3DProps`   | type  |
| `CylinderPanel`       | value |
| `CylinderPanelProps`  | type  |
| `VolumeOrientation`   | type  |
| `deriveCylinderArc`   | value |
| `HolographicSlate`    | value |
| `HolographicSlateProps`| type |
| `SceneZone`           | value |
| `SCENE_ZONES`         | value |
| `SceneZoneProps`      | type  |
| `SceneZoneName`       | type  |
| `MovablePanelContext` | value |
| `useInsideMovablePanel`| value|
| `useGuiStore`         | value |
| `GuiState`            | type  |

### Wave 2

| Symbol                       | Kind  |
| ---------------------------- | ----- |
| `VolumeBasedPanel`           | value |
| `VolumeBasedPanelProps`      | type  |
| `VolumeMapper`               | type  |
| `VolumeMappingContext`       | type  |
| `PlanePanel`                 | value |
| `PlanePanelProps`            | type  |
| `SpherePanel`                | value |
| `SpherePanelProps`           | type  |
| `deriveSphereSpacing`        | value |
| `ScatterPanel`               | value |
| `ScatterPanelProps`          | type  |
| `TouchHolographicButton`     | value |
| `TouchHolographicButtonProps`| type  |
| `MeshButton3D`               | value |
| `MeshButton3DProps`          | type  |
| `Slider3D`                   | value |
| `Slider3DProps`              | type  |
| `useSliderStore`             | value |
| `TouchHolographicMenu`       | value |
| `TouchHolographicMenuProps`  | type  |

## Name collisions

| Symbol             | Surfaced? | Resolution |
| ------------------ | --------- | ---------- |
| `ViroSlate` (core) vs `HolographicSlate` (gui) | both | distinct names — both surface as-is. `HolographicSlate` is the Babylon-named wrapper of `ViroSlate`. |

No actual collisions exist between the three packages — every name is unique.
