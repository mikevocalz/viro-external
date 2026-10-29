# SPECS backend compatibility matrix

This document records the supported/validated combination for
`@viro-external/specs` 0.3.x. The authoring side (React, React Native,
Expo, `@reactvision/react-viro`) is in the viro repo,
`docs/specs-compatibility.md`.

| Layer | Supported / validated |
| --- | --- |
| Viro SPECS package | `@viro-external/specs@0.3.x` |
| Authoring package | `@reactvision/react-viro` with peer `@viro-external/specs` ^0.3.0; its `viro-specs-compile --format lens-ts` host needs `ViroSpecsSceneControllerHost`, which 0.2.x lacks |
| XR contract | `@viro-external/xr-contract@^0.3.0` (renderer-neutral TypeScript contract). `src/render.ts` imports `PortableXRTextStyle` and `PortableXRScroll`, which are not in 0.2.0, so the peer is `^0.3.0`. |
| Scene protocols | 1 (`ViroSpecsSceneSnapshot`) and 2 (`ViroSpecsSceneDocumentV2`), read by `ViroSpecsSceneController` |
| Previous releases | `@viro-external/specs@0.2.0` and `0.2.0-rc.1` with `@viro-external/xr-contract@0.2.0-rc.1`, Preview validated, protocol 1 host only |
| Module formats | ESM (`import`), CommonJS (`require`), TypeScript source under the `react-native` condition for Metro |
| Lens Studio minimum | 5.22.0+ |
| Simulator validation | Lens Studio 5.24.0.26090816 |
| Target | SPECS 27 |
| Preview environment | SPECS 27 Interactive Preview / Sunlit Room |
| Upstream package corpus | `specs-devs/packages` pinned by `upstream/specs-27.json` |
| Interaction Kit | `SpectaclesInteractionKit.lspkg` 2.0.0 validated. `InteractionKit.lspkg` 4.0.0 compiles and renders in Preview on Lens Studio 5.24.1; its LEAF suite needs Lens Studio 5.25 (see below) |
| SpectaclesUIKit | 2.0.0 validated; `UIKit.lspkg` 4.0.0 compiles and renders (same run) |
| SurfacePlacement | 2.0.0 validated |
| VolumetricLine | 2.0.0 validated |
| SpecsNavigationKit | 2.0.0 validated |
| Leaf | 2.0.2 validated |
| AiPreviewAgentInspect | 2.0.1 installed in the validated project (see note) |
| AiPreviewAgentInteract | 2.0.1 validated |

`specs:doctor` enforces these as minimums. They live in `lens-runtime.json`
(`interactionKit`, `requiredPackages`, `validationPackages`).

AiPreviewAgentInspect: the 2026-10-02 report lists 2.0.2, but on 2026-10-28
the `package.native` in `examples/specs-platform-lab/lens` reads
`VersionMajor 2 / VersionMinor 0 / VersionPatch 1`, and every archive in that
`Packages/` folder has a modification time of 2026-10-28 06:58 to 07:02. The SDK imports one symbol
from the package, `AgentInspectScript`, and 2.0.1 exports it. The minimum is
2.0.1. Which version the 2026-10-02 preview run used is not recoverable.

## Interaction Kit 2.x and 4.0.0

The Asset Library 4.0.0 line renames three kits, and every 4.0.0 package
imports the new names. A project holds one line or the other, not both.

| Kit | 2.x package | 4.0.0 package | Viro seam file |
| --- | --- | --- | --- |
| Interaction Kit | `SpectaclesInteractionKit.lspkg` | `InteractionKit.lspkg` | `lens/ViroSpecsInteractionKit.ts` |
| UI Kit | `SpectaclesUIKit.lspkg` | `UIKit.lspkg` | `lens/ViroSpecsUIKit.ts` |
| Navigation Kit | `SpecsNavigationKit.lspkg` | `NavigationKit.lspkg` | `lens/ViroSpecsNavigationKit.ts` |

`SurfacePlacement.lspkg`, `VolumetricLine.lspkg`, `Leaf.lspkg`,
`AiPreviewAgentInspect.lspkg` and `AiPreviewAgentInteract.lspkg` keep their
names. The 4.0.0 packages also pull in `Utilities.lspkg`,
`SnapDecorators.lspkg`, `Icons.lspkg` and `Motion.lspkg` 4.0.0. Every 4.0.0
`package.native` declares Lens Studio 5.25.0.

Each renamed kit is imported in exactly one runtime file (table above).
`specs:validate-lens` fails if any other Lens file imports a kit under
either name. `lens-runtime.json` lists the names per line (`interactionKit`,
`lineSeams`).

| Step | 2.x project | 4.0.0 project |
| --- | --- | --- |
| `pnpm specs:sync -- --project <dir>` | keeps the 2.x names | detects `Packages/InteractionKit.lspkg` and rewrites the three seam files to the 4.0.0 names |
| Force a line | `--interaction-kit 2` | `--interaction-kit 4` |
| `viro-specs.dependencies.json` | `interactionKit: { line: 2, ... }` | `interactionKit: { line: 4, ... }`; `requiredPackages` lists `InteractionKit.lspkg`, `UIKit.lspkg`, `NavigationKit.lspkg` |
| `pnpm specs:doctor -- --project <dir>` | checks the 2.x kits and that every module each seam imports exists in `Cache/TypeScript/Src/Packages/<kit>/` | same for the 4.0.0 kits; a 4.0.0 Interaction Kit next to a 2.x UI Kit or Navigation Kit is an error |

Every module path the runtime imports exists in the 4.0.0 archives under the
new package names (checked against the Asset Library files on 2026-10-28).

### 4.0.0 Preview run (2026-10-28, Lens Studio 5.24.1)

A copy of the Platform Lab with every 2.x package replaced by its 4.0.0
archive, then `specs:sync --interaction-kit 4 --with-validation`:

- `specs:doctor`: passed, kit module paths verified.
- Compile: one error, inside Leaf 4.0.0
  (`Scenarios/decorator/ScenarioIndexDecorator.ts(91,17)`, TS2352 converting
  `string` to `TypeName<Scenario>`). Leaf 4.0.0 is built for Lens Studio 5.25;
  5.24 declares `getTypeName()` differently. No Viro file and no IK, UI Kit
  or Navigation Kit import failed.
- With Leaf, AI Preview Agent Interact and the LEAF scenario folders moved
  out of the copy, the project compiles. Preview logs `IK Version : 4.0.0`,
  only the expected `VS5008` warnings, no errors; the generated host binds
  `viro-interactable:platform-lab-model` (Interactable and
  InteractableManipulation) and `viro-interactable:hello-next`, and the
  capture shows the Hello panel, the model and the VolumetricLine route.
- Not done: the LEAF suite on 4.0.0. It needs Lens Studio 5.25 for Leaf
  4.0.0; this machine has 5.24.1.

Evidence: viro `docs/evidence/specs/lens/ik4-01-preview` (report, capture,
SHA-256 of each 4.0.0 archive). Until the LEAF suite passes on 4.0.0, pin
the 2.x line for production Lenses.

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
