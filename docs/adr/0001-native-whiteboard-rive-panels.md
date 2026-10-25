# ADR 0001: Native whiteboard, native Rive and rounded panels

Status: accepted for implementation, 2026-10-24. Reviewers: see `prompts/ROSTER.md`.

## Source versions

| Repo | Ref | Notes |
| --- | --- | --- |
| viro-external | `feat/native-whiteboard-rive-panels` on `chore/deps-current-2026-10-24` (09492d4, 7e96257) | Workspace on RN 0.88.0, React 19.3.1, Expo 58.0.19 |
| viro (fork) | `upgrade/viro-3.0.3` f97eb98e | Upstream v3.0.3 merged, version 3.0.3-moyo.1, all deps at npm latest |
| virocore (fork) | `fix/moyo-right-eye-depth-clear` 70e95fd8 | fork/main f5c2a728 (v3.0.3 + PR #111) plus 7 Quest/PICO commits; renderer AAR rebuilt from it |
| MoyoLearn | `feat/business-photocraft-engine-admission` cd2c3197 | Consumer; `node_modules` not installed. Installed copies read from `~/moyolearn-homework-completion` |
| @quickdrawjs/core | 0.2.0 (MIT) | Pinned in MoyoLearn `pnpm-workspace.yaml:165-167` |

## What the code does today

Verified against source on 2026-10-24. "Prompt fact" numbers refer to §5 of the master prompt.

**Whiteboard (facts 1-4, 9).** `QuickDrawSpatialSurface` mounts an adapter and shows its material on a `ViroQuad` (`packages/ui/src/QuickDrawSpatialSurface.tsx:53-77`). The only adapter is MoyoLearn's (`packages/app/features/tutor/quickdraw-spatial-adapter.ts`). It hosts `@quickdrawjs/react-native`, which renders the board as HTML in `react-native-webview` 14.0.1, and re-parents that WebView into `com.viro.core.AndroidViewTexture` through the local Expo module `apps/mobile/modules/board-texture`. It declares `renderer: "esiku"` while its own header says it is not ESIKU-compiled. Input bypasses the surface: the screen calls `adapter.dispatchSurface` → `engine.injectPointer` (`tutor-xr-screen.native.tsx:658,691,710`). `QuickdrawSpatialPanel` declares `onPointer` and never reads it, and its pointer type disagrees with `QuickDrawSpatialPointer` in the contract.

**Rive tool strip (fact 11).** `RiveBoardPanel` renders `ViroRivePanel` with `moyo_board_chrome.riv` (artboard and state machine `BoardChrome`, 2496×1560). `ViroRivePanel` uses `useCanvasPanel` from `nitro-canvas-in-Vision` 0.0.2-rive.4, whose `RiveSurfaceRenderer.kt` drives `app.rive:rive-android` 11.12.1 into the Viro-owned Surface. Android only; iOS has no Rive panel. View-model inputs: numbers `tool`, `ink`, `uiOpacity`, `command`, `commandSeq`; booleans `canUndo`, `canRedo`, `asking`, `hasMarks`, `paletteOpen`, `clearArmed`, `grabbed`, `reducedMotion`; string `status` (`packages/ui/xr/board-chrome-bind.ts:48-88`).

**Surface route (facts 5-6).** `CanvasProducer` (`components/CanvasPanel/nitroCanvas.ts:28-36`) is a TS mirror; the real module is `require("nitro-canvas-in-Vision")`. On Android, `MaterialManager` builds a `CanvasSourceBridge`, which creates an `ExternalSurfaceTexture`; virocore's `VROAndroidViewTexture` makes the OES texture and `VideoSink` wraps it in a `SurfaceTexture`/`Surface`. The bridge then calls `CanvasSourceSurfaces.provideSurface(id, surface, w, h)` by reflection into the Nitro package (`CanvasSourceBridge.java:12-13,33-35,65-74`). There is no public registration API, the Surface is only a Java object (no `ANativeWindow` anywhere in the route), and the JS `sRGB`/`androidRoute` options are ignored by the Android bridge.

**Sampling (fact 16, changed).** Local virocore commits 52b37731 and cbc381d1 changed the scene path: each latched frame is copied into a mipmapped `GL_TEXTURE_2D` (`GL_SRGB8_ALPHA8` in linear mode) and sampled from there. Alpha is copied straight and the material's `Alpha` blend expects straight alpha; `useCanvasPanel` cannot select `PremultiplyAlpha`.

**Compositor (facts 12-15).** Confirmed as the prompt states: `VROOpenXRPanelProducer` writes premultiplied alpha into an `GL_SRGB8_ALPHA8` (or `GL_RGBA8`) swapchain image; nothing implements a producer or calls `addCompositorPanel`; no scene-mesh fallback exists, and `appendLayers` drops panels silently when slots run out; `invalidateGLStateCache()` resets textures, render target and shader only (`VRODriverOpenGL.h:224-231`).

**Dead path.** The AHardwareBuffer handle importer is compiled but never called, and it ignores and leaks `fenceFd` (`VROExternalSurfaceTextureImpl.cpp:92-137`). Do not build on it.

**Rust.** Neither viro nor virocore has any Rust. The C-ABI precedents are `NitroCanvasSharedTextureABI.h` and `ViroRenderer/extension/VROEngine*ABI.h`.

## Decisions

### D1. QuickDraw's Store becomes the authority, headless in React Native

`@quickdrawjs/core` splits cleanly. `store.js` (records, `transact`, `undo`/`redo`, `invertDiff`/`composeDiff`, remote `applyDiff`, `getSnapshot`/`loadSnapshot`) and `freehand.js` (`strokeOutline`) touch no DOM. `editor.js` (1,877 lines of tool and pointer logic) and `shapes.js` draw through Canvas2D and create DOM elements.

So the Store runs in Hermes as the single document, and the tool logic the board uses (`draw`, `highlight`, `eraser`, `geo`, `arrow`, `line`, `text`, `note`, `select`, `hand`, `laser`) is ported into a headless editor that turns board-space pointer samples into Store transactions with QuickDraw's own transaction boundaries. The eraser in 0.2.0 removes every shape it hits as one transaction (`editor.js:715-723`), so no boolean path ops are needed. Remote and tutor edits keep entering through `Store.applyDiff`. Destroying a native surface never touches the Store.

The WebView board stays available behind a flag until the native board reaches parity, then the flag defaults off.

### D2. Slice-1 board renderer: Android `Canvas` on the Viro-owned Surface

The renderer draws QuickDraw records into the Surface Viro already hands out, using `Surface.lockHardwareCanvas()` on a producer-owned thread. That canvas is GPU-rendered by Android's HWUI (Skia), supports anti-aliased paths, `clipRRect`, text with system shaping, bitmaps and the blend modes `shapes.js` uses (`multiply`/`lighten` for highlight, `globalAlpha`, dashes). It needs no EGL context of our own, shares nothing with Viro's GL context, and adds no dependency.

`drawShape` in `shapes.js` maps almost call-for-call onto `android.graphics.Canvas`, so the Kotlin renderer is a port of that one function per shape type. Freehand outlines come from QuickDraw's `strokeOutline` so ink matches the web board exactly; the active stroke is recomputed per batch, settled strokes are cached as `Path` objects keyed by record id and revision.

Rejected for slice 1, with reasons:

- React Native Skia or a vendored Skia: an EGL context and window surface we would own, plus a large native dependency, to get what HWUI already gives on this Surface.
- FigCraft Rust crates (kurbo, linesweeper, harfrust/skrifa): QuickDraw already computes outlines, the eraser deletes whole shapes, and HWUI shapes text. Reuse adds an FFI with nothing to carry yet. Revisit if a later QuickDraw version adds partial erase or if Apple needs a shared outline core.
- tiny-skia: CPU raster plus upload is banned on the live path.

Ceiling: HWUI's own frame pacing decides when the Surface buffer is queued. If input-to-ink latency on Quest 3 misses budget, the upgrade is an EGL window surface with Skia Ganesh on the same Surface, behind the same `WhiteboardRenderer` spec.

### D3. Native Rive lives in ViroCore, with a Nitro JS surface in viro-external

rive-runtime (pinned commit, MIT) is built with its premake scripts for Android arm64 GLES and linked statically into `libviro_renderer.so` with hidden visibility, so it cannot collide with `rive-android` if an app also ships it. The producers (B1 scene/canvas, B2 compositor) are ViroCore C++, next to the GL state they must not disturb. The JS object model (RiveFile, artboard and state-machine selection, view-model instances and typed properties) is a set of Nitro C++ HybridObjects in `@viro-external/native-panels`, linking `libviro_renderer.so` as an imported library the way `packages/orb-pass/native/CMakeLists.txt:58-67` already does. The compositor panel host stays on Expo Modules 2.0 per PR #58.

### D4. The whiteboard is always a scene panel

It depth-tests with the scene and keeps today's lifecycle. Only Rive panels use compositor layers.

### D5. One public Surface registry in the viro fork

`CanvasSourceBridge` gets a public `CanvasSurfaces` registry in `viro_bridge` (provide, revoke, add/remove listener by surface id). The reflective call into `nitro-canvas-in-Vision` stays for existing apps. Native producers in any package subscribe to the registry instead of impersonating a Nitro class.

### D6. One alpha contract per route, stated in code

- Scene panels: producers write premultiplied alpha; `useCanvasPanel` gains `blendMode: "PremultiplyAlpha"` and the resolve copy keeps premultiplied values, building mips from them. sRGB-encoded bytes, as today.
- Compositor panels: the finish pass converts to linear premultiplied for `GL_SRGB8_ALPHA8` swapchains, per fact 18.

## Public API sketch (TypeScript first)

`@viro-external/native-panels`, Nitro, Android Kotlin for the board and C++ for Rive.

```ts
// WhiteboardRendererFactory.nitro.ts
export interface WhiteboardRendererFactory
  extends HybridObject<{ android: 'kotlin'; ios: 'swift' }> {
  /** False on platforms without a native board renderer yet. */
  readonly isAvailable: boolean
  /** Resolves once the Viro surface with `surfaceId` is attached. */
  createRenderer(options: WhiteboardRendererOptions): Promise<WhiteboardRenderer>
}

// WhiteboardRenderer.nitro.ts
export interface WhiteboardRenderer
  extends HybridObject<{ android: 'kotlin'; ios: 'swift' }> {
  readonly state: WhiteboardRendererState // 'attached' | 'active' | 'suspended' | 'lost' | 'disposed'
  /** Replaces all content. JSON of QuickDraw `Store.getSnapshot()`. */
  loadSnapshot(revision: number, snapshotJson: string): void
  /** Applies one coalesced QuickDraw diff. Stale revisions are rejected. */
  applyDiff(revision: number, diffJson: string): void
  setCamera(camera: BoardCamera): void
  setOverlay(overlayJson: string): void // selection, cursors, laser; never persisted
  addOnStateChangedListener(listener: (state: WhiteboardRendererState) => void): ListenerSubscription
  dispose(): void
}
```

Call sites:

```ts
// Happy path
const renderer = await Whiteboard.createRenderer({ surfaceId, widthPx: 2016, heightPx: 1260, cornerRadiusM: tokens.board.radius })
renderer.loadSnapshot(store.revision, JSON.stringify(store.getSnapshot()))
const off = store.listen((diff) => renderer.applyDiff(store.revision, JSON.stringify(diff)))

// Capability unavailable (iOS today): keep the WebView board
if (!Whiteboard.isAvailable) return <QuickDrawWebBoard />

// Error: surface lost or revision rejected
renderer.addOnStateChangedListener((s) => { if (s === 'lost') rebuildFromSnapshot() })
```

JSON strings are deliberate: QuickDraw records are already JSON-shaped and heterogeneous, Nitro structs convert eagerly, and a diff during a stroke carries one changed record. Ceiling: a full-snapshot reload re-parses the board; if that shows up in traces on large boards, move snapshots to an `ArrayBuffer` encoding.

## Board aspect

The board is 16:10 everywhere it ships: `boardSurfacePixels` 1008×630 (MoyoLearn `packages/ui/xr/spatial-tokens.ts:419`), the chrome artboard 1248×780 (`board-chrome-layout.ts:26`), and the Rive panel at 2496×1560 (`rive-board-panel.tsx:259`). The master prompt mentions a 5:7 board "where that is the consuming app's configuration"; no consumer uses 5:7, so the native renderer keeps 16:10 and the call site above uses 2× the board surface.

## Ownership

| Lane | Files it owns | Starts |
| --- | --- | --- |
| L0 | This ADR, `CanvasSurfaces` registry (viro), shared corner coverage header + GLSL (virocore), ABI changes | Now |
| L1 | Rust reassessment only if D2's ceiling or Apple needs it | Deferred |
| L2 | `packages/native-panels/android/**/whiteboard/**`, Nitro specs for the board | After D5 lands |
| L3 | rive-runtime build in virocore, `VRORive*` producers, Rive Nitro specs | Now (build) |
| L4 | Finish pass, coverage function use, eviction fallback, Expo Modules 2.0 host | After L0 freezes the coverage header |
| L5 | `packages/ui/src/quickdraw-headless/**`, input mapping, `QuickDrawSpatialSurface` input wiring | Now |
| L6 | `docs/design/**` | Now |

## Open decision gates

- Gate 2 (Rive tool strip as its own panel vs drawn into the board): decided after B3 is measured. Under D2 the board is not Skia-on-our-context, so B3 means drawing Rive through `rive-runtime`'s Skia renderer is not available without the D2 upgrade; the default is its own panel.
- Gate 3 (corner radius tokens): needs approval of `docs/design/system/panel-tokens.md` before Workstream C locks values.

## Gate outcomes, 2026-10-24

- Gate 3 approved: corner radii are angle-locked (0.840° board, 0.458° chrome; 0.038 m and 0.021 m at the board's 2.6 m). See `docs/design/system/panel-tokens.md`.
- The Rive tool strip moves to its own panel nearer the learner (about 1.4 m, within reach) so its keys meet the 4° target floor; the board stays at 2.6 m. This also settles gate 2 in favour of a separate Rive panel.
