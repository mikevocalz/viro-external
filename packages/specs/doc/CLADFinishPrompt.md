# Viro Specs — CLAD Finish Prompt

Using SPECS experience builder, finish and verify the Viro Specs Platform Lab in
this currently open Lens Studio project. Work autonomously until the preview
tests pass. Do not stop at code generation: assemble the scene, run the preview,
exercise interactions, read Logger errors, fix them, rerun tests, and capture a
performance trace.

The Viro Specs runtime is already synced under:

`Assets/ViroSpecs/lens/`

Use those files as the authoritative implementation. Do not rewrite the backend
from scratch and do not introduce React Native, Metro, npm runtime imports, or
workspace imports into Lens scripts.

## 1. Initialize and validate the SPECS project

Run the CLAD setup/validation flow:

- `/specs-project-init`
- ensure Target Platform is SPECS
- ensure the active Preview panel is SPECS 27
- ensure Lens Studio is 5.22.0+
- camera Device Tracking mode = World
- camera Far = 100000
- `/reset-preview-environment`

Install or verify these packages with the Asset Library / CLAD package tools:

- SpectaclesInteractionKit
- SpectaclesUIKit
- SurfacePlacement
- VolumetricLine
- SpecsNavigationKit
- Leaf
- AiPreviewAgentInspect
- AiPreviewAgentInteract

Install transitive package dependencies requested by those packages. Prefer the
versions compatible with the current Lens Studio/SPECS 27 project and report any
version mismatch before changing the Viro runtime.

Add the SpectaclesInteractionKit prefab to the scene if it is not already
present.

## 2. Build the runtime scene hierarchy

Create a root SceneObject named `ViroSpecsRuntime`.

Create and wire these child objects/components:

### AssetRegistry
Attach `ViroSpecsAssetRegistry`.

Create a simple visible model/prefab suitable for preview validation (a cube,
sphere, or similarly cheap mesh) and register it as:

- model ID: `platform-lab-model`
- matching ObjectPrefab: the preview model prefab

Create a simple SPECS/UIKit panel prefab and assign it as
`defaultPanelPrefab`. The panel must be visibly distinguishable in Preview and
must have an interaction-compatible visual/collider.

Create a simple material for route/line rendering and a tiny icon texture for
navigation testing; keep them lightweight.

### RuntimeHost
Attach `ViroSpecsRuntimeHost`.

Wire:
- `assetRegistryObject` -> AssetRegistry
- `root` -> a generated-content child named `ViroGeneratedContent`

### InteractionHost
Attach `ViroSpecsInteractionHost`.

Wire:
- `runtimeHostObject` -> RuntimeHost

### AnimationHost
Attach `ViroSpecsAnimationHost`.

Wire:
- `runtimeHostObject` -> RuntimeHost

### Navigation
Create the SpecsNavigationKit navigation hierarchy required for a
`NavigationDataComponent`.

Attach `ViroSpecsNavigationHost` and wire:
- `navigationObject` -> object containing NavigationDataComponent
- `assetRegistryObject` -> AssetRegistry
- `defaultLineMaterial` -> lightweight route material
- `routeIcon` -> lightweight route icon
- `generatedContentRoot` -> ViroGeneratedContent

Location permission/GPS may be unavailable in Preview. The project must fail
gracefully rather than crash if real geolocation is unavailable.

### PlatformLab
Attach `ViroSpecsPlatformLab`.

Wire:
- `runtimeHostObject` -> RuntimeHost
- `interactionHostObject` -> InteractionHost
- `modelSourceId` -> `platform-lab-model`

### Preview validation
Attach:
- `ViroSpecsAgentValidation`
- `ViroSpecsLeafIndex`

The LEAF index must expose:
- `viro_specs_scene_smoke`
- `viro_specs_interaction`

## 3. Compile and inspect

Before touching the editor, typecheck the synced runtime against Lens Studio's
own API declarations. The project must have been opened once so that `Cache/`
exists:

```sh
pnpm --filter @viro-external/specs specs:typecheck-lens -- --project <project path>
```

This also fails if the project copy has drifted from `packages/specs/lens`. CI
cannot run it — Lens Studio is not installed there — so it belongs here.

Then run:

- `/verify-preview`
- `/preview-inspection`

Confirm these generated objects exist:

- `viro:platform-lab-root`
- `viro:platform-lab-panel`
- `viro:platform-lab-title`
- `viro:platform-lab-model`
- `viro:platform-lab-button`
- `viro:platform-lab-status`

Confirm the root is approximately -150 cm on Z. That proves Viro -1.5 meter
positions are being converted correctly to Lens centimeters.

Confirm the visible title reads:

`Viro Specs Platform Lab`

Confirm Logger has no runtime exceptions.

## 4. Exercise SIK without hardware

Use `/specs-preview-interaction` or LEAF to:

1. hover the generated button;
2. pinch/trigger it;
3. verify `platform-lab-status` becomes `button:selected`;
4. drag the generated model;
5. verify the model moves;
6. verify `platform-lab-status` becomes `model:drag`.

Do not bypass SIK by directly mutating the test status.

## 5. Run persistent LEAF regression tests

Run:

- `/specs-leaf-install-packages` if needed
- `/specs-leaf-run-in-preview`

Run both Viro scenarios and keep fixing the project until both PASS.

Intentionally confirm a broken assertion is reported as FAILED, then restore the
correct assertion and rerun to PASS. This validates the test harness itself.

## 6. Validate native animation

Use the Viro runtime/animation host to execute at least one compiled native
animation against a generated node:

- position
- scale
- opacity
- single-play completion

Verify in Preview that it is using Lens `AnimationPlayer`, not a JS per-frame
tween fallback. Use `/lens-js-debugger` if needed.

Also verify a zero-duration animation applies immediately.

## 7. Validate WorldQuery / placement in Preview

Use the SPECS 27 Preview environment and:

- exercise a WorldQuery hit test against an available simulated surface;
- verify returned Lens centimeters are normalized to Viro meters;
- start and cancel a surface placement flow;
- verify unavailable preview capabilities fail gracefully and leave no stale
  placement session.

Use `/specs-world-query`, `/verify-preview`, and `/specs-debug` as needed.

## 8. Validate VolumetricLine / local ViroPolyline

Render a local ViroPolyline-style plan with at least 3 points.

Confirm:
- points use Viro meters at the portable boundary;
- Lens control points are in centimeters;
- width/radius conversion is correct;
- clearing the route deletes the generated line and all control-point objects.

For geographic navigation, validate structure and graceful missing-GPS behavior
in Preview. Do not claim real outdoor GPS accuracy without hardware.

## 9. Performance pass

Run:

- `/specs-capture-perf-trace`
- `/perfetto-trace-analysis`

If there is obvious preview jank attributable to the Viro runtime, use
`/specs-lens-perf-attribution` and fix the runtime one issue at a time. Do not
over-optimize unrelated Lens Studio editor overhead.

## 10. Final report

Do not stop until:
- Preview compiles and runs;
- both Viro LEAF scenarios PASS;
- button pinch/select works;
- model drag works;
- native animation has been observed;
- WorldQuery/surface-placement preview behavior is verified or cleanly marked
  simulator-unavailable;
- local VolumetricLine rendering works;
- Logger is clean of Viro runtime exceptions;
- a preview performance trace has been captured and reviewed.

Report:
1. everything that passed;
2. every code/scene/package change you made;
3. any simulator limitation;
4. the exact hardware-only certification matrix still outstanding.

Do not mark optics, real sensor quality, outdoor GPS accuracy, thermals, battery,
real radios, physical brightness, or final on-device frame pacing as tested.
