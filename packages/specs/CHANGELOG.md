# Changelog: @viro-external/specs

Versions follow semver with the 0.x rule: a minor bump (0.2 to 0.3) may
break the API, the scene wire format or the Lens host inputs; a patch bump
never does. `api/specs.api.d.ts` and `api/specs-lens-core.api.d.ts` are the
API of record for each release (see [doc/Release.md](./doc/Release.md)).

## 0.3.0 (unreleased)

Needs `@viro-external/xr-contract` ^0.3.0. Pairs with
`@reactvision/react-viro` releases whose peer range includes
`@viro-external/specs` ^0.3.0. Validation tier: Lens Studio Preview
(see [doc/Compatibility.md](./doc/Compatibility.md)).

### Added

- Scene protocol 2 (`ViroSpecsSceneDocumentV2`) and
  `ViroSpecsSceneController`: validate, stage under a disabled root,
  commit, retire the previous scene, dispose a failed staging. Explicit
  create/update/remove/reparent patch ops, so one changed node touches one
  SceneObject. Protocol 1 snapshots still apply.
- `ViroSpecsSceneControllerHost`, the Lens component the generated
  `ViroGeneratedSceneHost` presents to. It has one input,
  `assetRegistryObject`.
- Host diagnostics channel (`ViroSpecsHostDiagnostics`, codes VS5001 to
  VS5025). The host logs a coded diagnostic instead of throwing.
- All seven SIK interaction phases, with `source` set to `hand-left`,
  `hand-right`, `gaze` or `synthetic`.
- Typed actions in the Lens: action registry, standalone action runtime and
  the reference flow (select card, details, change setting, back to list
  with scroll position kept). `ViroSpecsActionsLab` runs it without a phone
  or server.
- Experience layer: loading, ready, degraded and error views, placement
  reticle with pinch confirm and look-away cancel, gaze dwell, PanelButton
  states, SpatialScrollView as a scroll group, comfort clamps (VS5022,
  VS5023).
- One Interaction Kit import seam (`lens/ViroSpecsInteractionKit.ts`) for
  `SpectaclesInteractionKit.lspkg` 2.x and `InteractionKit.lspkg` 4.0.0.
- `lens-runtime.json` classifies every `lens/` file as production,
  validation or not synced. `specs:sync` copies production files only
  unless `--with-validation` is passed, and keeps an ownership ledger.
- `specs:doctor` reads each installed Lens package version and fails on a
  missing or older required package.
- `pnpm specs:test-consumer`: packs this package and xr-contract, installs
  both tarballs into a clean npm project with strict peers and checks the
  result.
- Committed API snapshots under `api/`, checked by
  `node scripts/ci/api-snapshot.mjs` from the workspace root.
- The Lens host draws every premium feature: the ModelViewer load ring,
  Reset model button and `autoRotate` (18 degrees a second, off under
  reduced motion and while held), and `radius.card` corners on PanelImage.
  `VS5025` stays in the catalog and now names nothing. The layout
  helpers behind this are in `api/specs-lens-core.api.d.ts`:
  `layoutViroSpecsStatePanel`, `layoutViroSpecsButtonError`,
  `layoutViroSpecsScrollButtons`, `layoutViroSpecsModelReset`,
  `viroSpecsActionButtonSize`, `estimateViroSpecsLines` with
  `VIRO_SPECS_EM_PER_CHARACTER`, `viroSpecsAutoRotateDegrees`,
  `viroSpecsResetProgress`, `viroSpecsLoadingRing`,
  `viroSpecsDiscGeometry` and `viroSpecsRoundedRectGeometry`. The
  change adds names and removes none.

### Changed

- `ViroSpecsPresentationHost` runs on `ViroSpecsSceneControllerHost`.
  Replacing a page stages the next page under a disabled root and retires
  the previous one only after the next is enabled, so a page that fails to
  build, or loads an asset slowly, no longer leaves the screen empty. The
  host's inputs are now one, `sceneHostObject`. An unregistered image no
  longer makes `present()` throw: the page commits with a placeholder and a
  `VS5003` diagnostic. New: `ViroSpecsPresentation` and
  `toViroSpecsPresentationDocument` in the Lens core.
- The UI Kit and the Navigation Kit get their own import seams,
  `ViroSpecsUIKit.ts` and `ViroSpecsNavigationKit.ts`, like
  `ViroSpecsInteractionKit.ts`. `specs:sync --interaction-kit 4` rewrites
  all three to the 4.0.0 names (`InteractionKit.lspkg`, `UIKit.lspkg`,
  `NavigationKit.lspkg`), and `specs:doctor` requires the UI Kit and the
  Navigation Kit of the installed Interaction Kit's line. `lens-runtime.json`
  gains `lineSeams`; `requiredPackages` no longer lists the two 2.x names.
- The high-contrast surface is `#42525f`, not `#000000`. Black adds no
  light on the additive SPECS display, so a high-contrast panel showed as
  the room. White text on the new surface is 8.07:1 and focus 5.62:1. A
  scene compiled by an older viro carries `#000000` in its theme and keeps
  it until recompiled.
- Peer `@viro-external/xr-contract` is `^0.3.0` (was `^0.2.0`);
  `src/render.ts` uses `PortableXRTextStyle` and `PortableXRScroll`,
  which 0.2.0 lacks.
- The published `types` entry is `dist/index.d.ts`. Before, consumers
  compiled `src/index.ts` with their own compiler settings. Metro still
  resolves `src/index.ts` through the `react-native` condition.
- The tarball no longer ships `scripts/*.test.mjs`, `scripts/support/`,
  `scripts/fixtures/`, `scripts/build-lens-core.mjs` or
  `scripts/check-packed-consumer.mjs`.

### Fixed

- The tarball now includes `lens-runtime.json`. Without it, `specs:sync`
  and `specs:doctor` from an installed copy failed with ENOENT.
- Scene reads narrow with `result.ok === false`; Lens Studio's compiler did
  not narrow `!result.ok`.
- `VolumetricLine.autoCorrectOffset` is set after commit, not during
  staging.
- Asset errors from a scene that replaces a ready scene are kept.

### Migration from 0.2.0

- Regenerate `ViroGeneratedSceneHost` with `viro-specs-compile --format
  lens-ts`. The four inputs (`runtimeHostObject`, `interactionHostObject`,
  `animationHostObject`, `navigationHostObject`) are replaced by one,
  `sceneHostObject`, pointing at the SceneObject that holds
  `ViroSpecsSceneControllerHost`.
- Run `pnpm specs:sync -- --project <dir>` again. Validation files (LEAF
  scenarios, Platform Lab, agent validation) are no longer copied unless
  you pass `--with-validation`.
- Install `@viro-external/xr-contract` 0.3.x.
- Rewire `ViroSpecsPresentationHost`: set `sceneHostObject` to the
  SceneObject holding `ViroSpecsSceneControllerHost` (with its
  `assetRegistryObject`). `runtimeHostObject` and `interactionHostObject`
  are gone. Code that relied on `present()` throwing for an unregistered
  image should check `VS5003` diagnostics or `lifecycle === "degraded"`.

## 0.2.0

First release validated in the SPECS 27 Interactive Preview (Lens Studio
5.24.0.26090816). See [doc/RELEASE-0.2.0.md](./doc/RELEASE-0.2.0.md).
