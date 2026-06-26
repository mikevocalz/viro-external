# Native — @viro-external/core

This package ships **JS only**. All native paths reach Viro through:

1. `ViroGeometry` (verified public API in `@reactvision/react-viro@2.56.0`) — accepts JS-built vertex/normal/UV/index buffers.
2. The `react-native-viro-mux` texture seam (`<ViroGPUTexture>`) — owns native-texture work.

No new native module is added here. If a future component needs one (e.g. for streaming a massive splat dataset directly from disk), it goes into `react-native-viro-mux` or its own package — never inline in this one.
