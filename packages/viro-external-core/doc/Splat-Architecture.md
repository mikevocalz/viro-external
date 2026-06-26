# Splat Architecture — `ViroGaussianSplat`

## What this is

A real-time **4D** Gaussian-splat renderer where static 3D is the degenerate case (no temporal block ⇒ no per-frame eval). Not a wrapper around `Viro3DObject` — splats are not meshes.

## Stack

```
Container (SPZ base + 4D ext) ─▶ Parser ─▶ packed GPU buffers
                                              │
                                              ▼
                                  (per frame, native/WebGPU compute)
                                              │
                            ┌─────────────────┴──────────────────┐
                            │                                    │
                  temporal eval kernel              (skipped for static 3D)
                            │                                    │
                            ▼                                    │
                       depth sort  ◀──── view delta ─────────────┘
                            │
                            ▼
                  ellipse rasterize w/ Gaussian alpha
                            │
                            ▼
                  render target (MTLTexture / GL texture)
                            │
                            ▼
                  registerExternalTexture (PROMPT-1 seam)
                            │
                            ▼
                  ViroGPUTexture → named material → ViroQuad
```

## Status (honest)

| Stage                              | Status        |
| ---------------------------------- | ------------- |
| Container format spec              | drafted in `doc/Splat-Container.md` |
| TS parser (SPZ base + 4D ext)      | not built — would require verifying SPZ binary layout end-to-end against the upstream reference; pending |
| Synthetic fixture generator        | **built** (`fixtures/genSplat.ts`) |
| Per-frame temporal eval kernel     | requires WebGPU/TypeGPU native — pending PROMPT-1 native bridge |
| Depth sort                         | requires GPU compute — pending |
| Rasterizer                         | requires GPU compute — pending |
| `ViroGPUTexture` bridge consumption| ready (PROMPT-1 contract is frozen) |
| Capability detection + honest error| **built** in `ViroGaussianSplat.tsx` |

The component ships **today** as the React surface: prop contract, movability, device profile selection, capability detection, honest `onError` when the native renderer is not present. The native renderer lands in a follow-up pass; no quality-degraded fallback substitutes for it.

## Tabletop vs full-scale mode

| Mode      | Default                    | Movability                          | Scale       |
| --------- | -------------------------- | ----------------------------------- | ----------- |
| Tabletop  | yes                        | `movable=true`, `FixedDistance` + `pinchToScale` | 0.3–0.5 m |
| Full-scale (1:1) | explicit user action | `movable=false` (recenter only via explicit action with fade) | 1.0 |

Per the comfort discipline: dragging the world around the viewer is a vection hazard. Recenter is a fade, not a drag.
