# Native Rive panels

[Handbook](../README.md) · [Rive reference](../RIVE.md) · [API](../API_WHITEBOARD_RIVE_PANELS.md) · [Device validation](../DEVICE_VALIDATION.md)

`ViroNativeRivePanel` draws a `.riv` state machine with ViroCore's own Rive renderer (`VRORivePanel`, linked into `libviro_renderer.so`) instead of the `rive-android` runtime that `ViroRivePanel` drives through nitro-canvas-in-Vision. It takes every `ViroRivePanel` prop, so switching is a flag on the same element.

It is behind the `nativeRive` flag, off by default, and has not run on a headset yet.

## Where it runs

| Platform | Status |
| --- | --- |
| Android arm64-v8a, ViroCore renderer built with Rive, Viro build with `CanvasSurfaces` | Native route available |
| Android armeabi-v7a, x86, x86_64 | Unavailable; `RivePanel.isAvailable` is false and `ViroRivePanel` renders |
| iOS, visionOS | Unavailable; no implementation. `resolveNativeRive()` returns `undefined` and `ViroRivePanel` renders |
| Web | Not supported |

The renderer AAR in the viro fork from commit `e41d43b8` onward (virocore `d5e219c1`) exports the `VRORivePanel` API. Quest 3 and PICO 4 Ultra builds in MoyoLearn filter to arm64-v8a, so both headset flavors get the native route when the flag is on.

## Install

Same as the [native whiteboard](native-whiteboard.md#install): add `@viro-external/native-panels`, install `react-native-nitro-modules` and `nitro-core` at `1.0.0-alpha.nightly.100.g107f6fc66597`, use the viro fork from `feat/canvas-surfaces-registry`, and make sure Metro resolves `.cjs` (Expo does by default; bare `@react-native/metro-config` needs `cjs` added to `resolver.sourceExts`).

The Android build of native-panels links `libviro_renderer.so` as an imported library. It extracts the `.so` per ABI from the app's `@reactvision/react-viro` renderer AAR, or takes `-PviroRendererLibDir=<dir with one folder per ABI>`. It does not package the `.so`; the app already ships it through Viro.

Rive's C++ runtime is linked into ViroCore with hidden visibility, so an app can also ship `@rive-app/react-native` without symbol clashes (virocore `docs/RIVE_RUNTIME.md`, "Symbol visibility"). That has not been tested in an app yet ([device validation](../DEVICE_VALIDATION.md) R10).

## Adopt

Replace `ViroRivePanel` with `ViroNativeRivePanel` and add the flag:

```tsx
import { ViroNativeRivePanel, type NativeRivePanelHandle } from "@viro-external/native-panels";
import type { ViroRivePanelHandle } from "@reactvision/react-viro";

const ref = useRef<ViroRivePanelHandle | NativeRivePanelHandle>(null);

<ViroNativeRivePanel
  ref={ref}
  nativeRive={flags.nativeRive}
  source={{ rivBytes, artboard: "BoardChrome", stateMachine: "BoardChrome", fit: "contain" }}
  width={0.6}
  height={0.375}
  resolution={{ width: 2496, height: 1560 }}
  cornerRadius={0.0205}            // meters; see rounded-panels.md
  maxFrameRateHz={72}              // match the headset's display rate
  bindings={{ tool: 2, canUndo: true, status: "ready" }}
  onNativeStateChange={(state, detail) => log("rive", state, detail)}
  onError={report}
/>
```

On the native route the component:

- creates a `canvasSource` material with `blendMode: "PremultiplyAlpha"` and the corner radius, because `VRORivePanel` writes premultiplied alpha and square corners;
- loads the file and creates the panel asynchronously, then sends `bindings` as one `applyUpdate` per change, never per frame;
- stops frames when the app leaves the foreground or `autoTick` is `false`;
- draws nothing while the state machine is settled.

Pointer input comes from the board input router. The ref on the native route exposes `dispatchPointer(event)`, which takes the router's `QuickDrawPointerEvent` (paper UVs) and converts it to panel pixels:

```ts
const handle = ref.current;
if (handle !== null && "native" in handle) handle.dispatchPointer(event);
```

Presses that start in a transparent rounded corner are dropped natively.

## Flag and rollback

| State | What renders |
| --- | --- |
| `nativeRive` unset or `false` | `ViroRivePanel` with the same props |
| `nativeRive` `true`, no `source` (an `init` adapter instead) | `ViroRivePanel` |
| `nativeRive` `true`, `resolveNativeRive()` returns `undefined` | `ViroRivePanel` |
| `nativeRive` `true`, `source` set, native route available | `VRORivePanel` |

Rollback is setting `nativeRive` to `false`.

## Gaps on the native route

These keep the flag off by default:

- `init` (a custom nitro-canvas adapter) and `input` (the nitro-canvas input hook) are not used. Send pointer input through the ref's `dispatchPointer`.
- `onRuntimeReady` is not called; use `onNativePanelReady`.
- `enum` and `color` bindings have no native writer yet. Each is reported once through `onError` and skipped.
- No view-model or artboard enumeration, no property listeners, no out-of-band assets.
- Embedded images do not decode: ViroCore builds rive-runtime with `--no-rive-decoders`. The three `.riv` files MoyoLearn ships have no image assets (virocore `docs/RIVE_RUNTIME.md`, "Modules").

## Migrating MoyoLearn

MoyoLearn's `RiveBoardPanel` renders `ViroRivePanel` with `moyo_board_chrome.riv` and the `BoardChrome` artboard and state machine. Its view-model inputs are numbers, booleans and one string (`packages/ui/xr/board-chrome-bind.ts:48-88`), all of which the native route writes.

1. Swap `ViroRivePanel` for `ViroNativeRivePanel`; keep every prop.
2. Add `nativeRive` to the app's flags, default `false`.
3. Route the tool strip's pointer input through the board input router and the ref's `dispatchPointer`, since `input` is ignored on the native route.
4. Set `cornerRadius` from the angle-locked token at the strip's distance ([rounded panels](rounded-panels.md)).
5. Turn the flag on only for a headset build that passed [device validation](../DEVICE_VALIDATION.md) section 4.2.

## Known limits

- Not built with Gradle or CMake in an app, not linked, not run on a headset. Evidence so far: NDK clang compiles, the 18 referenced `VRORivePanel` symbols resolve against the shipped arm64 `.so`, a host C++ test, a kotlinc compile and 15 node tests ([capabilities](../CAPABILITIES.md)).
- Compositor-layer Rive panels (route B2) are a separate feature with their own host; this guide covers the scene panel only.
