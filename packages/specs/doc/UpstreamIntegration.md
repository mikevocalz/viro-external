# SPECS 27 upstream integration

`@viro-external/specs` treats the public `specs-devs/packages` repository as
the canonical implementation reference for the Lens Studio side of the Viro
Specs backend.

## Pin

The adapter is pinned to:

- repository: `specs-devs/packages`
- commit: `df8820c0c4970f052e545b8da1dd288c2516d912`
- target: **SPECS 27**
- Lens Studio: **5.22.0+**

The upstream repository explicitly documents that its `main` branch targets
SPECS 27 and does not support Spectacles (2024). Spectacles (2024) uses the
upstream `5.15.4` branch instead.

The pin is stored in `upstream/specs-27.json`. Do not silently float to
upstream `main`; upgrades should be intentional PRs with compatibility notes.

## Ownership boundary

`specs-devs/packages` is not a ViroCore replacement and is not linked into the
native C++ renderer. It supplies Lens Studio implementations that sit underneath
our Specs adapter:

```text
Viro public API
      ↓
portable XR contract
      ↓
@viro-external/specs
      ↓
Lens Studio implementation
      ↓
specs-devs packages + built-in Lens Studio APIs
      ↓
SPECS
```

ViroCore remains the native renderer for its supported platforms. Specs reaches
behavioral parity through a different backend.

## Initial package map

The long-term backend is intentionally composed from small upstream packages:

| Viro behavior | Specs implementation source |
| --- | --- |
| node/component access | AccessComponents |
| dynamic objects/models | Instantiation |
| animation | AnimationExamples / AnimationPlayer |
| hover/select/drag | SpecsInteractionKitExamples + InteractableHelper |
| world hit tests | WorldQueryHit |
| plane/surface placement | SurfacePlacement |
| spatial layout behaviors | Solvers |
| route/navigation primitives | SpecsNavigationKit |
| ViroPolyline-like paths | VolumetricLine |
| wearable materials | SpecsShaderLibrary |
| camera compositing | CompositeCameraTexture / CropCameraTexture |
| hand attachment | HandAttacher |
| gesture guidance | Specs3DHandHints |
| realtime transport | WebSocketExamples |
| automated inspection | AiPreviewAgentInspect |
| automated input | AiPreviewAgentInteract |

## Dependency policy

Packages marked `required` define the minimum Viro-compatible Specs renderer.
Optional packages are enabled by capability and application need.

The adapter should consume stable public package APIs instead of copying broad
parts of the upstream repository. If code must be vendored, preserve upstream
copyright/license notices and document the exact source path + commit.

## Upgrade procedure

1. Review the upstream release/commit and Lens Studio minimum.
2. Update `upstream/specs-27.json`.
3. Update `SPECS_UPSTREAM` and the package catalog.
4. Run workspace typecheck.
5. Run the Specs Platform Lab against Lens Studio preview.
6. Run the same scene on physical Specs.
7. Record any semantic differences from ViroCore in the compatibility matrix.

## License

The upstream package repository is published under MIT and also references the
Specs Developer Terms and Lens Studio License Agreement. Keep attribution when
vendoring or substantially copying implementation code.
