# QuickDraw on a Viro board

Two components show a QuickDraw board in a Viro scene. Both send scene input through the same input path.

- `QuickDrawNativeBoard` draws the paper with the native renderer from `@viro-external/native-panels` (ADR 0001 D2). It sits behind `nativeBoard`, which is off until the native board reaches device parity with the WebView board.
- `QuickDrawSpatialSurface` shows a board that an adapter draws and dispatches input to the adapter.

## Who does what

These are separate roles. Each adapter states all of them in `QuickDrawSurfaceIdentity` (`@viro-external/xr-contract`).

| Role | Field | Values |
| --- | --- | --- |
| Editor authority: records, transactions, undo, remote diffs | `editorAuthority` | `quickdraw-store` only. Every host draws a derived copy |
| Host: the process that runs the drawing code | `host` | `esiku`, `viro-native`, `webview` |
| Drawing backend: what rasterizes | `backend` | `esiku`, `android-hwui-canvas`, `webview-canvas2d` |
| Texture owner: who allocates the texture Viro samples | `textureOwner` | `esiku`, `viro-canvas-surface`, `viro-android-view-texture` |

Presets: `VIRO_NATIVE_QUICKDRAW_IDENTITY` (native-panels on Android), `WEBVIEW_QUICKDRAW_IDENTITY` (QuickDraw's HTML board in `react-native-webview`, re-parented into `AndroidViewTexture`), `ESIKU_QUICKDRAW_IDENTITY`.

### Migrating from `renderer: "esiku"`

`renderer` is deprecated and still accepted. On its own it resolves to `ESIKU_QUICKDRAW_IDENTITY`, so existing ESIKU adapters keep working. `resolveQuickDrawSurfaceIdentity` throws a `RangeError` when `renderer: "esiku"` sits next to an identity whose host, backend or texture owner is not ESIKU. `QuickDrawSpatialSurface` calls it at mount.

An adapter that is not ESIKU-hosted must drop `renderer` and declare its identity. MoyoLearn's adapter hosts the board in a WebView, so it should declare:

```ts
import { WEBVIEW_QUICKDRAW_IDENTITY } from "@viro-external/xr-contract";

export const quickDrawSpatialAdapter: NativeQuickDrawSpatialAdapter = {
  identity: WEBVIEW_QUICKDRAW_IDENTITY,
  mount, unmount,
};
```

## The input path

```
ViroQuad onClickState / onDrag / onHover        MusePenInput samples
          (world metres)                          (world metres)
                    \                              /
                  BoardInputRouter (one per board session)
   world -> quad-local (inverse world matrix) -> quad UV (the one Y flip)
   -> paper UV (letterbox removed) -> rounded-corner hit test
                              |
                    QuickDrawPointerEvent
               /              |                \
   headless board sink   adapter sink      QuickdrawSpatialPanel.onPointer
   (board units)         (dispatchPointerEvent  (deprecated shape)
                          or dispatchPointer)
```

Facts the mapping relies on, read from source:

- ViroCore reports hit positions in world space: `VRONode::hitTest` intersects in world coordinates, and `VROInputControllerBase` forwards `hit->getLocation()`. The paper quad sets `highAccuracyEvents` so the hit is on the triangle, not on the bounding box.
- `onDrag` with `dragType="FixedToPlane"` on the quad's own plane reports `nodeOrigin + (planeHit - planeHitAtDragStart)` (`getDragPositionFixedToPlane`). `planeHitFromDrag` recovers the live hit from the press. ViroCore samples the start hit on the first drag frame, not at the press, so moves are offset by however far the ray travelled in between, about one frame of hand motion. No live ray reaches JS on this path.
- `dragTransform="none"` makes Viro compute the drag and move nothing, so drawing never repositions the board. With `highAccuracyEvents` it also emits a drag sample on every frame with motion (`VROShouldEmitDragSample`).
- Viro sends `ClickUp` to the node that took `ClickDown`, with an empty position once the ray has left it. The stroke ends at its last point.
- Eye gaze (source 12) is ignored. Viro does not report a device class, so every other ray source is a `controller` unless `classifyViroSource` says otherwise.

Units: board units are QuickDraw view units, the space `BoardPointerSample` uses before the camera. Zoom and pan are the board's camera and stay out of the mapping. Timestamps are milliseconds on `performance.now()`. Viro events carry none, so the router stamps them when JS receives them.

Flat boards only. `VROHitTestResult` carries a node, a world location and a distance, and no texture coordinate, so a curved board's UV cannot be recovered from an event. `assertFlatBoard` and `useBoardPaperInput` throw for any non-zero curvature.

### Capture, cancel and arbitration

- Each device has its own capture. `cancelViroSource`, `cancelPen` and a pen sample with `tracked: false` end one device's stroke and leave the others running. A cancel never touches remote or tutor edits, which enter through `store.applyDiff`.
- A captured stroke that leaves the paper clamps to the edge. It does not end and restart.
- `cancelAll` runs on app background (`AppState` not `active`), unmount, `interactive={false}`, a new surface or pose, a grip drag starting, and a change of `inputResetKey`. Pass a new `inputResetKey` on tracking loss, focus loss or a change of board owner.
- The board moves by a grip below the paper. A grip drag cancels every stroke first and blocks input until release.
- Rays inside a transparent corner miss. The corner test is a binary32 port of virocore's `VROPanelCoverage.h`, with a hit at coverage >= 0.5, the rule `VRORiveRoundedRectContains` uses.

### Pressure

`QuickDrawPointerEvent.pressure` is `undefined` when the device reports none, and `0` is a real reading. Viro triggers report no pressure. The Muse pen's reading passes through when it is finite and within `[0, 1]`, otherwise it is `undefined`. The deprecated `QuickdrawSpatialPointer` requires a number and carries QuickDraw's no-reading value `0.5` in that case.

## Deprecated input types

| Old | Replacement |
| --- | --- |
| `QuickDrawSpatialPointer`, `QuickDrawPointerPhase` (contract) | `QuickDrawPointerEvent`, `QuickDrawPointerEventPhase`. `toQuickDrawSpatialPointer` converts |
| `QuickdrawSpatialPointer` (ui) | `QuickDrawPointerEvent`. `toLegacyQuickdrawSpatialPointer` converts |
| `QuickdrawSpatialPanel.onPointer` without a router | Pass `inputRouter={session.input}`. `onPointer` fires only then |
| `handle.dispatchPointer` | `handle.dispatchPointerEvent`, preferred when present because it carries `pointerId` |
| `MusePenSample.timestamp` (`Date.now()`) | `MusePenSample.timestampMs` (`performance.now()`) |

## Native board

```tsx
// Once per document, outside React.
const session = createQuickDrawBoardSession({ measureTextWidth })

<QuickDrawNativeBoard
  session={session}
  nativeBoard={flags.nativeBoard}
  useRenderer={useWhiteboardRenderer}
  surface={{ surfaceId, materialName, widthPx: 2016, heightPx: 1260 }}
  widthM={1.2}
  heightM={0.75}
  cornerRadiusM={0.0381}
  position={[0, 1.4, -2.6]}
  fallback={<QuickDrawSpatialSurface adapter={webViewAdapter} width={1.2} height={0.75} pageWidth={1008} pageHeight={630} />}
/>
```

- `useRenderer` is injected because `@viro-external/native-panels` depends on this package. `useWhiteboardRenderer` fits `UseBoardRenderer`.
- The host allocates the `canvasSource` material (nitro-canvas `createCanvasSurface` plus `canvasSource`, as viro's `components/CanvasPanel/useCanvasPanel.ts` does) and owns its lifetime. The renderer gets `cornerRadiusPx: 0` because corners come from the shared coverage function at the consumer.
- The fallback renders while `nativeBoard` is off and when the renderer reports `unavailable` (iOS, Android below API 29, a Viro build without the Surface registry) or `failed`.
- The session owns the Store, the headless board and the router. Remounting, resizing or replacing the surface keeps the document and history. `session.dispose()` cancels input and disposes the board. The Store stays as it is.

## What is not verified

Everything above is checked by node tests and `tsc` only. Nothing has run in a Viro scene or on a headset. Open device checks:

- the drag-report offset from the first drag frame, measured as ink displacement at stroke start
- the Muse pen's position frame on visionOS (assumed to be Viro world metres)
- input-to-ink latency with the native renderer
- corner hits at the board's real distance
