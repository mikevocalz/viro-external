# Specs renderer and animation parity

This layer turns the portable Viro scene model into an executable Lens Studio
plan without leaking Lens Studio classes into shared application code.

## Render compilation

`compileSpecsRenderPlan()` maps:

```text
Portable group -> SceneObject
Portable text  -> Lens Studio text
Portable image -> Lens Studio image
Portable model -> RenderMeshVisual / Instantiation
Portable panel -> Spectacles UIKit frame
```

The result is a command stream. The Lens runtime owns actual SceneObject
creation and package calls.

This keeps the portable package testable in ordinary TypeScript while still
allowing the device implementation to use native Specs primitives.

## Model instantiation

Model nodes declare a source asset in the portable scene. The Specs renderer
uses the upstream `Instantiation` package for runtime object/prefab creation
where appropriate rather than maintaining a second custom instantiation stack.

## Native animation

`compileViroAnimationForSpecs()` converts Viro-style animation targets into a
Lens Studio-native AnimationPlayer plan.

The Lens implementation resolves the current value when playback begins and
builds:

```text
AnimationCurve
  -> AnimationPropertyTrack
  -> AnimationPropertyLayer
  -> AnimationAsset
  -> AnimationClip
  -> AnimationPlayer
```

This is intentionally not a JavaScript requestAnimationFrame tween. Specs gets
its native animation system.

Supported first-wave targets:

- position X/Y/Z
- scale X/Y/Z
- Euler rotation X/Y/Z
- material opacity
- duration
- delay
- easing
- loop
- completion event

## Long-term renderer rule

Pixel identity with ViroCore is not required. Observable Viro semantics are.

For example, a `Viro3DObject` can be a ViroCore render node on Quest and a
Lens Studio RenderMeshVisual/prefab on Specs, as long as transforms, visibility,
assets, input semantics and animation behavior remain compatible.
