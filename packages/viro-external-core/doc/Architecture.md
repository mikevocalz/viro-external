# Architecture — @viro-external/core

Three spatial primitives, all consuming the `react-native-viro-mux` texture seam:

1. **`ViroCylinderSurface`** — parametric cylinder (cone, truncated cone, partial wrap). Geometry generated in JS, fed to Viro's `ViroGeometry`.
2. **`ViroSlate`** — offscreen FBO surface. Owns an external texture handle produced by an offscreen renderer; presents it via `<ViroGPUTexture>` on a flat quad.
3. **`ViroGaussianSplat`** — gaussian-splat point cloud renderer (compute-pass output → external texture → `<ViroGPUTexture>`).

All three:
- Compose `MovableNode` from `react-native-viro-mux` — never re-wire `onDrag`.
- Bind textures via a sibling `<ViroGPUTexture materialName=... />`.
- Expose their geometry generators as pure functions for reuse by `@viro-external/gui` (PROMPT-5/6).

Geometry math is in `doc/Geometry.md`. Babylon prop parity is in `doc/BabylonParity.md`.
