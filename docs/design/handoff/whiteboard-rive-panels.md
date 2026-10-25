# Handoff: whiteboard and Rive panels

Skill applied: `design-handoff` (design plugin). Inputs: ADR 0001, master prompt §9 and §11, and the code below. Every number in this file is read from code on 2026-10-24 unless the row says "proposed". Corner radii come from `../system/panel-tokens.md`, which is awaiting gate 3.

Code read:

- MoyoLearn `feat/business-photocraft-engine-admission`: `apps/mobile/src/native-3d/rive-board-panel.tsx`, `tutor-board-panel.tsx`, `packages/ui/xr/board-chrome-layout.ts`, `board-layout.ts`, `board-placement.ts`, `world-slot.ts`, `workspace-drag.ts`, `spatial-tokens.ts`, `premium/spatialTokens.ts`, `question-chrome-layout.ts`, `board-chrome-bind.ts`, `board-chrome-commands.ts`, `packages/app/features/tutor/tutor-xr-screen.native.tsx`.
- viro-external `feat/native-whiteboard-rive-panels`: `packages/ui/src/SpatialPanel.tsx`, `geometry.ts`, `world-slot.ts`, `visual-depth.ts`.

## Overview

The board is one carried object: a Rive `BoardChrome` face (title band, tool strip, frame) with the QuickDraw paper showing through a transparent window, an invisible pointer plane over that window, and an amber grip bar under the panel. A question panel sits on the left of the arc. Under ADR 0001 the paper becomes a native renderer on the Viro-owned Surface (D2) and the chrome becomes native Rive in ViroCore (D3). The geometry below stays the same through that change unless a row is marked proposed.

## Units and frames

- 1 unit = 1 m. Head-relative frame: head at origin, forward is -Z, yaw in degrees about +Y.
- Panel-local frame: panel centre at origin, +Y up. Rive artboard Y grows down; the flip happens once, in `artboardToPanel` (`board-chrome-layout.ts`).
- Angles below are the full angle subtended at the panel's real distance: `2·atan(size / 2d)`.

## Placement

The composition is placed once from the settled head pose (`placeInFrontOf`), flattened to the horizontal so the board stays upright. `workspaceHeadOf` recovers the head position, and `worldSlot` puts each panel on an arc around it.

| Slot | Position (head-relative) | Yaw | Source |
| --- | --- | --- | --- |
| Centre (board) | `[0, 0, -2.6]` | 0° (faces head) | `premium/spatialTokens.ts` `ARC_RADIUS = 2.6`, `SLOT_Y = 0` |
| Left (question panel) | `[-1.454, 0, -2.155]` (azimuth -34°) | +37° (34° facing + 3° toe-in) | `PANEL_AZIMUTH_DEG = 34`, `TOE_DEG = 3` |
| Right | `[+1.454, 0, -2.155]` (azimuth +34°) | -37° | `AZIMUTH_DEG = 34` |

viro-external's own `worldSlot` (`packages/ui/src/world-slot.ts`) uses the same 2.6 m radius, a 28° side angle and exact facing with no toe-in. The two disagree on side angle (34° vs 28°) and toe-in (3° vs 0°). **Open:** pick one for `@viro-external/ui`.

## Panels

