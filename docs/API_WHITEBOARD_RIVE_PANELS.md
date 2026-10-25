# Whiteboard, Rive and rounded-panel API

[Handbook](README.md) · [ADR 0001](adr/0001-native-whiteboard-rive-panels.md) · [Rive guide](RIVE.md)

This is the `api-design` output the master prompt (§3.3) asks for. It covers three public surfaces:

1. Panel corner radius
2. Rive panel content
3. The whiteboard producer handle

Each section starts with the exported TypeScript, then gives three call sites: the happy path, the capability being unavailable, and an error. Every type and function named here is exported today; each is cited by file. Nothing here has run on a headset (see [device validation](DEVICE_VALIDATION.md)).

Packages:

- `@viro-external/native-panels`: Nitro V1 HybridObjects and React bindings. Exports are listed in `packages/native-panels/src/index.ts:7-43`.
- `@viro-external/ui`: the headless board, input router, coverage port and `QuickDrawNativeBoard`. Exports are in `packages/ui/src/index.ts`.
- `@reactvision/react-viro` (viro fork, branch `feat/canvas-surfaces-registry`, commit `f5d93c23`): `useCanvasPanel` and `ViroRivePanel`.

## 1. Corner radius

### Who rounds the corners

Producers draw square content. The consumer rounds it with virocore's shared coverage function (`ViroRenderer/VROPanelCoverage.h`, virocore `d5e219c1`): the scene-panel resolve copy, the compositor finish pass and the scene fallback all call it. A radius is given once, in meters, on the material or panel that Viro composites. Producer-side pixel radii (`WhiteboardRendererOptions.cornerRadiusPx`, `VRORivePanelOptions::cornerRadiusPx`) stay 0 inside Viro, or the corners are rounded twice ([ADR 0001, "Corner ownership"](adr/0001-native-whiteboard-rive-panels.md)).

### TypeScript

```ts
// viro: components/CanvasPanel/useCanvasPanel.ts:9-47
export type CanvasPanelOpts<P extends CanvasProducer> = {
  // ...
  blendMode?: "None" | "Alpha" | "Add" | "Subtract" | "Multiply" | "Screen" | "PremultiplyAlpha";
  /** Meters. Needs panelSize when above 0. Default 0. Android only; iOS accepts and ignores it. */
  cornerRadius?: number;
  /** Quad size in meters. Required when cornerRadius > 0. */
  panelSize?: { width: number; height: number };
};
export function canvasCorners(radius: number, panelWidth?: number, panelHeight?: number): CanvasCorners;

// viro: components/ViroRivePanel.tsx:22-57
type ViroRivePanelCommonProps = {
  width: number;   // meters, also the panel size used for the radius
  height: number;
  cornerRadius?: number; // meters, default 0
  // ...
};

// native-panels: src/rive/ViroNativeRivePanelProps.ts:10-34
export type ViroNativeRivePanelProps = ViroRivePanelProps & { nativeRive?: boolean; /* ... */ };

// native-panels: src/specs/RivePanelOptions.ts:33-43
export interface RivePanelOptions {
  cornerRadiusM: number;  // used only so presses in a transparent corner miss
  panelWidthM: number;    // must be > 0 when cornerRadiusM > 0
  panelHeightM: number;
  // ...
}

// ui: src/quickdraw-input/QuickDrawNativeBoard.types.ts:81-82
export interface QuickDrawNativeBoardProps {
  /** Meters, from docs/design/system/panel-tokens.md, used for hit testing. Default 0. */
  cornerRadiusM?: number;
  // ...
}

// ui: src/quickdraw-input/panel-coverage.ts:25-95 (binary32 port of VROPanelCoverage.h)
export function panelCoverage(x: number, y: number, width: number, height: number, radiusX: number, radiusY: number): number;
export function panelCornerRadiiPx(radiusM: number, widthM: number, heightM: number, widthPx: number, heightPx: number): PanelCornerRadiiPx;
export function isInsideRoundedPanel(x: number, y: number, width: number, height: number, radii: PanelCornerRadiiPx): boolean;
```

