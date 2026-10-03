# viro-external

viro-external is a pnpm workspace of packages that sit on top of the Viro
fork (`@reactvision/react-viro`). You write a scene once in JSX with
`@viro-external/ui`, and it renders natively through Viro and on Snap Specs
through Lens Studio. On Specs the same tree is mapped to portable scene nodes
at build time and played by a Lens Studio runtime; ViroCore never runs on the
glasses.

## Packages

| Package | Directory | What it is |
| --- | --- | --- |
| `@viro-external/ui` | `packages/ui` | Spatial panels, headers, buttons, scrolling, layout and data components, video and Rive panels, and the Specs mapper (`toPortableScene`). See [packages/ui/README.md](packages/ui/README.md). |
| `@viro-external/specs` | `packages/specs` | Portable scene compiler, runtime detection, the Lens Studio runtime (`lens/`) and the build scripts (`specs:scene`, `specs:sync`, Rive baking). See [packages/specs/README.md](packages/specs/README.md). |
| `@viro-external/xr-contract` | `packages/xr-platform-contract` | Vendor-neutral types: `PortableXRNode` kinds, capability reports, interactions, and the `XRPlatformAdapter` interface. |
| `@viro-external/core` | `packages/viro-external-core` | `MovableNode`, `ViroCylinderSurface`, `ViroSlate`, `ViroGaussianSplat`, cylinder geometry, and shared spatial types (`Vec3`, `MovableProps`). |
| `@viro-external/media` | `packages/media` | Provider-neutral video for Viro: `SpatialVideoPlayer`, `SpatialVideoPlayerView`, `SpatialVideo`, `VideoSurface`, `SpatialPanorama`, and Mux helpers (`MuxSpatialPlayer`, `muxSource`, playback/thumbnail/storyboard URLs). |
| `@viro-external/premium` | `packages/premium` | One import surface that re-exports the main parts of core, media and ui, plus `Core`, `Media` and `UI` namespaces. |
| `@viro-external/render-passes` | `packages/render-passes` | Multiplex layer for `VROChoreographer::setCustomPostOpaquePass`, so the orb, splat and later passes share the single choreographer slot. |
| `@viro-external/splat-pass` | `packages/splat-pass` | Native 3D Gaussian splat render pass (`registerSplatPass` / `unregisterSplatPass`). |
| `@viro-external/orb-pass` | `packages/orb-pass` | D.E.C.A. orb render pass inside Viro's OpenXR per-eye frame (`registerOrbPass` / `unregisterOrbPass`). |
| `@viro-external/webspatial` | `packages/webspatial` | WebSpatial 2.x layout adapter (`WebSpatialAdapter`, `createWebSpatialMainScene`) with PICO OS 6 and ordinary-web fallback. |
| `@viro-external/meta-wearables` | `packages/meta-wearables` | Meta Wearables Device Access Toolkit 1.0 integration foundation (`MetaWearablesAdapter`). |
| `@viro-external/pano` | `packages/pano` | Compatibility entry point: re-exports `SpatialPanorama` from media, also as `ViroPano`. |
| `@viro-external/gui` | `packages/viro-external-gui` | Legacy GUI components (`Button3D`, `HolographicSlate`, `Slider3D`, `Keyboard3D`, ...). New UI goes in `@viro-external/ui`. |
| `@viro-external/meta` | `packages/viro-external-meta` | Legacy umbrella package kept so existing imports work. New code uses `@viro-external/premium`. |
| `react-native-viro-mux` | `packages/react-native-viro-mux` | Legacy Nitro external-texture bridge for older apps. New video uses `@viro-external/media`. |

## Prerequisites

- **Node** `>=22.13.0` (root `package.json` `engines`).
- **pnpm 12** (`packageManager: pnpm@12.8.1`).
- **The Viro fork, checked out next to this workspace.** `pnpm-workspace.yaml`
  overrides the dependency:

  ```yaml
  overrides:
    "@reactvision/react-viro": "link:../viro-specs-preview"
  ```

  So `../viro-specs-preview` must be a checkout of the fork on its
  Specs-preview branch. That branch carries the Specs compiler and
  `ViroRivePanel`, and its version (`3.0.2-moyo.0` at the time of writing)
  satisfies the `>=3.0.1-moyo.0 <4.0.0` peer range in the packages. Other
  checkouts of the fork, such as `../viro`, have neither.