| Panel | Size (m) | Angular size at 2.6 m | Distance | Yaw | Corner radius today | Corner token (proposed) |
| --- | --- | --- | --- | --- | --- | --- |
| Board face (Rive `BoardChrome`) | 1.200 x 0.750 | 26.0° x 16.4° | 2.6 m | 0° | 0 (square `xrBoardBacking` quad; any rounding inside the `.riv` sits on a square slab) | `radius.board` |
| Paper window (QuickDraw content) | 0.985 x 0.615, centre `(0, -0.067)` panel-local | 21.4° x 13.5° | 2.6 m | 0° | 0 | none; the paper is inside the face |
| Tool strip band (inside the face) | 1.200 x 0.100, top edge 0.035 below panel top | 26.0° x 2.2° | 2.6 m | 0° | n/a (artboard) | `radius.toolKey` for keys |
| Tool key (pen, highlighter, eraser, undo, redo, clear) | 0.100 x 0.085 | 2.2° x 1.9° | 2.6 m | 0° | `.riv`-drawn | `radius.toolKey` |
| Colour-well key | 0.092 x 0.085 | 2.0° x 1.9° | 2.6 m | 0° | `.riv`-drawn | `radius.toolKey` |
| Ask key | 0.158 x 0.085 | 3.5° x 1.9° | 2.6 m | 0° | `.riv`-drawn | `radius.toolKey` |
| Grip bar | 0.650 x 0.090, centre 0.470 below panel centre | 14.3° x 2.0° | 2.6 m | 0° | 0 | `radius.grip` |
| Question panel (left) | 1.440 x 0.900 | 31.0° x 19.6° | 2.6 m | +37° | 0 | `radius.board` |
| `SpatialPanel` default (viro-external) | 1.600 x 1.000 | 34.2° x 21.6° | 2.6 m via `worldSlot` | per slot | 0.06 (`cornerRadius` default) | `radius.surfacePanel` |
| `SpatialPanel` curved (viro-external) | 1.600 wide, arc = 0.32 x 120° = 38.4° | as left | 2.6 m | per slot | none (curved geometry ignores radius) | `radius.cylinder` |

Derived from: `PANEL_WIDTH_M = 1.2`, `CHROME_ARTBOARD = 1248 x 780`, `CONTENT_BAND = {x:112, y:140, w:1024, h:640}`, `TOOL_ROW`, `INK_ROW`, `GRIP_W/GRIP_H = 0.65/0.09`, `QUESTION_PANEL_WIDTH_M = 1.44` with a 1280 x 800 artboard, and `SpatialPanel` defaults `width = 1.6, height = 1, cornerRadius = 0.06, curvature = 0.32`.

### Stack along the board normal

| Layer | Offset from face (m) | Source |
| --- | --- | --- |
| Opaque backing | -0.001 | `rive-board-panel.tsx` |
| Rive face | 0 | |
| Paper raster | +0.0005 | `boardLayer.raster` |
| Live ink | +0.001 | `boardLayer.ink` |
| Pointer plane (input only) | +0.002 | `POINTER_STANDOFF` |

### Aspect

The paper is **16:10 landscape** everywhere it is configured: `BOARD_ASPECT = { w: 16, h: 10 }`, `CONTENT_BAND` 1024 x 640, `boardSurfacePixels` 1008 x 630, `CHROME_ARTBOARD` 1248 x 780. Meta's default panel is also 16:10 (1024dp x 640dp, developers.meta.com/horizon/design/panels).

The ADR's happy-path call site uses `widthPx: 2048, heightPx: 2867`, which is 5:7 portrait. No shipping file uses 5:7. **Open for L0/L2:** the call site should use a 16:10 size (for example 2048 x 1280), or the ADR should state why the native board changes aspect. A 5:7 Surface mapped onto a 16:10 window either stretches strokes or letterboxes the paper.

### Pixel radius

Per master prompt §9: `radiusPx = cornerRadius x widthPx / widthM`, per axis if pixel aspect differs from panel aspect. Example with the proposed `radius.board` at 2.6 m (0.038 m) on the 2496 px wide chrome texture: `0.038 x 2496 / 1.2 = 79 px`. Clamp to `min(widthPx, heightPx) / 2`.

## Components

