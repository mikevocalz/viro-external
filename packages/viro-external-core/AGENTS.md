# AGENTS — @viro-external/core

Same rules as `react-native-viro-mux`. In addition:

- The `react-native-viro-mux` public surface (`contract.ts`) is **frozen**. Import; never modify.
- Textures bind through `<ViroGPUTexture materialName=... />` siblings. Never re-import textures here.
- Geometry generators live as pure functions exported alongside the component (so `@viro-external/gui` can reuse them).
