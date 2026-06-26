# PROMPT-4 — `@viro-external/core`: `ViroGaussianSplat` (4D-first)

You are a **principal-level native React Native + XR + GPU engineer**. Production
packages, not demos. Verify every API against real source. Never invent props,
classes, methods, or file-format fields. If a symbol or format detail can't be
verified, stop and say so. `npx tsc --noEmit` must pass before any task is "done". No
stubs, TODOs, or placeholder bodies in delivered code.

This is **package 4 of 5**, in `@viro-external/core`. It is the most technically
demanding: a **real-time 4D Gaussian-splat renderer** — time-varying Gaussians,
evaluated per-frame at a `timestamp`, sorted, and rasterized into a Viro texture
through the `ViroGPUTexture` seam. **Static 3D splats are the degenerate case** of the
same pipeline (no temporal evaluation; sort gated on camera move only), not a separate
renderer.

Hard upstream dependency on **`react-native-viro-mux`** (PROMPT-1) for the
`ViroGPUTexture` seam.

```ts
import { ViroGPUTexture, registerExternalTexture, releaseExternalTexture, MovableProps, MovableNode } from 'react-native-viro-mux';
```

Compose `MovableNode` for movability — do not re-wire `onDrag`.

### Critical correctness rules (these are non-negotiable; read before coding)

1. **`Viro3DObject` cannot load splats.** Splats are not meshes; `.ply` / `.splat` /
   `.ksplat` / `.spz` are not OBJ/glTF. A splat needs its own renderer node:
   parse → GPU buffers → project → **sort by depth every frame** → rasterize with
   Gaussian alpha falloff. Never route a splat through the mesh path.
2. **A JS-only wrapper cannot render splats.** The render pass is native/GPU work
   (WebGPU/TypeGPU compute + the `ViroGPUTexture` bridge). State this honestly; a
   native rebuild is required (no OTA, no Expo Go).
3. **Premium-no-fallback applies to the *renderer*, not to capability detection.**
   There is no quality-degraded "splat-like particle field." There is no `.glb`
   "approximation presented as the splat." Capability detection (is the native/WebGPU
   path present on this device) is correct engineering and stays. If the path is
   genuinely absent, the component reports an honest error — it does not fake the splat.
4. **Privacy is the heaviest surface in this family.** A splat is a photographic
   reconstruction of a real space and the real people in it. Even though this package
   renders rather than captures, the viewer rules below are mandatory.

---

## Phase 0 — scaffold (the slang-splat-style working agreement)

Create at the package root and treat as source of truth:

- **`AGENTS.md`** — read `config/defaults.json` before any tunable; never invent
  format fields or GPU APIs; no stubs; `npx tsc --noEmit` gates "done"; `doc/` wins
  over README.
- **`CLAUDE.md`** — terse; **Zustand state machine for all runtime state, never
  `useState`**; functional components; verified APIs only; principal bar; design/motion
  carry semantic weight; performance is a feature.
- **`TASKS.md`** — living ledger, phased, checkboxes.
- **`config/defaults.json`** — single source of truth: `maxSplats` per device profile,
  sort tile size, sort cadence (exact per-frame vs amortized-every-N + view-delta),
  render resolution scale, SH degree, temporal-basis order, LOD distance bands,
  progressive-load chunk size, container magic bytes/version. No inline magic numbers.
- **`doc/`** map: `Architecture.md`, `Rendering.md` (the project→sort→rasterize pass),
  `Temporal.md` (the 4D evaluation kernel), `Container.md` (the file format — see
  Phase 2), `XR.md` (Viro texture bridge + device budgets), `Privacy.md`,
  `Fixtures.md` (the synthetic generator).

## Phase 1 — the container format: own it, 3D base + temporal extension

We are **not** targeting any vendor's closed playback format (e.g. Gracia is a closed
runtime, not a loadable format). We **own** the container:

- **3D base layer = SPZ-compatible.** Reuse the real, published SPZ layout for the
  static per-Gaussian data (position, scaled rotation/covariance, SH color, opacity) so
  static 3D scenes round-trip with the existing SPZ ecosystem. Verify the SPZ spec
  against its real source before implementing the parser — do not guess field order or
  quantization.
- **4D temporal extension block.** A documented extension carrying per-Gaussian
  time-varying parameters as **native time-varying 4DGS** (a 4D mean + 4D covariance
  formulation, or an explicit low-order temporal basis per Gaussian — choose one,
  document the math in `doc/Temporal.md`, and justify it as a **pure linear-algebra**
  per-frame evaluation with **no neural network in the hot path**). Readers that only
  understand the 3D base skip the extension; your runtime reads it.

Document the full byte layout in `doc/Container.md` with version + magic bytes.

## Phase 2 — the runtime (the deliverable)

**Component `ViroGaussianSplat`** — peer of `Viro3DObject`, not a wrapper:

```ts
export interface ViroGaussianSplatProps {
  source: { uri: string; format: 'spz' | 'splat' | 'ply' | 'ksplat' };
  timestamp?: number;        // seconds into the sequence; drives temporal eval.
                             // omitted/undefined => static 3D (degenerate case).
  playing?: boolean;         // advance timestamp automatically
  loop?: boolean;
  quality?: 'low' | 'medium' | 'high' | 'auto';
  maxSplats?: number;        // hard cap; renderer truncates by importance ranking
  progressive?: boolean;     // stream splats in by importance/proximity
  materialName: string;      // ViroGPUTexture seam target
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
  visible?: boolean;
  onLoadStart?: () => void;
  onProgress?: (fractionLoaded: number) => void;
  onLoad?: (meta: { splatCount: number; bounds: [number,number,number,number,number,number]; format: string; duration?: number }) => void;
  onError?: (error: Error) => void;
}
```

Movability: `ViroGaussianSplatProps extends MovableProps`. This is how the viewer's
**recenter / reposition** affordance (required by the splat discipline) is implemented:
- **Tabletop mode (default):** `movable` with `dragType="FixedDistance"` +
  `pinchToScale` — the user grabs and repositions/rescales the miniature. This is the
  "reset scale / recenter" requirement.
- **Full-scale (1:1) mode:** the splat is environment content; it stays world-anchored
  and is **not** freely draggable (moving the world around the user is a comfort
  hazard). Disable `movable` in full-scale; recenter happens via an explicit "recenter"
  action with a comfortable fade, never a continuous drag.
Document this mode/movability matrix in `doc/XR.md`.

The pipeline (document in `doc/Rendering.md` + `doc/Temporal.md`, then implement):

1. **Parse** container → packed GPU buffers (base 3D + temporal extension).
2. **Per-frame temporal evaluation kernel** (WebGPU/TypeGPU compute): evaluate each
   Gaussian's position + covariance at the current `timestamp`. For static 3D this
   stage is skipped entirely.
3. **Depth sort** every frame: GPU radix sort; `config` selects exact per-frame vs
   amortized-every-N + view-delta correction. Sorting 1M+ time-varying splats is the
   single hardest problem — budget it explicitly.
4. **Rasterize** as camera-facing ellipses with Gaussian alpha falloff, output to a
   render target → `ViroGPUTexture` → Viro surface.
5. **Frustum culling + LOD by distance + `maxSplats` importance-truncation** are all
   mandatory and always on. A 4M-Gaussian file does not render 4M on a Quest 2.
6. Note: **4D re-renders the texture every frame** (temporal eval is continuous), so
   the per-frame budget is stricter than static 3D — this raises the device floor.
   Encode that in the device-profile table.

Device budgets — put a `splatDeviceProfiles` table in `config/defaults.json`, seeded
from these conservative starting points (verify on hardware): Quest 2 ~250k–400k @72,
Quest 3 / Pro ~600k–900k @90, generic Horizon OS ~400k–600k @72, ARCore ~120k–250k @60,
ARKit ~150k–300k @60. **4D targets the upper-tier devices** (Quest 3 / Pro class);
state honestly that low-power profiles are 3D-static-only.

## Phase 3 — the synthetic fixture generator (data source; no capture)

We are **not capturing** anything. The renderer's test data is a **synthetic 4D scene
generator** that ships in the repo (`fixtures/`) and emits the owned container format:

- A deterministic, seeded TS (or Python) script producing a small procedural 4D scene
  — e.g. a few thousand Gaussians that orbit / pulse / translate over `t ∈ [0, 1]` —
  with **known ground-truth position and covariance at every `t`**, so the temporal
  kernel can be asserted correct rather than eyeballed.
- Output: a `.spz`-base + temporal-extension file in `assets/fixtures/`, plus a static
  3D-only fixture (no temporal block) to exercise the degenerate path.
- This is both the dev data source and the test fixture. Document it in
  `doc/Fixtures.md`.

## Phase 4 — viewer rules (privacy + comfort, mandatory)

When this renders real captures later, the viewer that hosts it must:
- Default to **miniature tabletop mode** (~0.3–0.5m); **full-scale (1:1) only after an
  explicit user action**, with a comfortable fade transition (no camera motion).
- Show a **non-dismissible-until-acknowledged privacy notice** on first view of a scan
  representing a real space/people.
- **Never log the signed source URL** (it can itself grant access) — keep it out of
  analytics, crash reports, and console.
- Never screenshot/re-export without explicit user action; never silently persist/
  upload.
- A `SplatInspector` surface always reports splat count, bounds, format, and **whether
  what's shown is the real splat** (it always is here — there is no fallback rung).
- Place a tabletop splat in the `primary` scene zone; full-scale splat = environment,
  with inspector/controls as body-locked `dock`/`statusBar` chrome — never overlapping.

## Phase 5 — quality gates

- `npx tsc --noEmit` passes.
- Temporal kernel asserted against the synthetic fixture's ground truth.
- Static-3D degenerate path verified (no temporal block → no eval stage).
- Sort/cull/LOD/`maxSplats` all present and enforced; device profiles in config.
- No `Viro3DObject` splat-loading claim anywhere. No particle-field or `.glb`
  "approximation" presented as a splat. Honest error when the native path is absent.
- Signed URLs never logged; privacy notice + tabletop default present in the viewer.
- `config/defaults.json` holds every tunable; `TASKS.md` fully checked.

Stop and ask before forcing a conflicting dependency, guessing a format field, or
inventing a GPU/Viro API.