`SpatialPanel` (`packages/ui/src/SpatialPanel.tsx:55,87`) also takes `cornerRadius` in meters, default 0.06. It builds rounded mesh geometry (`buildRoundedPanelGeometry`, `packages/ui/src/geometry.ts:41`) instead of using the coverage function, so it is not yet on the shared corner path.

### Angle-locked tokens

Gate 3 approved angle-locked radii ([panel tokens §1](design/system/panel-tokens.md)). The token is an angle; the radius in meters depends on the panel's distance `d`:

```ts
radiusM = 2 * d * Math.tan((angleDeg * Math.PI) / 180 / 2)
```

| Token | Angle | At 1.4 m | At 2.6 m |
| --- | --- | --- | --- |
| `radius.board`, `radius.toolStrip` | 0.840° | 0.0205 m | 0.0381 m |
| `radius.toolKey`, `radius.grip` | 0.458° | 0.0112 m | 0.0208 m |

The 2.6 m values are the ones `panel-tokens.md` tabulates. The 1.4 m column (the tool strip's distance in the ADR's gate outcome) is the formula applied here, not a value from that file. No package exports a helper for this conversion; compute it at placement and keep it fixed during a drag (panel-tokens rule 5).

### Call sites

Happy path: a native Rive tool strip at 1.4 m and the board at 2.6 m, same token family.

```tsx
const STRIP_RADIUS_M = 2 * 1.4 * Math.tan((0.84 * Math.PI) / 180 / 2); // about 0.0205

<ViroNativeRivePanel
  nativeRive
  source={{ rivBytes, artboard: "BoardChrome", stateMachine: "BoardChrome" }}
  width={0.6} height={0.375} resolution={{ width: 2496, height: 1560 }}
  cornerRadius={STRIP_RADIUS_M}
/>

<QuickDrawNativeBoard session={session} nativeBoard useRenderer={useWhiteboardRenderer}
  surface={surface} widthM={1.2} heightM={0.75} cornerRadiusM={0.0381} fallback={webBoard} />
```

On the native route, `mountNativeRivePanel` writes `cornerRadius`, `panelWidth` and `panelHeight` onto the `canvasSource` texture (`src/rive/mountNativeRivePanel.ts:18-33`) and passes the same radius to `RivePanel.create` for corner hit tests. `QuickDrawNativeBoard` passes `cornerRadiusPx: 0` to the renderer (`QuickDrawNativeBoard.tsx:64-65`) and uses `cornerRadiusM` for ray hits through `isInsideRoundedPanel`.

Capability unavailable: iOS, or a native producer that is not present.

```tsx
// iOS: useCanvasPanel accepts cornerRadius and does not apply it yet
// (useCanvasPanel.ts:28-35); the canvas renders square. Neither native producer
// exists there, so ViroNativeRivePanel and QuickDrawNativeBoard take their
// fallbacks. Hit tests in @viro-external/ui still apply cornerRadiusM, so a ray
// in a square-drawn corner would miss. Pass 0 where the consumer cannot round:
const radiusM = Platform.OS === "android" ? STRIP_RADIUS_M : 0;
```

Error: an invalid radius or a missing panel size.

```ts
try {
  canvasCorners(0.02); // no panelSize
} catch (error) {
  // "cornerRadius needs panelSize with a positive width and height in meters"
  // (useCanvasPanel.ts:195-205). Thrown before any native resource exists.
}

// RivePanel.create rejects on the same conditions (RivePanelConfig.cpp:43,77):
//   "RivePanel cornerRadiusM must be a finite number of meters >= 0, got -1"
//   "RivePanel cornerRadiusM needs a positive panelWidthM ..."
// ViroNativeRivePanel routes the rejection to onError and keeps the material
// until unmount (mountNativeRivePanel.ts:69-71).
```

## 2. Rive panel content

### TypeScript

Nitro V1 C++ HybridObjects, Android only (`@Android({ language: "c++" })`). The shape follows `@rive-app/react-native` 0.5.5, cut to what `VRORivePanel` supports.

