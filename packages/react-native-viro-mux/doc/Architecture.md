# Architecture

`react-native-viro-mux` is the lowest layer in the `@viro-external/*` family. It owns:

1. **The Mux → Viro video texture path** (`ViroMuxVideo` / `ViroMuxSurface`).
2. **The frozen external-GPU-texture seam** (`ViroGPUTexture`, `registerExternalTexture`, `releaseExternalTexture`) — exported from `src/contract.ts`.
3. **The shared `MovableProps` contract + `MovableNode` wrapper** — every downstream component composes it; no one re-wires `onDrag`.

Stacking order:

```
@viro-external/gui ── composes ──┐
@viro-external/meta ─────────────┤
@viro-external/core × 3 ─────────┤── react-native-viro-mux ── @reactvision/react-viro 2.56.0
                                 │                          │
                                 │                          └── @mikevocalz/virocore (pico-support fork)
                                 │
                                 └── all import `contract.ts` from this package
```

The native side of the seam lives in the virocore fork (`mikevocalz/virocore` on `pico-support`) per Appendix A of PROMPT-1. This package exposes that seam to JS through a Nitro module.

See:

- `TextureBridge.md` — the load-bearing texture contract.
- `Movability.md` — VR-vs-AR drag-mode matrix.
- `MuxPlayback.md` — HLS / Mux Data telemetry rules.
- `Native-iOS.md` / `Native-Android.md` — the native binding map.
