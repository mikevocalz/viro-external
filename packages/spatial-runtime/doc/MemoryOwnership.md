# Spatial memory ownership

## Goal

Reduce total resident memory, not merely JS thread time.

A faster pipeline can still regress memory if geometry, textures, or scene data are independently retained by React Native, a Worklet runtime, ViroCore, and WebGPU.

## Ownership rules

1. Every large resource has one authoritative owner.
2. Cross runtime boundaries with handles, IDs, small structs, or immutable snapshots.
3. Keep large renderer resources in ViroCore/Eskiu or GPU memory.
4. Do not mirror entire scene graphs into Worker Runtime state.
5. Create one long-lived spatial worker by default.
6. Never create a Worklet runtime per panel.
7. Build GPU buffers/textures once and reuse them across frame callbacks.
8. Batch updates; avoid per-node cross-runtime calls.
9. Release resources deterministically on scene/session teardown.
10. Instrument byte counts and lifetime transitions in debug builds.

## Worklets memory

Worker runtimes do not share the React Native JS heap. Use:

- Serializable for one-time snapshots;
- Synchronizable only for genuinely shared, frequently cross-runtime state;
- Shareable when one runtime owns hot access and other runtimes read occasionally.

Avoid pushing large mutable geometry through shared-memory primitives each frame.

## TypeGPU / react-native-webgpu

Supported TypeGPU resources transferred to Worklets retain the same underlying GPU resource. Prefer this path over creating duplicate GPU buffers for the UI/worker runtimes.

Keep one logical GPU resource registry keyed by stable resource IDs.

## Eskiu / ViroCore ABI

The native boundary must record:

- allocator/owner;
- who releases the allocation;
- whether a pointer is borrowed or transferred;
- byte length and alignment;
- mutability;
- thread affinity;
- GPU upload ownership.

Do not expose raw ownership ambiguity through a C ABI.

Suggested shape:

```c
typedef struct {
  uint64_t id;
  const void *data;
  size_t byte_length;
  uint32_t flags;
} VROExternalBufferView;
```

The view is borrowed by default. Explicit acquire/release calls own retained resources.

## Candidate migration order

1. renderer scratch/transient allocations
2. geometry/mesh preparation
3. splat metadata and sort/cull buffers
4. scene-query intermediate buffers
5. media/render-state bookkeeping

Benchmark every migration against the C++ baseline. Do not migrate modules merely because Eskiu exists.
