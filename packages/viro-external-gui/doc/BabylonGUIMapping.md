# Babylon GUI3D mapping

Source: Babylon.js GUI3D API + `react-babylonjs` reconciler canonical control set.

## Wave 1 (this package — built)

| Babylon class       | This port              | Babylon prop      | Port prop                | Notes |
| ------------------- | ---------------------- | ----------------- | ------------------------ | ----- |
| `Control3D`         | `Control3D`            | `position: Vector3` | `position: [x,y,z]`    | Vec3 tuple. |
|                     |                        | `scaling`         | `scale`                  | |
|                     |                        | `isVisible`       | `visible`                | |
|                     |                        | `pointerEnterAnimation` | (semantic state) | Hover scale + timing from config. |
|                     |                        | `pointerDownAnimation`  | (semantic state) | Press scale + timing from config. |
|                     |                        | `onPointerEnterObservable` | `onPointerEnter`  | Driven by Viro `onHover` (isHovering=true). |
|                     |                        | `onPointerOutObservable`  | `onPointerOut`    | Driven by Viro `onHover` (isHovering=false). |
|                     |                        | `onPointerDownObservable` | `onPointerDown`   | Driven by Viro `onClickState` (CLICKED_DOWN). |
|                     |                        | `onPointerUpObservable`   | `onPointerUp`     | Driven by Viro `onClickState` (CLICKED_UP). |
|                     |                        | `onPointerClickObservable`| `onPointerClick`  | Driven by Viro `onClick`. |
| `Container3D`       | `Container3D`          | `blockLayout: boolean` | `blockLayout`       | Real Babylon flag — carried. |
| `Button3D`          | `Button3D`             | `text`            | `text`                   | |
|                     |                        | `imageUrl`        | `imageUrl`               | |
|                     |                        | `fontColor`       | `fontColor`              | Hex. |
|                     |                        | `contentResolution: number` | `contentResolution` | `ViroSlate` resolution. |
|                     |                        | `contentScaleRatio: number` | `contentScaleRatio` | Default 2 (Babylon real default). |
| `HolographicButton` | `HolographicButton`    | `tooltipText: Nullable<string>` | `tooltipText` | null disables. |
|                     |                        | `backMaterial`    | `backMaterial`           | Material name. |
|                     |                        | `frontMaterial`   | `frontMaterial`          | Material name. |
|                     |                        | `plateMaterial`   | `plateMaterial`          | Material name. |
|                     |                        | `renderingGroupId`| `renderingGroupId`       | |
| `StackPanel3D`      | `StackPanel3D`         | `isVertical`      | `isVertical`             | Default false (horizontal). |
|                     |                        | `margin`          | `margin`                 | Meters. |
| `CylinderPanel`     | `CylinderPanel`        | `radius`          | `radius`                 | |
|                     |                        | `margin`          | `margin`                 | |
|                     |                        | `columns`         | `columns`                | |
|                     |                        | `rows`            | `rows`                   | |
|                     |                        | `orientation`     | `orientation`            | Enum below. |
| `HolographicSlate`  | `HolographicSlate`     | `titleBarHeight`  | `titleBarHeight`         | |
|                     |                        | `titleBarMargin`  | `titleBarMargin`         | |
|                     |                        | `dimensions: Vector2` | `dimensions: {width,height}` | |
|                     |                        | `minDimensions`   | `minDimensions`          | |
|                     |                        | `defaultBehavior` | `movable`+`MovableProps`| Grab handle = title bar; via `MovableNode`. |
|                     |                        | `renderingGroupId`| `renderingGroupId`       | |

## Orientation enum

```ts
export type VolumeOrientation =
  | "FACEORIGIN_ORIENTATION"
  | "FACEORIGIN_REVERSED"
  | "FACEFORWARD_ORIENTATION"
  | "FACEFORWARD_REVERSED";
```

Babylon real names — do not abbreviate.

## Wave 2 (PROMPT-6) — prop reference

`VolumeBasedPanel` base: `margin`, `columns`, `rows`, `orientation`. `SpherePanel`: + `radius`. `ScatterPanel`: + `iteration` (Babylon default 100). `PlanePanel`: no extras beyond base. `Slider3D`: `minimum`, `maximum`, `value`, `step`, `isHorizontal`. `TouchHolographicButton`: HoloButton + `collisionMesh`, `collidableFrontDirection`. `MeshButton3D`: Button3D + a `Viro3DObject` GLB.
