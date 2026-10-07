# Native Rive spatial rendering

Rive is a separate rendering lane from the generic visual-depth work.

## Goal

- Native Rive artboards/state machines.
- Viro owns 3D transform, physical dimensions, depth and occlusion.
- Viro/ESIK owns spatial hit testing and maps hits into Rive UV coordinates.
- No WebView, screenshot, PNG or animated-bitmap fallback.

Rive's current React Native direction is the Nitro-based @rive-app/react-native runtime. It is native on iOS/Android and supports artboards, state machines and data binding.

## How ESIK helps

ESIK should sit outside the Rive state machine:

hand / gaze / pinch / controller
  -> ESIK/Viro interaction
  -> spatial hit test
  -> world hit to surface UV
  -> native Rive pointer/state-machine input
  -> Rive renderer

That lets one Rive component respond to Specs pinch, Viro gaze/controller/hand input, Meta-style directional/select input and touch without duplicating animation logic per platform.

ESIK should normalize intent and coordinates. It should not emulate a pinch inside Rive.

## Dragging Rive panels

Interactive Rive panels are spatially draggable. The ESIK/Viro layer owns the drag gesture: pointer capture, activation threshold, axis constraint and world-space displacement. The native Rive surface adapter applies that displacement to the Viro scene node while the Rive artboard continues rendering independently.

A drag must not be implemented by translating the Rive artwork inside its artboard. The panel itself moves in the Viro scene, preserving the physical relationship between the artboard, hit target, depth and occlusion.

The drag lifecycle is:

`select-start -> beginDrag -> drag/updateDrag -> select-end -> endDrag`

Cancellation uses `cancelDrag`. This allows the same panel to be dragged by Specs pinch, Viro hand/controller/gaze input, or another platform adapter without changing the Rive file.

## Required Viro native seam

A true spatial integration needs a native Viro/ViroCore render-surface seam. A React Native RiveView is native, but it is still a 2D RN view; putting it beside a Viro scene does not make it a Viro scene node.

The native implementation therefore needs:

1. A Viro scene node backed by a Rive artboard.
2. Native GPU rendering on the supported Viro backends.
3. Viro depth/occlusion composition.
4. Surface-local hit testing.
5. ESIK/Viro pointer-to-Rive coordinate mapping.
6. Native state-machine/data-binding control without per-frame JS traffic.

An internal GPU texture/render target is acceptable as an implementation detail. It must not be the public component model or a floating bitmap.

## Status

This contract is independent of PR #41. PR #41 owns generic visual depth; this lane owns native Rive runtime integration.
