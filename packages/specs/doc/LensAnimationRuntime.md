# Lens native animation runtime

The Specs backend now executes `SpecsNativeAnimationPlan` with Lens Studio's
native animation stack instead of running a JavaScript frame loop.

## Runtime path

```text
Viro animation definition
      ↓
compileViroAnimationForSpecs()
      ↓
SpecsNativeAnimationPlan
      ↓
ViroSpecsAnimationRuntime
      ↓
AnimationCurve
AnimationPropertyTrack
AnimationPropertyLayer
AnimationAsset
AnimationClip
AnimationPlayer
```

## Supported behavior

The Lens runtime supports:

- local position X/Y/Z
- local scale X/Y/Z
- Viro-style Euler rotation X/Y/Z
- subtree opacity
- duration
- delay
- linear/ease-in/ease-out/ease-in-out/cubic-bezier easing
- single or looping playback
- completion callbacks for single playback

Viro rotation targets are treated as degrees and converted to Lens Studio
radians at the runtime boundary.

## Duration

Runtime-generated easing curves use Lens Studio's normalized 0..1 animation
time. `AnimationClip.playbackSpeed` scales that one-second curve to the Viro
requested duration.

A zero-duration animation is applied immediately without creating a clip.

## Opacity

Viro node opacity semantically affects the rendered subtree. The Specs runtime
therefore applies animated alpha recursively to Text, Image and
RenderMeshVisual content beneath the generated node.