```ts
// src/specs/RiveFile.nitro.ts:23-40
export declare class RiveFile extends HybridObject {
  static fromBytes(bytes: ArrayBuffer): Promise<RiveFile>;   // rejects: empty, > 64 MiB, no RIVE signature
  static fromFileURL(fileURL: string): Promise<RiveFile>;    // file:// or absolute path only
  readonly byteLength: number;
}

// src/specs/RivePanel.nitro.ts:31-83
export declare class RivePanel extends HybridObject {
  static readonly isAvailable: boolean;                      // arm64-v8a + ViroCore built with Rive
  static create(options: RivePanelOptions): Promise<RivePanel>;
  readonly state: RivePanelState;                            // src/specs/RivePanelState.ts:19-25
  readonly viewModelInstance: RiveViewModelInstance;
  setFile(file: RiveFile): void;
  selectArtboard(name: string): void;
  selectStateMachine(name: string): void;
  dispatchPointer(phase: RivePointerPhase, xPx: number, yPx: number, pointerId: number): void;
  setActive(active: boolean): void;
  addOnStateChangedListener(listener: (state: RivePanelState, detail: string) => void): ListenerSubscription;
  // dispose() inherited from HybridObject
}

// src/specs/RiveViewModelInstance.nitro.ts:25-40
export declare class RiveViewModelInstance extends HybridObject {
  setNumber(path: string, value: number): void;
  setBoolean(path: string, value: boolean): void;
  setString(path: string, value: string): void;
  fireTrigger(path: string): void;
  applyUpdate(update: RiveViewModelUpdate): void;            // src/specs/RiveViewModelUpdate.ts:7-16
}

// src/rive/resolveNativeRive.ts:26-32
export function resolveNativeRive(): NativeRiveRuntime | undefined;

// src/rive/ViroNativeRivePanel.tsx:32-45, props in src/rive/ViroNativeRivePanelProps.ts:10-34
export const ViroNativeRivePanel = React.forwardRef<
  ViroRivePanelHandle | NativeRivePanelHandle,
  ViroNativeRivePanelProps
>(/* ... */);

// src/rive/createRivePanelPointerSink.ts:11-19
export function createRivePanelPointerSink(
  panel: Pick<RivePanel, "dispatchPointer">,
  size: { readonly widthPx: number; readonly heightPx: number },
): (event: RivePanelPointerEvent) => void;
```

`RivePanelState` is `"initializing" | "waiting-for-surface" | "active" | "suspended" | "lost" | "disposed"`. A path that does not exist on the view model is reported through the state listener's `detail`, not thrown, because the lookup runs on the render thread (`RiveViewModelInstance.nitro.ts:14-16`).

### Call sites

Happy path, component: `ViroNativeRivePanel` with the flag on.

```tsx
const ref = useRef<ViroRivePanelHandle | NativeRivePanelHandle>(null);

<ViroNativeRivePanel
  ref={ref}
  nativeRive={flags.nativeRive}
  source={{ rivBytes, artboard: "BoardChrome", stateMachine: "BoardChrome", fit: "contain" }}
  width={0.6} height={0.375} resolution={{ width: 2496, height: 1560 }}
  cornerRadius={STRIP_RADIUS_M}
  maxFrameRateHz={72}
  bindings={{ tool: 2, canUndo: true, status: "ready" }}
  onNativeStateChange={(state, detail) => log("rive", state, detail)}
  onError={report}
/>

// Pointer input from the board input router (paper UVs -> panel pixels):
const handle = ref.current;
if (handle !== null && "native" in handle) handle.dispatchPointer(event);
```

The component sends one `applyUpdate` per change of `bindings` (`ViroNativeRivePanel.tsx:80-94,155-157`) and calls `setActive(false)` when the app leaves the foreground (`:101-114`).

Happy path, imperative: the HybridObjects without the component.

```ts
const rive = resolveNativeRive();
if (rive !== undefined) {
  const file = await rive.RiveFile.fromBytes(rivBytes);
  const panel = await rive.RivePanel.create({
    surfaceId, widthPx: 2496, heightPx: 1560, file,
    artboardName: "BoardChrome", stateMachineName: "BoardChrome",
    fit: "contain", alignmentX: 0, alignmentY: 0,
    cornerRadiusM: STRIP_RADIUS_M, panelWidthM: 0.6, panelHeightM: 0.375,
    maxFrameRateHz: 72,
  });
  file.dispose(); // the panel copied the bytes
  panel.viewModelInstance.applyUpdate({ numbers: { tool: 2 }, booleans: { canUndo: true } });
  // ... later
  panel.dispose();
}
```