| Component | Variant | Props that matter | Notes |
| --- | --- | --- | --- |
| Board face | Rive B1 scene panel (default) or B2 compositor quad (gate 2) | `artboard: 'BoardChrome'`, `stateMachine: 'BoardChrome'`, `fit: 'contain'`, resolution 2496 x 1560 | Whiteboard paper is always a scene panel (ADR D4) |
| Paper | Native renderer (D2) or WebView (flagged fallback) | `surfaceId`, `widthPx`, `heightPx`, `cornerRadiusM` | Board is always light paper |
| Pointer plane | Invisible | covers the paper window only | Rounded corners count for hit testing (§9) |
| Grip | Movable boards only | `dragTransform="none"`, report-only | Label `'Hold to move'` / `'Moving board'` |
| Fallback strip | When the Rive chrome fails | ViroText keys | Strings in `../copy/whiteboard-copy.md` |

## Rive contract (BoardChrome)

View-model properties pushed from JS (`board-chrome-bind.ts`):

| Name | Type | Meaning |
| --- | --- | --- |
| `tool` | number | 0 draw (pen), 1 highlight, 2 eraser |
| `ink` | number | 0 black, 1 blue, 2 red, 3 green, 4 yellow, 5 orange, 6 violet; unknown maps to 0 |
| `uiOpacity` | number | defaults to 1 |
| `canUndo`, `canRedo` | boolean | history state |
| `asking` | boolean | Ask in flight; Ask is disabled |
| `hasMarks` | boolean | Clear is enabled |
| `paletteOpen` | boolean | ink row replaces tool row in the same band |
| `clearArmed` | boolean | first Clear press; second press confirms |
| `grabbed` | boolean | board in the hand; every command ignored |
| `reducedMotion` | boolean | the tutor screen passes `true` today |
| `status` | string | empty is healthy; otherwise one line of status copy |

Commands from Rive to JS: `command` (number) plus `commandSeq` (number, edge trigger). JS resets `command` to 0 after reading.

| `command` | Meaning | Gate |
| --- | --- | --- |
| 0 | none | |
| 1, 2, 3 | pen, highlighter, eraser | not `grabbed` |
| 4 | togglePalette | not `grabbed` |
| 5 | undo | `canUndo` |
| 6 | redo | `canRedo` |
| 7 | clear | `hasMarks` |
| 8 | askNatalie | not `asking` |
| 9 | unused | decodes to none |
| 10-16 | ink 0-6 | not `grabbed` |
| 17 | closePalette | not `grabbed` |

The native Rive Nitro surface (D3) must keep these names and numbers so the `.riv` file does not change.

## States

Board renderer states come from the ADR's `WhiteboardRendererState`. Panel-level states come from the tutor screen.

