# Lens interaction and world runtime

This runtime layer connects the portable Viro semantics to the native Specs
interaction and world-understanding stack.

## SIK interaction

`ViroSpecsInteractionRuntime` attaches:

- `Interactable`
- `InteractableManipulation`
- collider fallback when an imported asset does not already provide one

and normalizes events to the shared XR contract:

```text
SIK hover       -> hover-enter / hover-exit
pinch trigger   -> select-start / select-end
manipulation    -> drag
```

Drag positions are converted from Lens centimeters back to Viro meters before
they leave the Specs backend.

Imported model prefabs can provide their own colliders. When they do not, the
runtime prefers the first visual object in the generated subtree and creates a
fit-to-visual collider. A small box collider is the last-resort fallback.

## WorldQuery

`ViroSpecsWorldRuntime.hitTest()` uses
`LensStudio:WorldQueryModule` and a `HitTestSession`.

Portable inputs are meters. The runtime converts the ray into Lens centimeters,
then converts the resulting position/distance back to meters.

## Surface placement

The live placement implementation uses the pinned upstream
`SurfacePlacement` package:

- `horizontal` -> `PlacementMode.HORIZONTAL`
- `vertical` -> `PlacementMode.VERTICAL`
- `near-surface` -> `PlacementMode.NEAR_SURFACE`

The returned disposer stops the active surface-placement session.

## Concrete transport

`ViroSpecsLensTransport` implements the original `SpecsRuntimeTransport`.
This closes the full adapter path from portable Viro nodes to a live Lens scene
and sends normalized SIK events back to the Viro application layer.
