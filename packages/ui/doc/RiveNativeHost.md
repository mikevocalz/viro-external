# ViroCore Rive native host

This is the native seam behind createRiveSpatialSurface.

The React Native layer must not render a RiveView and place it next to or inside a Viro scene. The native Rive runtime and ViroCore renderer have different view and scene hierarchies. The host defined here is deliberately small so the actual implementation can live in native Viro/ViroCore code.

## Native responsibilities

A platform host implements:

- .riv loading and artboard selection using the native Rive C++ runtime.
- State-machine/data-binding execution on the native side.
- GPU rendering into the ViroCore render path.
- A Viro scene-node transform and depth/occlusion participation.
- Surface-local hit testing and pointer to UV conversion.
- Pointer dispatch without per-frame JS animation traffic.
- Translation of the scene node for ESIK drag.

## Drag

Drag is a scene transform, not an animation transform.

ESIK select/pinch -> surface hit test -> Rive pointer + world position -> activation threshold -> Viro scene-node translation.

The adapter supports free, horizontal, and vertical movement, activation thresholds, maximum displacement, pointer-follow, and cancellation.

The panel itself moves. The artboard does not get translated inside its Rive coordinate system.

## Why this is native

The host contract has no texture, image, canvas, WebView, screenshot, or animation-frame API. It only exposes a native surface identity, Rive controls, pointer input, and Viro scene translation.

Rive's low-level runtime is C++ and exposes an abstract Renderer, making it suitable for a ViroCore-native integration. ViroCore is the native renderer underneath ViroReact, with OpenGL ES on Android and Metal on Apple targets.
