# Splat Container — owned format (`.vsp4`)

We own this container. Static 3D base is **SPZ-compatible** (so static scenes round-trip with the existing SPZ ecosystem). The 4D extension is ours.

## File layout

```
┌──────────────────────────────────────────────┐
│ Header (32 B)                                │
│   magic        u32  'V','S','P','4' = 0x34505356 (little-endian)
│   version      u16  = 1
│   flags        u16  bit0 = has 4D temporal block
│   splatCount   u32
│   shDegree     u8   0..3
│   tempBasis    u8   0 (none) | 1 (low-order poly) | 2 (4D-covariance)
│   tempOrder    u8   polynomial order if tempBasis=1 (1..4)
│   reserved0    u8
│   duration_ms  u32  total length in ms when 4D
│   bounds       6 × f32   xmin,ymin,zmin,xmax,ymax,zmax
└──────────────────────────────────────────────┘
┌──────────────────────────────────────────────┐
│ Base block — SPZ static per-Gaussian payload │
│ (positions, scales, rotations, SH coefficients, opacity per the SPZ spec)
└──────────────────────────────────────────────┘
┌──────────────────────────────────────────────┐
│ 4D block (only if flags.bit0)                │
│   per-Gaussian time-varying parameters       │
│   layout depends on tempBasis (see below)    │
└──────────────────────────────────────────────┘
```

## Temporal extension layouts

### `tempBasis = 1` — low-order polynomial

For each Gaussian, store `tempOrder + 1` coefficients for each of position (3) and scaled rotation (4 quaternion components). Per-frame evaluation: a single horner-scheme polynomial eval at `t ∈ [0, 1]` mapped from `timestamp / (duration_ms / 1000)`. Pure linear algebra; no neural network.

Storage per Gaussian: `(tempOrder + 1) × 7 × f16` = `14 × (tempOrder + 1)` bytes.

### `tempBasis = 2` — native 4D Gaussian (4D mean + 4D covariance)

For each Gaussian, store a 4D mean (`x, y, z, t₀`) and a symmetric 4×4 covariance (10 unique entries). Per-frame conditioning at time `t` collapses to a 3D Gaussian via the standard conditioning formulas (`mu_3 + Σ_xt · Σ_tt⁻¹ · (t − t₀)`, `Σ_3 − Σ_xt · Σ_tt⁻¹ · Σ_xtᵀ`). Pure linear algebra.

Storage per Gaussian: `(4 + 10) × f16` = `28` bytes.

## Reading

Readers that understand only the SPZ base ignore the 4D block (it sits after the SPZ payload). The base block is byte-identical to a stand-alone SPZ. The `flags.bit0` bit and the `4D` magic make the 4D content discoverable but unambiguous.

## Compatibility

- **Static-only** export: emit base block, leave `flags.bit0 = 0`, leave `duration_ms = 0`. The file is a `.vsp4` envelope around standard SPZ.
- **4D** export: emit base + temporal block. Round-trip with SPZ tooling loses only the temporal block, which is the expected behavior.

## Verification before parsing real files

This document is a **specification** based on the SPZ public spec; the SPZ binary layout (field order, quantization scales) must be re-verified against the upstream reference implementation before writing the parser. The parser is not in this scaffold (per `Splat-Architecture.md` status table) precisely so it doesn't get built against guessed field offsets.
