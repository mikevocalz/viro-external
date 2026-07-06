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

## 2026-07-03 — On-device quality pass (PICO 4 Ultra): drag, text scale, panel look

User-reported defects: "3d ui looks so bad, sphere panel looks horrible, slate
text doesn't scale, those components also don't drag."

### Root causes found

1. **ViroGeometry hit-test verdict: HIT-TESTABLE (hypothesis refuted).**
   Evidence, native side (read-only audit of ~/virocore):
   - `VRONode::hitTest` (VRONode.cpp:1559) tests ANY node with `_geometry` —
     no special-casing that excludes custom `VROGeometry`.
   - `VROGeometry::getBoundingBox()` (VROGeometry.cpp:161) unions vertex
     sources — works for our roundedPlate buffers.
   - `VRONode::hitTestGeometry` (VRONode.cpp:1599) does triangle-accurate
     ray tests via `element->processTriangles`.
   - `VROBoundingBox::containsPoint` is epsilon-tolerant, so FLAT (z=0)
     plates still intersect.
   - JS dist (~/viro dist/components/ViroGeometry.js) wires
     `canHover/canClick/canDrag` exactly like ViroQuad.
   On-device confirmation: `[VXG] slate ... GEOMETRY hover` probes fire (see
   metro log), and renderer logs show `VROInput: drag START ... node=<tag>`.

2. **"Doesn't drag" was three smaller things, not one big one:**
   - Only A / X / grip may start a drag on this fork (trigger just clicks) —
     renderer logs showed trigger presses with `dragEligible=0`.
   - Most A-presses landed between the 30 tiny (0.16 m at ~2.25 m!) grid
     buttons → `VROInput: ClickDown — no draggable node under hit`
     (background hit; nothing to bubble from).
   - Panels had NO native tag, so successful grabs logged
     `drag START node=undefined` — indistinguishable from a broken state.
   Fixes: `tag` prop added to MovableProps (mux) → `viroTag` on the wrapper
   node; demo layout brings surfaces to arm's reach; every panel surface is
   hit-testable.

3. **"Slate text doesn't scale": ViroText glyphs are ABSOLUTE world size.**
   `kTextPointToWorldScale = 0.01` (VROText.h:44): em = fontSize × 0.01 m,
   regardless of the width/height layout box. Default ~18pt = 0.18 m glyphs
   inside 0.16 m buttons / 0.05 m title bars → clipped garbage.
   Fix: new `Text3D` — ViroText on a fixed logical canvas (width=1) inside a
   node scaled by the requested world width; `fontSize` reads as % of box
   width, with `autoFit` fitting the longest line to `fillRatio` of the box.
   All raw ViroText in this package replaced (slate title, button label,
   tooltip); exported for consumers.

4. **"Panels look horrible":**
   - `CylinderPanel`/`SpherePanel` FACEORIGIN math had the yaw SIGN wrong
     (`+θ` instead of `-θ`): off-center cells rotated AWAY from the user by
     2θ — the "sideways buttons" look. Fixed in both mappers.
   - Cells lie on a cylinder around the panel origin (Babylon semantics), so
     a zone-anchored panel pushed buttons another `radius` meters away. Demo
     now offsets the panel `[0,0,radius]` so the arc surface sits at the
     zone anchor and the cylinder axis lands near the user's head.
   - z-fighting: 1 mm plate gaps → ≥2 mm everywhere (button plate 0.002,
     glow 0.004, label 0.006; slate border −0.006 vs backplate −0.003).
   - Palette retuned to Babylon/MRTK dark Fluent (backplate ~#0F0F0F);
     every color audited as Android-order #AARRGGBB. New materials:
     `buttonPlateHover` (hover lightens the plate), `slateTitleBar`
     (lighter grab affordance).
   - Demo reduced 30 → 12 buttons (3×4) with real labels.

### Remaining gaps
- Trigger-to-drag is a fork-level input mapping decision (not addressable in
  JS); users must grab with A / X / grip.
- `MovableNode` never fires `onMoveEnd` for plain drags (Viro has no native
  drag-end event; only pinch-end closes a move today).
- Slate resize gizmo still deferred (native onDrag MOVES the handle node).
- TEMP-PROBE console.logs in HolographicSlate onHover should be removed once
  the on-device verdict is re-confirmed after the next fork bump.

## 2026-07-04 — Polish wave: MuxPlayerPanel, drawer motion, control bar, slate corners

### Dependency-direction decision (header on the video dock)
`@viro-external/gui` depends on `react-native-viro-mux` (peer dep); making
viro-mux import `PanelHeader3D` back from gui would be a workspace cycle.
Resolution: the header stays in gui and the DOCK moved here instead —
new `MuxPlayerPanel.tsx` composes viro-mux's exported transport primitives
(`ViroMuxBridgeSurface`, `getPlayer`, `buildHlsUrl`, `MovableNode`) under the
shared `PanelHeader3D`, which gained a `leftAccessory` slot (hamburger menu
button INSIDE the bar, title shifts right). viro-mux's `ViroMuxPlayerDock`
remains as the header-less low-level fallback; new apps should use
`MuxPlayerPanel`.

### Changes
- `PanelHeader3D`: `leftAccessory?: ReactNode` slot; `TitleBarButton` exported
  from the package index.
- `MuxPlayerPanel` (NEW): PanelHeader3D chrome (title/hamburger/pin/close,
  billboardY follow like the slate) + Mux-player-anatomy control bar:
  play/pause, m:ss current time, scrubber (idle track + buffered fill from
  native `bufferedSec` + MRTK-blue progress + round thumb that grows 1.4× on
  hover/drag), Gizmo-drag seek with 250ms-throttled live seekTo + commit on
  release, click-to-seek (16 near-invisible hit strips — world→local
  clickPos math is unreliable on a movable/billboarded node, segment centers
  are transform-proof), duration, mute toggle (volume-2/volume-x) + hover-
  expanding Gizmo volume slider (scaleX+opacity, 260ms EaseInEaseOut).
  State in zustand (`useMuxPanelStore`, keyed per panel instance).
- Drawer motion: node ALWAYS mounted (opacity 0.15 + tucked behind the video
  plane when closed — opacity-0 would be hit-test-culled); open/close animate
  positionX+opacity 260ms EaseInEaseOut (two registered per-panel anims, run
  on state change, no remount). Rows get a staggered 50ms opacity reveal;
  row clicks are guarded by `drawerOpen`.
- `HolographicSlate`: corner radius `min(w,h)*0.09 → *0.045` (rounding was
  visually excessive on-device), seg stays 12.
- Icon pipeline: added `volume-x` (ICONS + LucideIcon map, PNGs regenerated).
- viro-mux Kotlin: `setVolume(textureId, volume)` (0..1, 0 mutes, non-zero
  remembered natively, −1 restores last non-zero); `getStatus` now returns
  `bufferedSec` (player.bufferedPosition) and `volume`. All via mainHandler.
