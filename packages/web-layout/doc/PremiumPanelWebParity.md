# Premium panel web compatibility

Audit date: 2026-10-03.

This document distinguishes **renders on Viro Web** from **full premium interaction parity**.

## Current matrix

| Premium feature | Web status | Evidence / limitation |
| --- | --- | --- |
| square panel | supported | ViroQuad.web creates a WebGL/WASM surface |
| rounded panel | supported | SpatialPanel uses ViroGeometry; ViroGeometry.web supports custom vertices/normals/UVs/indices |
| curved panel | supported | same custom-geometry path |
| solid/glass material variants | supported | ViroMaterials web registry supports diffuse color + Constant lighting |
| title/subtitle text | supported | ViroText.web renders through the WASM text pipeline |
| images | supported | ViroImage.web loads images and uploads WebGL textures |
| header buttons | supported | Viro web node bridge supports hover + click |
| close / custom actions | supported | React state + click path is available |
| pinned/follow billboard mode | supported | Viro web node bridge maps billboard transforms |
| explicit scroll up/down buttons | supported | SpatialScrollView uses clickable PanelButton controls |
| mouse wheel / trackpad scrolling | not implemented | SpatialScrollView has no wheel/scroll gesture path |
| draggable panels | **not implemented** | MovableNode passes `dragType` / `onDrag`, but ViroNode.web/useViroNode does not consume or enable OnDrag |
| pinch resizing | **not implemented** | MovableNode passes `onPinch`, but the Viro web bridge exposes no pinch handler |
| flat video rendering | partial | ViroVideo.web renders frames and supports play/pause/mute/loop/volume |
| curved video rendering | partial | ViroMaterialVideo.web renders video into the shared material |
| 360 video rendering | partial | Viro360Video.web renders equirectangular video to the background sphere |
| video seek / +/-10 / replay | **not complete** | current web video components do not expose the imperative seek ref used by SpatialVideoPlayer |
| player current time / duration | **not complete** | ViroVideo.web does not currently emit `onUpdateTime` |
| buffering / ready state | **not complete** | web video path does not currently emit `onBufferStart` / `onBufferEnd` |
| immersive VR web panels | **not implemented in Viro Web** | ViroVRSceneNavigator.web intentionally does not create a WebXR session |

## What we can claim today

`@viro-external/ui` panels have **real Viro Web rendering support** for geometry, text, images, materials, hover/click controls, billboarding, and button-driven scroll.

They do **not** yet have full premium behavioral parity on web.

Do not label `SpatialPanel draggable/resizable` as web-supported until the Viro web input bridge carries drag/pinch events.

Do not label `SpatialVideoPlayerPanel` as full web parity until seek, time updates, and buffer/ready events are implemented.

## Correct fix layer

### Drag

Fix in the Viro web input stack, not inside every premium component:

1. Web pointer move must continue driving `VROInputControllerBase::onMove` while pressed.
2. Web event delegate must marshal `OnDrag`.
3. Web scene API / React bridge must expose `onDrag` and drag configuration.
4. `MovableNode` then works unchanged.

### Pinch / resize

Browser Pointer Events need a two-pointer gesture recognizer that forwards scale + start/move/end into Viro's existing `onPinch` path. The React bridge then exposes the same `onPinch` prop used natively.

### Media

Improve Viro web video once, beneath the premium player:

1. expose a stable video ref / `seekToTime`;
2. emit time + duration updates;
3. emit buffer/ready lifecycle;
4. reuse a source texture instead of recreating an RGBA texture every frame when the newer renderer API is available.

The premium VideoPlayerPanel should inherit those fixes without a web-specific rewrite.

## WebSpatial distinction

PICO WebSpatial can place ordinary React/HTML panels in spatial space. That is a separate rendering path from a Viro `SpatialPanel` inside the WebGL/WASM canvas.

A product can choose either:

- WebSpatial DOM surface for app UI;
- Viro SpatialPanel for engine/world UI;
- Viro Web canvas embedded inside a WebSpatial surface;
- WebXR for immersive browser mode.

Do not silently swap a Viro engine panel for a DOM panel unless the product explicitly selects that fallback.
