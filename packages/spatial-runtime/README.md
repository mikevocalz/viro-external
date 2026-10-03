# @viro-external/spatial-runtime

Runtime policy for putting heavy spatial work in the right place without duplicating memory across React Native, Worklets, ViroCore/Eskiu, and the GPU.

## Baseline

Peer versions pinned on 2026-10-03 (published on npm; not yet run together on a device):

- `react-native-worklets` 0.13.0
- `react-native-webgpu` 0.10.4
- `typegpu` 0.12.6
- `@typegpu/react` 0.12.x

## The rule

Do **not** treat every performance tool as another copy of application state.

```text
React Native
  | small commands / handles
  v
one spatial Worklet runtime
  | GPU handles / compact parameters
  v
TypeGPU + react-native-webgpu
  |
  v
GPU resources

ViroCore / Eskiu
  |
  +-- owns engine-native memory and lifetimes
  +-- exposes handles / compact ABI data
```

## Worklets

Worklet runtimes have separate JS heaps. This package therefore exposes one lazy, long-lived `viro-spatial-worker` instead of a runtime per panel or feature.

Use the UI runtime for frame-critical interaction/animation work and the worker runtime for CPU preparation that should not block React.

## TypeGPU / WebGPU

TypeGPU's React Native integration can transfer supported GPU resources between the RN and Worklet runtimes while keeping the same underlying GPU objects. Build resources once and capture/transfer handles rather than cloning large JS arrays.

Good candidates:

- splat sort/cull;
- particle simulation;
- mesh deformation;
- image kernels;
- buffer compaction;
- high-volume transform/visibility preparation.

Viro remains the scene renderer unless a feature intentionally owns a WebGPU surface.

## Eskiu

Eskiu belongs below this package, inside ViroCore/native rendering modules. ReactVision reports memory-sensitive ViroCore modules already migrated to Eskiu using up to roughly 85% less memory. Treat that as an upstream result, not a blanket promise for every module.

Use Eskiu/native ownership for:

- long-lived engine structures;
- geometry/native buffers;
- render-state lifetime management;
- renderer-side scratch arenas;
- C/C++/platform interop where copying into JS would be wasteful.

See `doc/MemoryOwnership.md`.
