# Lens Studio runtime executor

The Specs backend now has two layers:

```text
portable TypeScript compiler
          ↓
SpecsRenderPlan
          ↓
Lens Studio runtime executor
          ↓
SceneObject / Text / Image / ObjectPrefab
```

The compiler remains testable with normal TypeScript. The executor lives under
`lens/` and is compiled by Lens Studio because it uses Lens-specific globals.

## Why an asset registry is required

A Viro app can identify a model with a portable string such as
`models/tutor`. Lens Studio cannot dynamically turn an arbitrary JavaScript
string or Metro `require()` value into an imported ObjectPrefab.

The registry therefore binds portable IDs to imported Lens assets in the
Inspector. This also keeps asset loading deterministic on wearable hardware.

## Runtime lifecycle

1. Place `ViroSpecsAssetRegistry` on a SceneObject.
2. Populate model/image/material ID arrays and matching Lens assets.
3. Place `ViroSpecsRuntimeHost` in the scene.
4. Assign the registry SceneObject and optional generated-content root.
5. Feed a compiled `SpecsRenderPlan` into `applyRenderPlan()`.
6. The executor creates/updates native Lens Studio objects.

The host also sets the runtime build marker used by `isSpecsBuild()`.

## Deliberate boundaries

This PR implements live scene execution only.

Native animation playback, SIK interaction wiring, WorldQuery/surface placement,
navigation, and automated test drivers are separate stacked runtime PRs so each
piece can be tested and upgraded independently.
