# Specs AR and interaction parity

This layer maps Viro-style interaction and AR semantics onto Spectacles
Interaction Kit (SIK), WorldQueryModule and the SPECS 27 surface-placement
packages.

## Interaction

The Specs runtime normalizes SIK events into `PortableXRInteraction`:

```text
SIK hover enter/exit -> hover-enter / hover-exit
SIK targeting move   -> hover-move
pinch trigger start  -> select-start
pinch trigger end    -> select-end
manipulation move    -> drag
tracking/input loss  -> cancel
```

A Viro app can therefore keep using one semantic event model even though Quest
and Specs use different native input stacks.

## Gaze

Targeting and raw eye-gaze must remain separate capabilities.

- `gaze-targeting` means the runtime can determine which object the user is
  targeting for hover/focus behavior.
- `eye-gaze` remains the capability for raw eye-gaze data when a platform
  exposes it.

Apps should use `gaze-targeting` for ordinary spatial UI.

## Hit testing

`SpecsWorldRuntime.hitTest()` is the portable boundary for
`LensStudio:WorldQueryModule` and the upstream `WorldQueryHit` package.

The adapter normalizes hit results into:

- world position
- optional normal
- distance
- surface classification
- optional confidence

This is the layer that should back Viro-style AR hit-test helpers on Specs.

## Surface placement

The upstream `SurfacePlacement` package provides:

- near-surface placement
- horizontal placement
- vertical placement

The Specs adapter exposes those as `SpecsSurfacePlacementMode` instead of
leaking Lens Studio controller classes into shared code.

## ViroCore parity

ViroCore and Specs are allowed to use different implementation engines. The
compatibility requirement is semantic:

```text
Viro hit test request
        ↓
platform adapter
   ┌────┴────┐
ViroCore   Specs WorldQuery
   │            │
   └────┬───────┘
        ↓
normalized hit result
```

The same rule applies to hover, select, drag and placement.
