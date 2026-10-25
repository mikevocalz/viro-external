# Native whiteboard

[Handbook](../README.md) · [API](../API_WHITEBOARD_RIVE_PANELS.md) · [Device validation](../DEVICE_VALIDATION.md) · [QuickDraw surface guide](../../packages/ui/doc/QuickDrawSpatialSurface.md)

The native whiteboard draws a QuickDraw board straight into a Surface that Viro owns, with Android's hardware `Canvas`. It replaces the WebView board, which renders QuickDraw as HTML and re-parents the WebView into a Viro texture. The document stays in QuickDraw's `Store` in JS; the native renderer only draws a copy of it.

It is behind the `nativeBoard` flag, off by default, and has not run on a headset yet.

## Where it runs

| Platform | Status |
| --- | --- |
| Android 10 (API 29) or later, any ABI, with a Viro build that has `CanvasSurfaces` | Native renderer available |
| Android below API 29 | Unavailable; the WebView board renders. API 29 is needed for the highlighter's `multiply` blend |
| Android with an older Viro build (no `com.viromedia.bridge.canvas.CanvasSurfaces`) | Unavailable; the WebView board renders |
| iOS, visionOS | Unavailable; no implementation. `resolveWhiteboardRendererFactory()` returns `undefined` |
| Web | Not supported |

Quest 3 and PICO 4 Ultra run Android, and both headset flavors in MoyoLearn filter to arm64-v8a. The whiteboard is Kotlin and has no ABI restriction of its own.

## Install

1. Add `@viro-external/native-panels` (workspace package) to the app.
2. Install the Nitro V1 runtime at the version the package pins. Both are optional peers, so the app's copy is the one that loads:

   ```sh
   pnpm add react-native-nitro-modules@1.0.0-alpha.nightly.100.g107f6fc66597 nitro-core@1.0.0-alpha.nightly.100.g107f6fc66597
   ```

3. Use the viro fork from branch `feat/canvas-surfaces-registry` (`@reactvision/react-viro` 3.0.3-moyo.1 or later with `CanvasSurfaces`). React Native 0.88 with the New Architecture.
4. Metro must resolve `.cjs`. The package's Nitro runtime is generated as `nitrogen/generated/shared/javascript/*.cjs` and reached through its `#nitro/*` imports map. Expo's Metro config already lists `cjs` in `resolver.sourceExts`. A bare `@react-native/metro-config` app does not, and must add it:

   ```js
   // metro.config.js (bare React Native only)
   const { getDefaultConfig, mergeConfig } = require("@react-native/metro-config");
   const defaults = getDefaultConfig(__dirname);
   module.exports = mergeConfig(defaults, {
     resolver: { sourceExts: [...defaults.resolver.sourceExts, "cjs"] },
   });
   ```

5. Rebuild the native app. Autolinking registers the Android library; iOS skips it (`react-native.config.js` declares Android only).

## Adopt

Create the board session once per document, outside React, so remounts keep the document and history:

```ts
import { createQuickDrawBoardSession } from "@viro-external/ui";

export const session = createQuickDrawBoardSession({ measureTextWidth });
```

Allocate a `canvasSource` material for the paper and keep it alive while the board shows. The surface id must not collide with ids that nitro-canvas hands out in the same process (those start small). `mountNativeRivePanel` in native-panels shows the material shape:

```ts
ViroMaterials.createMaterials({
  boardPaper: {
    diffuseTexture: {
      canvasSource: BOARD_SURFACE_ID,
      width: 2016, height: 1260,
      cornerRadius: 0.0381, panelWidth: 1.2, panelHeight: 0.75, // see rounded-panels.md
    },
    lightingModel: "Constant",
    blendMode: "PremultiplyAlpha", // the renderer writes premultiplied alpha (ADR 0001 D6)
  },
});
```

Render the board with the flag:

```tsx
import { QuickDrawNativeBoard } from "@viro-external/ui";
import { useWhiteboardRenderer } from "@viro-external/native-panels";

<QuickDrawNativeBoard
  session={session}
  nativeBoard={flags.nativeBoard}
  useRenderer={useWhiteboardRenderer}
  surface={{ surfaceId: BOARD_SURFACE_ID, materialName: "boardPaper", widthPx: 2016, heightPx: 1260 }}
  widthM={1.2}
  heightM={0.75}
  cornerRadiusM={0.0381}
  position={[0, 1.4, -2.6]}
  fallback={<QuickDrawSpatialSurface adapter={webViewAdapter} width={1.2} height={0.75} pageWidth={1008} pageHeight={630} />}
  onRendererError={report}
/>
```

`useRenderer` is passed in because native-panels depends on `@viro-external/ui`, not the other way round. Pass the same function on every render.

What the component does:

- Sends a full snapshot, then one coalesced diff per frame, with the headless board's camera and overlay (selection, laser, eraser trail).
- Routes Viro controller rays and the Muse pen through the session's input router into the headless board.
- Moves the board only by the grip below the paper; drawing never moves it.
- Shows `fallback` when the flag is off, or when the renderer reports `unavailable` or `failed`.

## Flag and rollback

| State | What renders |
| --- | --- |
| `nativeBoard` unset or `false` | `fallback` (the WebView board) |
| `nativeBoard` `true`, renderer unavailable or creation failed | `fallback` |
| `nativeBoard` `true`, renderer ready | Native paper |

Rollback is setting `nativeBoard` to `false`. The Store lives in the session, so switching between the native and WebView boards keeps every record and the undo history.

## Migrating MoyoLearn

MoyoLearn's board adapter (`packages/app/features/tutor/quickdraw-spatial-adapter.ts`) hosts `@quickdrawjs/react-native` in a WebView and declares `renderer: "esiku"`, which is not what it is. `QuickDrawSpatialSurface` now resolves the adapter's identity at mount and throws a `RangeError` when `renderer: "esiku"` sits next to a non-ESIKU identity. Drop `renderer` and declare the WebView identity:

```ts
import { WEBVIEW_QUICKDRAW_IDENTITY } from "@viro-external/xr-contract";

export const quickDrawSpatialAdapter: NativeQuickDrawSpatialAdapter = {
  identity: WEBVIEW_QUICKDRAW_IDENTITY, // host webview, backend webview-canvas2d, texture owner viro-android-view-texture
  mount,
  unmount,
};
```

That adapter becomes the `fallback`. The native board's own identity is `VIRO_NATIVE_QUICKDRAW_IDENTITY` (`packages/xr-platform-contract/src/quickdrawIdentity.ts:75-80`). Then:

1. Move the screen's input from `adapter.dispatchSurface` / `engine.injectPointer` to the session's input router; `QuickDrawSpatialSurface` and `QuickDrawNativeBoard` both use it.
2. Create the session once per board and share its `store` with tutor and remote edits, which keep entering through `store.applyDiff`.
3. Add `nativeBoard` to the app's flags, default `false`, and turn it on only on a headset build that passed [device validation](../DEVICE_VALIDATION.md) section 4.1.

## Known limits

- Not built with Gradle in an app and not run on a headset. Evidence so far is node tests, JUnit tests and a kotlinc compile ([capabilities](../CAPABILITIES.md)).
- Flat boards only: Viro's hit results carry no texture coordinate, so curved paper throws.
- Image records draw from `data:` URLs or `file://` paths only.
- Input-to-ink latency is unmeasured. ADR 0001 D2 names the upgrade path (an EGL window surface with Skia) if it misses the budget in [performance](../PERFORMANCE.md).
