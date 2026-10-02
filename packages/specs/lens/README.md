# Viro Specs Lens runtime

This directory contains Lens Studio-specific TypeScript. It is intentionally
separate from `src/` because ordinary Node/TypeScript tooling does not provide
Lens Studio global types such as `SceneObject`, `Text`, `Image`, `vec3`,
`quat`, or the `@component` / `@input` decorators.

## Components

### ViroSpecsAssetRegistry

Maps portable Viro source IDs to imported Lens Studio assets:

- model ID -> ObjectPrefab
- image ID -> Texture
- material ID -> Material
- optional default panel prefab

This is the bridge between portable app data and editor/import-time Lens assets.

### ViroSpecsSceneRuntime

Executes `SpecsRenderPlan` against live Lens Studio objects:

- creates SceneObject hierarchy
- creates Text and Image components
- instantiates model prefabs
- optionally instantiates a default panel prefab
- applies local position / quaternion rotation / scale
- applies visibility
- updates text/image/model content
- removes or clears generated nodes

### ViroSpecsRuntimeHost

Lens component that owns the executor and sets `__VIRO_SPECS_BUILD__ = true`.
Other Lens scripts can call `applyRenderPlan()` when a shared Viro scene plan
arrives.

## Asset IDs

Portable scenes should use stable logical IDs rather than file-system paths.

Example:

```ts
{
  id: "tutor",
  kind: "model",
  source: "models/tutor"
}
```

In Lens Studio, add the imported tutor prefab to
`ViroSpecsAssetRegistry.modelPrefabs` and put `models/tutor` at the matching
index in `modelIds`.

This keeps the portable Viro scene identical across platforms while allowing
each renderer to own its native asset representation.
