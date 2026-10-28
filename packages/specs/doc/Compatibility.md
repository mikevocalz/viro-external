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
| SpectaclesInteractionKit | 2.0.0 validated |
| SpectaclesUIKit | 2.0.0 validated |
| SurfacePlacement | 2.0.0 validated |
| VolumetricLine | 2.0.0 validated |
| SpecsNavigationKit | 2.0.0 validated |
| Leaf | 2.0.2 validated |
| AiPreviewAgentInspect | 2.0.2 validated |
| AiPreviewAgentInteract | 2.0.1 validated |

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
