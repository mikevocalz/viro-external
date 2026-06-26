# TASKS — @viro-external/gui

## Phase 0 — scaffolding (DONE)
- [x] AGENTS.md, CLAUDE.md, TASKS.md
- [x] config/defaults.json (controls, button, holographicButton, stackPanel, cylinderPanel, holographicSlate, zones, comfort)
- [x] doc/Architecture.md, BabylonGUIMapping.md, Layout.md, Composition.md

## Phase 1 — Babylon verification (DONE)
- [x] Verified Babylon GUI3D control surface against `react-babylonjs` canonical set.
- [x] Verified Viro 2.56.0 event surface: `onHover(isHovering, position, source)`, `onClick(position, source)`, `onClickState(clickState, position, source)`, `ViroClickStateTypes` (CLICK_DOWN=1, CLICK_UP=2).

## Phase 2 — Wave 1 (DONE)
- [x] Control3D — base with pointer state, semantic scale anim.
- [x] Container3D — `arrange()` delegate, `blockLayout` carried.
- [x] Button3D — Quad + ViroText, MovablePanelContext-aware.
- [x] HolographicButton — back plate (ViroBox) + content plate + hover highlight + tooltip.
- [x] StackPanel3D — linear arrange, MovableNode-wrapped, MovablePanelContext provider.
- [x] CylinderPanel — arc layout via `deriveCylinderArc`, throws on over-subscription, MovableNode-wrapped.
- [x] HolographicSlate — Babylon-named wrap of ViroSlate.
- [x] SceneZone + SCENE_ZONES — zone-based composition primitive.
- [x] MovablePanelContext + useInsideMovablePanel — child-disable rule.
- [x] guiStore (Zustand) — focus, grabbed slate id.

## Phase 3 — quality gates
- [x] `tsc --noEmit` passes.
- [x] Babylon prop names matched; documented in doc/BabylonGUIMapping.md.
- [x] Hover/press states semantic (config-driven timings + scales).
- [x] StackPanel3D + CylinderPanel produce non-overlapping layouts; `minStepDegrees` derived in code + docs.
- [x] No hand-typed world positions in components; zone model used.
- [x] Containers wrap MovableNode; children disable own `movable` inside movable panel (dev warning).
- [x] Default `dragType` = `FixedDistance` (OpenXR-friendly).
- [x] No invented Babylon or Viro APIs.
- [x] Wave-2 left as extension surface (PROMPT-6).

## Wave 2 (PROMPT-6) — DONE
- [x] `VolumeBasedPanel` — abstract base with `VolumeMapper` injection.
- [x] `PlanePanel` — flat grid, non-overlap by construction.
- [x] `SpherePanel` — billboarded sphere section, `deriveSphereSpacing` throws on over-subscription.
- [x] `ScatterPanel` — deterministic `mulberry32(seed)` + iterative relaxation.
- [x] `TouchHolographicButton` — extends `HolographicButton`, Z-push on press. Touch capability limit documented honestly (`doc/Controls-Wave2.md`).
- [x] `MeshButton3D` — `Viro3DObject` (verified props `source`/`type`/`resources`/`materials`) wrapped in `Control3D`.
- [x] `Slider3D` — axis-locked thumb, value in Zustand (`useSliderStore`), step snap.
- [x] `TouchHolographicMenu` — glass backplate + `PlanePanel` of touch buttons + `MovableNode` grab bar.
- [x] `doc/Controls-Wave2.md` — Babylon mapping, derivations, capability-limit doc.
