# Specs adapter architecture

## Runtime ownership

```text
shared application/domain state
          |
@viro-external/xr-contract
          |
@viro-external/specs
          |
SpecsSceneSnapshot + PortableXRInteraction
          |
Lens Studio / Snap OS runtime bridge
          |
SceneObject / UI Kit / SIK / SyncKit
```

The bridge is a translation boundary, not a second renderer inside Viro.

## Viro/app layer owns

- stable logical node IDs;
- product/domain state;
- portable parent relationships;
- portable transforms;
- portable asset references;
- layout intent;
- semantic interactions;
- fallback decisions.

## Lens Studio owns

- SceneObject lifecycle;
- mesh/text/image rendering;
- Snap materials and shaders;
- actual hand/gaze/voice input implementation;
- Spectacles UI Kit / Interaction Kit implementation;
- camera access;
- Snap OS permissions;
- Snap deployment;
- SyncKit networking where chosen.

## Moyo layout reuse

Moyo's `worldSlot` math is engine-independent and can feed the Specs compiler directly.

```ts
const left = worldSlot("left", head, yawDeg);
const center = worldSlot("center", head, yawDeg);
const right = worldSlot("right", head, yawDeg);

const scene = compileSpecsScene([
  {
    id: "lesson",
    kind: "panel",
    position: left.position,
    rotation: [0, left.yaw, 0, 1],
  },
  {
    id: "board",
    kind: "panel",
    position: center.position,
    rotation: [0, center.yaw, 0, 1],
  },
  {
    id: "tutor",
    kind: "model",
    source: "tutor.glb",
    position: right.position,
  },
]);
```

The exact quaternion conversion is the Lens bridge's responsibility; the portable layer keeps the placement intent.

## Unsupported-feature rule

A feature outside the portable contract must be reported explicitly or implemented through a Specs-specific extension.

Never silently substitute:

```text
Viro portal          -> flat image
physics body         -> non-physical object
custom render pass   -> screenshot
native texture       -> stale bitmap
spatial audio graph  -> mono clip
```

Those substitutions change product behavior and therefore require an explicit product decision.

## Interaction normalization

Snap-native input is mapped into the same semantic events used by other adapters:

```text
SIK gaze target           -> hover-enter / hover-move / hover-exit
pinch / select gesture    -> select-start / select-end
hand move while selected  -> drag
voice command             -> source=voice, semantic action in app layer
cancellation / tracking loss -> cancel
```

A gaze ray may identify the target while a pinch commits it. Those are two input sources participating in one semantic selection, not two clicks.

## Validation ladder

1. Type/scene compiler tests.
2. Lens Studio bridge unit tests.
3. Spectacles simulator with hand/gaze interaction.
4. Physical Spectacles.
5. Specs hardware when available.
6. Mobile Kit continuity separately from renderer validation.

Simulator evidence must not be labeled physical-device evidence.
