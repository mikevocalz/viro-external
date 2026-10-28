# Viro Specs Lens runtime

This directory contains Lens Studio-specific TypeScript. It is intentionally
separate from `src/` because ordinary Node/TypeScript tooling does not provide
Lens Studio global types such as `SceneObject`, `Text`, `Image`, `vec3`,
`quat`, or the `@component` / `@input` decorators.

## Components

### ViroSpecsSceneControllerHost (start here)

Lens component that owns one `ViroSpecsSceneController`. Inputs:
`assetRegistryObject` (the `ViroSpecsAssetRegistry`), optional `root`, and
`maxCachedMaterials`. Generated hosts (`viro-specs-compile --format lens-ts`)
call `present()` on it.

| Call | Use for | Behavior |
| --- | --- | --- |
| `present(doc)` | navigation | validate, stage under a disabled root, commit, retire the previous scene; a failure keeps the previous scene |
| `update(doc)` | state change | diff by ID, apply create/update/remove/reparent ops; untouched nodes keep their SceneObjects, scroll, focus and selection |
| `applyPatch(ops)` | explicit ops from Lens code | same ops, invalid ones skipped with `VS5013` |
| `queueAction(fn)` | work started inside an SIK callback | runs next frame unless navigation retires the scene first |
| `dispatchInteraction(e)` | gaze, LEAF or accessibility input | delivered like an SIK event |
| `addOnInteractionListener`, `addOnLifecycleListener`, `addOnDiagnosticListener` | app code | each returns a subscription with an idempotent `remove()` |

Scenes are protocol 2 documents (`ViroSpecsSceneDocumentV2`) or protocol 1
snapshots. Nothing throws: problems are `VS5xxx` diagnostics
(`doc/LensHostDiagnostics.md`), also written with `console.*`. Design:
`docs/adr/0002-specs-incremental-apply.md` at the repo root.

Files: `ViroSpecsSceneController.ts`, `ViroSpecsSceneDocument.ts`,
`ViroSpecsSceneBackend.ts`, `ViroSpecsResourceCache.ts` and
`ViroSpecsHostDiagnostics.ts` use no Lens globals and are tested in Node
(`pnpm specs:test-host`). `ViroSpecsLensSceneBackend.ts`,
`ViroSpecsSikBinding.ts` and `ViroSpecsSceneControllerHost.ts` are the Lens
side.

### ViroSpecsActionsLab and ViroSpecsActionRuntime (typed actions)

`ViroSpecsActionRuntime` turns pinches into app state with no phone: a
trigger on a node fires a declared action, `ViroSpecsActionRegistry` runs
its handler `(state, payload) => state`, and `view(state)` is sent to the
controller host with `update` (a new `route` navigates; the same route
patches). `ViroSpecsActionsLab` runs the reference flow
(`ViroSpecsReferenceFlow`): add it to a SceneObject and set
`controllerHostObject` to the object holding `ViroSpecsSceneControllerHost`.
Guide: [../doc/ActionsAndState.md](../doc/ActionsAndState.md).

### ViroSpecsInteractionKit

The only file that imports the Interaction Kit. `pnpm specs:sync` rewrites
it for the 4.0.0 package name (`InteractionKit.lspkg`); see
`doc/Compatibility.md`.

### ViroSpecsAssetRegistry

Maps portable Viro source IDs to imported Lens Studio assets:

- model ID -> ObjectPrefab
- image ID -> Texture
- material ID -> Material
- font family -> Font (`fontIds`/`fonts`)
- optional default panel prefab, default font and image material
- optional `placeholderMaterial` (missing-asset box), `defaultMaterial`
  (base for scene-defined materials) and `defaultLineMaterial` (polylines)

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
