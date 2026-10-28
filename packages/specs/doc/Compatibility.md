# SPECS backend compatibility matrix

This document records the supported/validated combination for
`@viro-external/specs` 0.2.x.

| Layer | Supported / validated |
| --- | --- |
| Viro SPECS package | `@viro-external/specs@0.2.x` |
| XR contract | `@viro-external/xr-contract@^0.3.0` (renderer-neutral TypeScript contract). `src/render.ts` imports `PortableXRTextStyle` and `PortableXRScroll`, which are not in 0.2.0, so the peer is `^0.3.0`. |
| Scene protocols | 1 (`ViroSpecsSceneSnapshot`) and 2 (`ViroSpecsSceneDocumentV2`), read by `ViroSpecsSceneController` |
| Previous release candidate | `@viro-external/specs@0.2.0-rc.1` + `@viro-external/xr-contract@0.2.0-rc.1`, simulator validated |
| Module formats | ESM (`import`), CommonJS (`require`), TypeScript source under the `react-native` condition for Metro |
| Lens Studio minimum | 5.22.0+ |
| Simulator validation | Lens Studio 5.24.0.26090816 |
| Target | SPECS 27 |
| Preview environment | SPECS 27 Interactive Preview / Sunlit Room |
| Upstream package corpus | `specs-devs/packages` pinned by `upstream/specs-27.json` |
| Interaction Kit | `SpectaclesInteractionKit.lspkg` 2.0.0 validated. `InteractionKit.lspkg` 4.0.0 supported through the import seam, not yet preview-validated (see below) |
| SpectaclesUIKit | 2.0.0 validated |
| SurfacePlacement | 2.0.0 validated |
| VolumetricLine | 2.0.0 validated |
| SpecsNavigationKit | 2.0.0 validated |
| Leaf | 2.0.2 validated |
| AiPreviewAgentInspect | 2.0.2 validated |
| AiPreviewAgentInteract | 2.0.1 validated |

## Interaction Kit 2.x and 4.0.0

The Asset Library 4.0.0 packages renamed `SpectaclesInteractionKit.lspkg` to
`InteractionKit.lspkg`, and the other 4.0.0 packages (UIKit, NavigationKit,
Leaf) import the new name. A project can hold one line or the other, not
both.

The runtime imports the kit in exactly one file,
`lens/ViroSpecsInteractionKit.ts`. `specs:validate-lens` fails if any other
Lens file imports either kit name.

| Step | 2.x project | 4.0.0 project |
| --- | --- | --- |
| `pnpm specs:sync -- --project <dir>` | keeps `SpectaclesInteractionKit.lspkg/...` | detects `Packages/InteractionKit.lspkg` and rewrites the seam to `InteractionKit.lspkg/...` |
| Force a line | `--interaction-kit 2` | `--interaction-kit 4` |
| `viro-specs.dependencies.json` | `interactionKit: { line: 2, ... }` | `interactionKit: { line: 4, ... }` |
| `pnpm specs:doctor -- --project <dir>` | checks the seam names the installed kit and that every imported module exists in `Cache/TypeScript/Src/Packages/<kit>/` | same |

The rewrite assumes 4.0.0 kept the 2.x module paths under the new package
name (`Components/Interaction/Interactable/Interactable`,
`Core/Interactor/Interactor`, `Utils/FunctionTimingUtils`, ...). That is
not verified: no 4.0.0 package was available to this change. The doctor's
module check turns a moved path into an error naming the module, instead of
a Lens compile failure. Lens Studio fills the package cache the first time
the project is opened; before that the doctor warns that the paths are
unverified.

Whether UIKit 4.0.0 and NavigationKit 4.0.0 kept the package names
`SpectaclesUIKit.lspkg` and `SpecsNavigationKit.lspkg` is also unverified.
The runtime still imports those names. Until a Lens Studio preview of the
4.0.0 line passes, pin the 2.x line for production Lenses.

## Validated software behavior

The SPECS 27 simulator validation covers:

- live scene creation
- Viro meters -> Lens centimeters
- text/model/panel hierarchy
- hover, pinch/select and drag through SIK
- native AnimationPlayer execution
- WorldQuery hit normalization
- surface-placement start/cancel lifecycle
- ViroPolyline -> VolumetricLine geometry
- missing-GPS graceful behavior
- persistent LEAF regressions
- CLAD/Codex launcher regressions
- preview performance trace capture

The detailed evidence lives in
`doc/CLADValidationReport.md` and `doc/validation/2026-10-02/`.

## Renderer boundary

SPECS uses Lens Studio. It does not embed or execute ViroCore.

Applications can share Viro-facing scene semantics while each renderer owns its
native implementation:

- ViroCore for its native/OpenXR/Apple/Web targets;
- Lens Studio + SIK/WorldQuery/Navigation Kit for SPECS.

## Not certified by simulator

Physical-device certification still covers:

- optics/FOV/readability/comfort
- real hand tracking edge cases
- camera/depth sensor characteristics
- outdoor GPS/heading
- radios/network recovery
- thermals and battery
- real lighting/brightness
- on-device frame pacing and memory
- physical multi-device co-location accuracy

These are hardware acceptance checks, not missing software implementation.