The `canvasSource` material for `surfaceId` must exist first, with `blendMode: "PremultiplyAlpha"`; `mountNativeRivePanel` (`src/rive/mountNativeRivePanel.ts:12-86`) does both in the right order and is what the component uses.

Capability unavailable: iOS, x86/x86_64, armeabi-v7a, or a ViroCore build without Rive.

```tsx
// ViroNativeRivePanel needs no branch: with nativeRive on and resolveNativeRive()
// returning undefined it renders ViroRivePanel with the same props
// (ViroNativeRivePanel.tsx:37-44). For imperative use, check explicitly:
const rive = resolveNativeRive();
if (rive === undefined) {
  return <ViroRivePanel source={source} width={0.6} height={0.375} cornerRadius={STRIP_RADIUS_M} />;
}
```

`resolveNativeRive()` returns `undefined` when either class is not registered (iOS) or `RivePanel.isAvailable` is false (`resolveNativeRive.ts:26-32`). On ABIs without `libviro_renderer.so`, the package builds with `isAvailable` false (commit `6a2906d`).

Error: bad file, unknown artboard, lost GPU context.

```tsx
<ViroNativeRivePanel
  nativeRive
  source={{ rivBytes, artboard: "BoardChrom" /* typo */ }}
  width={0.6} height={0.375}
  onError={(error) => {
    // RiveFile.fromBytes / RivePanel.create rejections land here, e.g.
    // "RiveFile does not start with the RIVE signature; is this a .riv file?"
    // Enum and color bindings are reported here once each and skipped.
    report(error);
  }}
  onNativeStateChange={(state, detail) => {
    // Unknown artboard or property path: state unchanged, detail carries the message.
    // "lost": EGL or Rive failed; the next Surface Viro provides retries from scratch.
    if (state === "lost") metrics.count("rive.lost");
  }}
/>
```

Calling any method after `dispose()` throws (`RivePanel.nitro.ts:20-23`). `dispatchPointer` throws for non-finite coordinates or a non-integer `pointerId`; the component's handle catches that and reports it through `onError` (`ViroNativeRivePanel.tsx:180-187`).

## 3. Whiteboard producer handle

### TypeScript

`WhiteboardRendererFactory` and `WhiteboardRenderer` are Nitro V1 Kotlin HybridObjects, Android only. The React layer is a hook plus a store-to-renderer binding.

```ts
// src/specs/WhiteboardRendererFactory.nitro.ts:19-39
export declare class WhiteboardRendererFactory extends HybridObject {
  static readonly isAvailable: boolean;   // API 29+ and a Viro build with CanvasSurfaces
  static createRenderer(options: WhiteboardRendererOptions): Promise<WhiteboardRenderer>;
}

// src/specs/WhiteboardRenderer.nitro.ts:40-84
export declare class WhiteboardRenderer extends HybridObject {
  readonly state: WhiteboardRendererState;              // src/specs/WhiteboardRendererState.ts:19-25
  loadSnapshot(revision: number, snapshotJson: string): void;
  applyDiff(revision: number, diffJson: string): void;
  setCamera(camera: BoardCamera): void;                 // src/specs/BoardCamera.ts:9-16
  setOverlay(overlayJson: string): void;
  addOnStateChangedListener(listener: (state: WhiteboardRendererState) => void): ListenerSubscription;
  // dispose() inherited
}

// src/specs/WhiteboardRendererOptions.ts:9-37
export interface WhiteboardRendererOptions {
  surfaceId: number;
  widthPx: number;
  heightPx: number;
  pixelRatio: number;       // surface pixels per board unit
  cornerRadiusPx: number;   // 0 inside Viro; corners come from the consumer
  backgroundColor: string;  // "#RRGGBB" or "#RRGGBBAA", sRGB
}

// src/whiteboard/resolveWhiteboardRendererFactory.ts:20-24
export function resolveWhiteboardRendererFactory(): typeof WhiteboardRendererFactory | undefined;

// src/whiteboard/useWhiteboardRenderer.ts:34-98
export function useWhiteboardRenderer(options: UseWhiteboardRendererOptions): WhiteboardRendererStatus;

// src/whiteboard/WhiteboardRendererStatus.ts:13-17
export type WhiteboardRendererStatus =
  | { kind: "unavailable" }
  | { kind: "creating" }
  | { kind: "ready"; renderer: WhiteboardRenderer; state: WhiteboardRendererState }
  | { kind: "failed"; error: Error };

// src/whiteboard/createWhiteboardRendererBinding.ts:27-170
export function createWhiteboardRendererBinding(options: WhiteboardRendererBindingOptions): WhiteboardRendererBinding;

// ui: src/quickdraw-input/QuickDrawNativeBoard.tsx:30-37
export function QuickDrawNativeBoard(props: QuickDrawNativeBoardProps): React.ReactElement;
```