- **Lens Studio 5.22 or later** (`packages/specs/upstream/specs-27.json`
  pins `>=5.22.0`), with SpectaclesUIKit, SpectaclesInteractionKit and Leaf
  installed in the Lens project. `specs:sync` writes the full required list
  to `Assets/ViroSpecs/viro-specs.dependencies.json`.
- **ffmpeg** on `PATH`, for Rive baking.
- **The `rive` CLI** (optional). Rive baking runs `rive inspect --json` when a
  `RivePanel` points `specs.project` at an RML project. A saved inspect JSON
  (`specs.inspect`) works without it.
- **A Playwright Chromium**, for Rive baking. The bake uses
  `VIRO_RIVE_CHROMIUM` if set, else playwright-core's own build, else the
  newest `chromium-*` build in `~/Library/Caches/ms-playwright`. If none is
  found: `npx playwright-core install chromium`.

## Setup

```sh
git clone <fork> ../viro-specs-preview   # Specs-preview branch, sibling of this repo
pnpm install
pnpm typecheck
```

`pnpm typecheck` runs `tsc --noEmit` in every package that has a
`typecheck` script.

## Cross-platform workflow

1. **Write a scene file** (`.tsx`) with `@viro-external/ui` and plain Viro
   primitives. Its default export is the JSX tree, or a function that returns
   it. It may also export `animations` (the ViroAnimations registrations it
   uses) and `resolveSource(source, kind)` to map bundled assets to Lens
   asset registry ids. `packages/specs/examples/harlem-courts.tsx` is a
   complete example. In the Viro app, render the same component.

2. **Copy the Lens runtime into the Lens project**:

   ```sh
   pnpm --filter @viro-external/specs specs:sync -- --project "/path/to/Lens Project"
   ```

3. **Compile the scene** into the project:

   ```sh
   pnpm --filter @viro-external/specs specs:scene -- \
     --entry examples/harlem-courts.tsx \
     --project "/path/to/Lens Project"
   ```

   This writes `Assets/ViroSpecs/generated/ViroGeneratedSceneHost.ts` and
   bakes any Rive panels into `Assets/ViroSpecs/Media/rive/`. With
   `--filter`, the entry path is relative to `packages/specs`.

4. **Open the project in Lens Studio** and check it in Preview.

5. **Run the LEAF scenarios** registered in
   `packages/specs/lens/ViroSpecsLeafIndex.ts`:

   | Scenario | Checks |
   | --- | --- |
   | `viro_specs_scene_smoke` | The scene materialized in Preview with the expected hierarchy and meter-to-centimeter conversion. |
   | `viro_specs_interaction` | The SIK interaction path used on device, driven inside Preview. |
   | `viro_specs_frame` | The panel's requested and drawn Frame size, a grab-move, and the video panel's fit. Corner resize is not driven (LEAF drags target the centre), so it stays a device check. |
   | `viro_specs_rive` | The baked Rive panel starts on its first clip, advances within that clip's frames, and a pinch moves Loading to Entering to Idle. |

For native Rive playback without the canvas runtime, bake the same panels for
the app with `specs:bake-rive-native` (see
[packages/ui/README.md](packages/ui/README.md#rivepanel)).

## Testing

```sh
pnpm typecheck
pnpm --filter @viro-external/specs specs:test-runner
```

`specs:test-runner` runs the Node tests in `packages/specs/scripts`
(`go-clad.test.mjs`, `render-plan.test.mjs`, `ui-scene.test.mjs`). For the
Lens side, `specs:validate-lens` checks the runtime files' imports and
`specs:typecheck-lens -- --project ...` typechecks them against a Lens
project's declarations.

## What is verified where

| Target | Status |
| --- | --- |
| Lens Studio Preview | Verified with the LEAF scenarios above against the Harlem Courts example. |
| Specs device | Not verified yet. Nothing here has run on Spectacles hardware. |
| Native Viro components | Typechecked. Headset testing is in progress. |

## Legacy packages

`react-native-viro-mux`, `@viro-external/meta`, `@viro-external/gui` and
`@viro-external/pano` stay in the workspace for existing apps. New media and
panel work does not depend on them.
