# Specs Lens Studio build workflow

The device runtime is intentionally copied into a Lens Studio project as a
self-contained local module tree. It does not depend on Metro, React Native,
npm package resolution, or workspace aliases at runtime.

## 1. Install workspace dependencies

```bash
pnpm install
```

## 2. Validate the Lens runtime source

```bash
pnpm --filter @viro-external/specs specs:validate-lens
```

The validator checks that:

- required Lens runtime entry files exist;
- device-side files do not import `@viro-external/*`;
- device-side files do not import React/React Native;
- device-side files do not reach back into `../src`;
- relative Lens runtime imports resolve locally.

## 3. Open/create the Lens Studio project

The project must target **SPECS 27** and Lens Studio **5.22.0+** for the pinned
upstream package set.

## 4. Install Lens package dependencies

Install through Asset Library / project Packages:

```text
SpectaclesInteractionKit.lspkg
SurfacePlacement.lspkg
VolumetricLine.lspkg
SpecsNavigationKit.lspkg
```

For editor-driven Platform Lab validation (`specs:sync --with-validation`) also install:

```text
Leaf.lspkg
AiPreviewAgentInspect.lspkg
AiPreviewAgentInteract.lspkg
```

`specs:doctor` reads each installed version and fails below the minimums in
`lens-runtime.json`; see [SyncAndDoctor.md](./SyncAndDoctor.md#minimums).

The upstream versions are pinned by `upstream/specs-27.json`.

## 5. Sync the Viro runtime

```bash
pnpm --filter @viro-external/specs specs:sync -- \
  --project /absolute/path/to/MySpecsLens
```

Add `--with-validation` for the LEAF and Platform Lab files. Resyncing keeps
`.meta` files and your edits; see [SyncAndDoctor.md](./SyncAndDoctor.md).

This writes:

```text
MySpecsLens/
  Assets/
    ViroSpecs/
      lens/
        ViroSpecsProtocol.ts
        ViroSpecsRuntimeHost.ts
        ...
      viro-specs.dependencies.json
      viro-specs.owned.json
    ViroSpecsValidation/        (only with --with-validation)
      lens/
        ViroSpecsLeafIndex.ts
        ...
      viro-specs.owned.json
```

The generated dependency manifest records the SPECS target, Lens Studio
minimum, upstream repository SHA, runtime wire version, required Lens packages,
and optional editor-validation packages.

## 6. Wire the scene

At minimum:

1. add `ViroSpecsAssetRegistry`;
2. add `ViroSpecsRuntimeHost`;
3. point the host at the registry;
4. populate portable model/image/material IDs in the registry;
5. add `ViroSpecsInteractionHost` when interaction is required;
6. add `ViroSpecsNavigationHost` when location routes are required;
7. add `ViroSpecsPlatformLab` + `ViroSpecsAgentValidation` in the validation scene.

## 7. Preview then device

The editor validation packages can inspect the Platform Lab scene and synthesize
pinch/poke/drag. Final tracking, comfort, performance, location and permission
behavior still require physical Specs.

## Upgrade rule

Never float `specs-devs/packages` implicitly. Upgrade the pinned SHA in a
dedicated PR, run source validation, Lens preview validation, and physical
hardware checks before changing the supported SPECS/Lens Studio version.