Revisions must increase. A stale revision or malformed JSON throws and the renderer keeps its current document (`WhiteboardRenderer.nitro.ts:44-62`). The binding answers any rejection, or a `lost` state, with a full snapshot on the next frame, and does not spin if the snapshot is rejected too (`createWhiteboardRendererBinding.ts:22-25,55-69`).

### Call sites

Happy path: `QuickDrawNativeBoard`, which owns the hook and the input path.

```tsx
// Once per document, outside React.
const session = createQuickDrawBoardSession({ measureTextWidth });

<QuickDrawNativeBoard
  session={session}
  nativeBoard={flags.nativeBoard}
  useRenderer={useWhiteboardRenderer}
  surface={{ surfaceId, materialName, widthPx: 2016, heightPx: 1260 }}
  widthM={1.2} heightM={0.75} cornerRadiusM={0.0381}
  position={[0, 1.4, -2.6]}
  fallback={webViewBoard}
  onRendererError={report}
/>
```

The host allocates the `canvasSource` material and keeps it alive while the board shows ([QuickDraw surface guide](../packages/ui/doc/QuickDrawSpatialSurface.md)). For a custom scene, call the hook directly:

```tsx
const status = useWhiteboardRenderer({
  store: session.store, board: session.board, surfaceId,
  widthPx: 2016, heightPx: 1260, pixelRatio: 2, cornerRadiusPx: 0, backgroundColor: "#FFFFFF",
  onError: report,
});
```

Capability unavailable: iOS, Android below API 29, or a Viro build without `CanvasSurfaces`.

```tsx
// QuickDrawNativeBoard renders `fallback` for "unavailable" and "failed"
// (QuickDrawNativeBoard.tsx:70). With the hook directly:
if (status.kind === "unavailable") return webViewBoard;

// Imperative check:
const factory = resolveWhiteboardRendererFactory();
if (factory === undefined) return webViewBoard;
```

`createRenderer` rejects with the reason when `isAvailable` is false, for example "the native whiteboard renderer needs Android 10 (API 29) or later; this device runs API 28" (`WhiteboardRendererAvailability.kt:17-20`).

Error: creation rejected, a call rejected, or the Surface lost.

```tsx
const status = useWhiteboardRenderer({ ...options, onError: report });

if (status.kind === "failed") {
  report(status.error);          // createRenderer rejected (invalid options, unavailable)
  return webViewBoard;
}
if (status.kind === "ready" && status.state === "lost") {
  // Drawing into the Surface failed. The renderer keeps its document and
  // redraws on the next Surface; the binding already queued a snapshot resync.
}

// onError receives rejected calls: stale revision, malformed payload, a failed resync.
```

By the time the binding calls `onError`, it has already scheduled the resync.

## Not covered

- Rive B2 (compositor layers): the Java API exists in the viro renderer (`com.viro.core.RiveCompositorPanel`, viro `f5d93c23`) and the Expo Modules 2.0 host lives in `packages/spatial-panels`, which is not part of this document.
- Rive enum and color writes, view-model enumeration, property listeners and out-of-band assets: not in `VRORivePanel` yet ([Rive guide](RIVE.md)).
- An exported helper for angle-locked radii: none exists; the formula above is the contract.
