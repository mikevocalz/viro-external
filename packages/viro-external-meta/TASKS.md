# TASKS — @viro-external/meta

## Phase 0 — verify real exports (DONE)
- [x] Enumerated `react-native-viro-mux/src/index.ts` exports — 17 symbols.
- [x] Enumerated `@viro-external/core/src/index.ts` — 16 symbols.
- [x] Enumerated `@viro-external/gui/src/index.ts` — Wave 1 (24) + Wave 2 (16) = 40 symbols.
- [x] Confirmed zero actual name collisions across packages.

## Phase 1 — scaffold (DONE)
- [x] AGENTS.md, CLAUDE.md, README.md, TASKS.md
- [x] doc/Install.md, Imports.md, Versioning.md, Compatibility.md
- [x] package.json with subpath exports + `sideEffects: false` + exact-pinned sibling deps + verified peer deps
- [x] tsconfig.json

## Phase 2 — export surface (DONE)
- [x] `src/bridge.ts` — re-exports from `react-native-viro-mux`
- [x] `src/core.ts` — re-exports from `@viro-external/core`
- [x] `src/gui.ts` — re-exports from `@viro-external/gui`
- [x] `src/index.ts` — root barrel (`export *` over the three subpaths)
- [x] Zero invented exports, zero re-declarations, zero wrappers.

## Phase 3 — docs (DONE)
- [x] `doc/Install.md` — one install + native rebuild requirement.
- [x] `doc/Imports.md` — verified symbol map.
- [x] `doc/Compatibility.md` — XR target matrix, drag-mode matrix, 4D splat tier note.
- [x] `doc/Versioning.md` — semver discipline.

## Phase 4 — quality gates
- [x] `tsc --noEmit` passes against real workspace sibling types.
- [x] Every re-export resolves to a real symbol (verified line-by-line in Phase 0).
- [x] `sideEffects: false`.
- [x] No components, no native code, no prop massaging added.
