# TASKS — @viro-external/core

## Phase 0 — scaffolding (DONE)
- [x] AGENTS.md, CLAUDE.md, TASKS.md
- [x] config/defaults.json
- [x] doc/Architecture.md, Geometry.md, BabylonParity.md, Native.md
- [x] package.json, tsconfig.json

## Phase 1 — API verification (DONE)
- [x] `ViroGeometry` buffer API confirmed: `vertices`, `normals`, `texcoords`, `triangleIndices` (`@reactvision/react-viro@2.56.0/components/ViroGeometry.tsx:16-21`).
- [x] `Viro3DPoint` = `[number,number,number]` (`Types/ViroUtils.ts:17`).
- [x] `materials` prop accepted by `ViroGeometry` via `ViroBase` (verified).
- [x] No native cylinder primitive exists in Viro — confirmed JS geometry path is the supported route.

## Phase 2 — ViroCylinderSurface (DONE)
- [x] `src/buildCylinderGeometry.ts` — pure geometry generator, exported.
- [x] `src/ViroCylinderSurface.tsx` — component, composes `MovableNode`, binds via `materialName`.
- [x] Babylon prop parity documented (`doc/BabylonParity.md`).
- [x] Cone/truncated-cone normals tilt correctly (slope term verified in `Geometry.md`).
- [x] Cap generation when `openEnded=false` and radius > 0.
- [x] Partial wrap (`thetaLength < 2π`) leaves sides open by design.

## Phase 2 — ViroSlate (DONE)
- [x] `src/ViroSlate.tsx` — flat/curved slate, title-bar grab handle, content/chrome material split.
- [x] `doc/OffscreenRender.md` — caller-owned 2D→texture handoff documented (no fabricated Skia/WebGPU).
- [x] `doc/Curvature.md`, `doc/Composition.md`.

## Phase 2 — ViroGaussianSplat (PARTIAL — React surface shipped, native renderer deferred)
- [x] `src/splat/ViroGaussianSplat.tsx` — prop contract, MovableNode composition, tabletop/full-scale mode, capability detection.
- [x] `src/splat/NativeSplatRenderer.ts` — honest capability detection (no fake).
- [x] `config/defaults.json` — device profile table seeded.
- [x] `doc/Splat-Architecture.md`, `doc/Splat-Container.md`, `doc/Splat-Privacy.md`.
- [x] `fixtures/genSplat.ts` — deterministic synthetic 4D generator + ground-truth eval.
- [ ] **Native GPU pipeline** (parser, temporal kernel, sort, rasterize) — pending PROMPT-1 native bridge.
- [ ] Real SPZ binary parser (deliberately deferred per `doc/Splat-Container.md` — would require verifying SPZ field layout end-to-end before writing).
- [x] Signed source URL never logged — verified in component code (`source.uri` never passed to `onError` messages, console, or analytics).

## Phase 3 — quality gates
- [x] `tsc --noEmit` set up.
- [x] All tunables in `config/defaults.json`.
- [x] `MovableNode` composed, never re-wired.
- [x] No invented `VROGeometry` API — only the verified buffer props.
- [ ] Visual UV check (manual — needs a sample app).