| Element | State | What the learner sees | Trigger |
| --- | --- | --- | --- |
| Board panel | loading | `'Getting your board ready'` / `'Bringing your working over'` | `XrPanel` checking / restoring |
| Board panel | connecting | Title `'Connecting your board…'`; paper is the `xrBoardEmpty` tile (#112d44) | Surface not yet drawable |
| Board panel | empty | Blank light paper, strip live, Undo/Redo/Clear disabled | `hasMarks = false` |
| Board panel | active | Paper and ink, strip live | renderer `active` |
| Board panel | suspended | Last frame held; input off | renderer `suspended` (app paused) |
| Board panel | surface lost | Paper replaced by the empty tile with the surface-lost line; strip stays visible; rebuild runs automatically | renderer `lost` |
| Board panel | unavailable | Title `'Board unavailable — return to lesson'` | `surfaceTimedOut` |
| Board panel | grabbed | Grip reads `'Moving board'`; paper and strip take no input | `grabbed = true` |
| Tool key | rest / hover / pressed / selected / disabled | Drawn by the `.riv`; selected must not rely on colour alone (see a11y) | view-model state |
| Clear | armed | Second press confirms; `'Keep my work'` cancels in the fallback strip | `clearArmed = true` |
| Ask | sending | `'Sending'` on the fallback strip; Ask disabled | `asking = true` |
| Rive chrome | failed | Fallback ViroText strip replaces the chrome | `onChromeError` |
| Compositor layer (B2) | evicted | Falls back to a scene mesh with the same texture and coverage function, so nothing visible changes | slot budget exceeded |

## Interactions and input arbitration

What the code does today (`rive-board-panel.tsx` header):

1. The pointer plane covers only the paper window. A ray inside the window draws.
2. Rays on the tool strip miss the pointer plane and fall through to the Rive chrome's own input.
3. Rays on the grip drag the carrier. `useCarrierDrag` writes the node natively per report and commits on release.
4. While `grabbed`, the pointer plane is disabled (which cancels any in-flight stroke) and chrome input is off.
5. One owner per pointer (`BoardPointer` contract).

What the native path must add (master prompt §11):

| Rule | Behaviour |
| --- | --- |
| Capture | A stroke that starts on the paper keeps the pointer until release, even if the ray leaves the window or crosses the tool strip. The strip ignores a captured pointer. |
| Leaving the board | The stroke clamps to the paper edge; it does not end and restart. |
| Cancel | Tracking loss, focus loss, controller or pen disconnect, app suspend, unmount and ownership change each cancel the stroke deterministically. Held-button state clears; no phantom stroke on resume. |
| Drag vs draw | Repositioning never creates ink. A press on the grip never starts a stroke. |
| Pressure | Pressure "unavailable" is distinct from a valid 0. Pressure is never synthesised. |
| Rounded corners | Rays inside the transparent corner do not hit the panel or the pointer plane. |
| Remote edits | A local cancel never cancels a remote or tutor operation. |
| Text / IME | Text editing and keyboard focus keep working on the paper (see a11y doc). |

Haptics: Meta's guidance pairs a haptic tick with hover and press on controller UI (Carmack app review, developers.meta.com/horizon/blog). Not wired today. **Open.**

## Motion

| Element | Trigger | Behaviour |
| --- | --- | --- |
| Tool strip | tool or ink change | Rive state-machine transition; static when `reducedMotion` is true |
| Ink row | `paletteOpen` | Swaps with the tool row in the same band; no pop-over, no overlap with the paper |
| Board | grab and release | Follows the hand 1:1; no easing or snap-back on release |

Durations and easings live in the `.riv` file and are not readable from JS. **Open:** list them once the native Rive surface can report state-machine timing.

## Edge cases

| Case | Expected behaviour | Today |
| --- | --- | --- |
| Surface lost (Surface destroyed, GL context reset) | Renderer goes `lost`; JS rebuilds from `Store.getSnapshot()`; Store is never touched by the loss (ADR D1). In-flight stroke is cancelled, not committed. Surface-lost copy shows until the first frame lands. | WebView path: no `lost` state |
| Layer evicted (B2 compositor, slots full) | Panel drops to the scene-mesh fallback with identical texture and corners (§9). No learner-facing message. Logged. | `appendLayers` drops the panel silently; no fallback |
| Pen disconnected mid-stroke | Stroke cancelled at the last confirmed sample; pen-disconnected copy shows; controller ray and hand input keep working | No stylus copy exists |
| Pen reconnects | Resumes on next press; no stroke spans the gap | |
| Head tracking lost | Stroke cancelled; board stays world-locked where it was | Internal `'tracking-lost'` state only |
| Chrome `.riv` fails to load | Fallback ViroText strip; error `'Board controls unavailable: …'` logged | Implemented |
| Ask fails | `status = 'Could not send — try again'` | Implemented |
| Board moved off the comfort arc | Board stays where released; Recenter brings it back | `'Recenter'` exists |
| iOS / no native renderer | `isAvailable = false`, WebView board | Per ADR |

## Accessibility notes

See `../a11y/whiteboard-a11y.md`. Summary for implementers:

- Tool keys are below every target floor in this repo and in Meta's guidance at 2.6 m. Either move the board closer or enlarge the keys before release.
- The Rive chrome has no accessible names. Each key needs a name that matches its label in `../copy/whiteboard-copy.md`.
- `reducedMotion` must come from a system or app setting, not a constant.
