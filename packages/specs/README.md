# @viro-external/specs

Adapter foundation for **Snap Specs / Spectacles**.

Snap's runtime is Lens Studio + Snap OS, so this package does not try to boot ViroCore on the glasses. It compiles a portable scene subset and defines the runtime bridge that a Lens Studio package implements.

## Shared Viro-side code

```ts
import { compileSpecsScene } from "@viro-external/specs";

const result = compileSpecsScene([
  {
    id: "root",
    kind: "group",
    position: [0, 0, -1.5],
  },
  {
    id: "prompt",
    parentId: "root",
    kind: "text",
    text: "Solve for x",
  },
  {
    id: "tutor",
    parentId: "root",
    kind: "model",
    source: "tutor.glb",
  },
]);

if (result.diagnostics.some((d) => d.level === "error")) {
  throw new Error("Scene is not portable to Specs");
}

const json = JSON.stringify(result.scene);
```

Supported portable node kinds in this first contract are `group`, `text`, `image`, `model`, and `panel`. Viro-specific render passes, physics internals, portals and native texture handles are intentionally not serialized.

## Runtime detection

The Specs adapter now exposes Expo-Horizon-style runtime detection:

```ts
import { SpecsRuntime, isSpecsDevice, useSpecs } from "@viro-external/specs";

if (isSpecsDevice()) {
  // Physical Spectacles.
}

const specs = useSpecs();
// specs.isDevice, specs.isEditor, specs.isBuild, specs.isRuntime
```

The implementation uses Snap's `global.deviceInfoSystem.isSpectacles()` and
`isEditor()`. Editor builds use an explicit `__VIRO_SPECS_BUILD__` marker so
an unrelated Lens Studio preview is never misidentified as a Specs build.

See `doc/RuntimeDetection.md` for exact semantics and examples.

## SPECS 27 upstream packages

The long-term renderer is pinned to the public `specs-devs/packages` SPECS 27 package set instead of reimplementing every Lens Studio primitive from scratch. The pin, package roles, upgrade rules, and licensing notes live in `upstream/specs-27.json` and `doc/UpstreamIntegration.md`.

The minimum renderer uses upstream scene/component access, instantiation, native AnimationPlayer patterns, SIK interaction helpers, WorldQuery hit testing, and SurfacePlacement. Navigation, volumetric lines, camera helpers, shaders, and automated agent inspection are opt-in capability layers.

## Lens Studio runtime boundary

The Lens Studio side implements `SpecsRuntimeTransport`:

```ts
type SpecsRuntimeTransport = {
  getCapabilities(): XRCapabilityReport;
  applyScene(scene: SpecsSceneSnapshot): void | Promise<void>;
  onInteraction(
    listener: (event: PortableXRInteraction) => void
  ): () => void;
  dispose(): void | Promise<void>;
};
```

That bridge maps:

```text
Portable group  -> Lens Studio SceneObject hierarchy
Portable text   -> Lens Studio text/UI visual
Portable image  -> Lens Studio image/material visual
Portable model  -> imported Lens Studio asset / render mesh
Portable panel  -> Spectacles UI Kit / Interaction Kit surface

gaze/hand hover -> PortableXRInteraction hover-*
pinch/trigger   -> select-start / select-end
drag            -> drag
```


## Moyo layout reuse

The Moyo Learn three-slot XR composition is useful here because its `worldSlot` transform is engine-independent. The same left/center/right poses that Viro uses can be serialized into `PortableXRNode` transforms and applied to Lens Studio SceneObjects.

That means we keep one authored spatial composition instead of creating a Snap-specific set of magic numbers.

See `doc/Architecture.md` for the ownership and validation rules.

## Camera example

Camera remains a Snap-native capability rather than a Viro texture contract. On Spectacles, Lens Scripting exposes `LensStudio:CameraModule`, including high-resolution still capture suitable for OCR-style workflows:

```js
const CameraModule = require("LensStudio:CameraModule");

async function captureStill() {
  const request = CameraModule.createImageRequest();
  const frame = await CameraModule.requestImage(request);
  return frame.texture;
}
```

Keep camera frames inside the Snap runtime unless the product explicitly needs to transfer them elsewhere; Snap applies privacy restrictions when camera/user APIs are combined with internet or cross-session APIs.

## Mobile continuity

Snap also provides Mobile Kit for continuity between Spectacles experiences and mobile apps. That can become a transport option later, but it should not be confused with the renderer bridge itself.

## Current PR boundary

This PR establishes the portable scene compiler and runtime transport contract. A follow-up Lens Studio package should implement the actual SceneObject/UI Kit/SIK mappings and run in the Spectacles simulator/device before this target is marked renderer-complete.
