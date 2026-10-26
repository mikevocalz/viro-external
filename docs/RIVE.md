# Rive in a Viro scene

[Handbook](README.md) · [Host-lifecycle example](examples/rive-session.ts) · [Native responsibilities](../packages/ui/doc/RiveNativeHost.md)

## Native Rive panel (`@viro-external/native-panels`, ADR 0001 route B1)

`@viro-external/native-panels` drives ViroCore's own Rive producer, `VRORivePanel` in `libviro_renderer.so`, from JS. Android arm64-v8a only. It is behind a flag and off by default; nothing changes for existing `ViroRivePanel` users until they opt in.

```tsx
import { ViroNativeRivePanel } from "@viro-external/native-panels";

<ViroNativeRivePanel
  nativeRive            // default false: renders ViroRivePanel unchanged
  source={{ rivBytes, artboard: "BoardChrome", stateMachine: "BoardChrome", fit: "contain" }}
  width={0.6} height={0.375} resolution={{ width: 2496, height: 1560 }}
  cornerRadius={0.021}  // meters, from docs/design/system/panel-tokens.md
  bindings={{ tool: 2, canUndo: true, status: "ready" }}
  onError={report}
/>
```

With `nativeRive` on, `source` set, and `RivePanel.isAvailable` true, the component creates a `canvasSource` material with `blendMode: "PremultiplyAlpha"` and the corner radius, then a `RiveFile` and a `RivePanel` for that surface id. Otherwise it renders `ViroRivePanel` with the same props. **Rollback: set `nativeRive` back to false** (or leave it unset).

The imperative objects are Nitro V1 C++ HybridObjects. Their shape follows `@rive-app/react-native` 0.5.5 (file, artboard and state-machine selection, a view-model instance with typed writes), cut down to what `VRORivePanel` can do today:

| Object | Members |
| --- | --- |
| `RiveFile` | `static fromBytes(ArrayBuffer)`, `static fromFileURL(fileURL)` (local `file://` or absolute path; fetch `http(s)` in JS), `byteLength` |
| `RivePanel` | `static isAvailable`, `static create(options)`, `state`, `viewModelInstance`, `setFile`, `selectArtboard`, `selectStateMachine`, `dispatchPointer(phase, xPx, yPx, pointerId)`, `setActive`, `addOnStateChangedListener((state, detail) => …)`, `dispose()` |
| `RiveViewModelInstance` | `setNumber`, `setBoolean`, `setString`, `fireTrigger`, `applyUpdate({ numbers, booleans, strings, triggers })` |

Every write is queued for the panel's render thread and returns at once; the component sends one `applyUpdate` per change of `bindings`, never per frame. A settled state machine draws nothing. Pointer input comes from the board input path: `createRivePanelPointerSink(panel, { widthPx, heightPx })` turns `QuickDrawPointerEvent` paper UVs into panel pixels, and the component's ref exposes the same as `dispatchPointer(event)`. Presses that start in a transparent corner are dropped natively, using the radii from virocore's `VROPanelCornerRadiiPx`. The producer draws square; Viro rounds the corners in the material copy.

Surface lifecycle: a small Kotlin class subscribes to viro's `CanvasSurfaces` registry for the surface id. When Viro provides the Surface, C++ creates an `ANativeWindow`, attaches it, and releases its own reference. On revoke, `surfaceLost()` returns only after the render thread has dropped the window, before Viro may release the Surface. `dispose()` ends the subscription first, then stops the render thread.

Gaps before the flag can default on:

- `init` (custom nitro-canvas adapter) and `input` (nitro-canvas input hook) are ignored on the native route; `onRuntimeReady` is not called (use `onNativePanelReady`).
- `enum` and `color` bindings: `VRORivePanel` has no writer for them. Each is reported once through `onError` and skipped.
- No view-model or artboard enumeration, no listeners on view-model properties, and no referenced (out-of-band) assets. Embedded fonts work; embedded images do not decode, because the ViroCore build has Rive's image decoders off (virocore `docs/RIVE_RUNTIME.md`).
- iOS: no implementation; `resolveNativeRive()` returns `undefined` and the component renders `ViroRivePanel`.

Verification so far: NDK 27.1 clang compiles every C++ file for arm64 with and without the renderer; the 18 `VRORivePanel` symbols the objects reference are all exported by the shipped arm64 `libviro_renderer.so`; a host test covers option validation, corner radii, the `RIVE` signature check and file reading; `RiveSurfaceLink.kt` compiles with kotlinc 2.2.21 and its JNI descriptors match the fbjni registration; 15 node tests cover the mount order, bindings diff, pointer mapping and resolver. It has not been built with Gradle or CMake, linked, or run in an app or on a headset.

## Host adapter contract

`@viro-external/ui` exports `createRiveSpatialSurface`, `disposeRiveSpatialSurface`, `ViroCoreRiveSpatialAdapter`, and the `ViroCoreRiveNativeHost` type. The factory is a controller boundary: it calls the supplied adapter's `mount`. It is not a JSX `RiveView` component and does not discover a native module automatically.

```text
Application asset and interaction policy
  → createRiveSpatialSurface(adapter, config)
  → ViroCoreRiveSpatialAdapter(nativeHost)
  → host-owned artboard, state machine, Viro node, rendering and input
```

**The native host is a required integration, not an example variable you can omit.** Obtain it from the Viro/ViroCore/native Rive implementation in the host application and verify its renderer attachment. This package does not export a universal `getNativeRiveHost()` function. Do not invent one in documentation or substitute a screenshot, WebView, GIF sequence or per-frame JS canvas.

## Native responsibilities

The host implements `mount`, `unmount`, playback/reset, state-machine input, pointer dispatch, and surface translation. It owns asset loading, artboard/state-machine selection, actual renderer output, the scene node, hit testing, transform/depth participation and resource disposal. The adapter in this repository cannot prove those capabilities from a mock object.

Before integration, record the host implementation file/module, Viro/ViroCore revision, supported renderer backend, supported source forms, actual fit modes, and a rendering/input capture from the target device. Missing evidence stays “requires native host” in the capability matrix.

## Mount and dispose

Use [rive-session.ts](examples/rive-session.ts), passing the host and a config for an actual `.riv` asset. The example checks interaction/state-machine/fit capabilities and cleans up on failed setup. It returns guarded playback/input methods plus idempotent disposal. It does not include a `.riv` asset or invent one.

```ts
// `nativeHost` comes from your verified native integration.
// `config` names a real asset/artboard/state machine from your application.
const session = openRiveSession(nativeHost, config);
// Wire normalized events from the actual host input adapter.
session.dispatchPointer(event);
// On scene teardown, selection close or replacement:
session.dispose();
```

Call mounting from an effect or equivalent owned lifecycle, not during React render. Keep the adapter/config stable across ordinary renders. On source replacement: unsubscribe input, dispose the old session, mount the new one, and reconnect input. On background/foreground: apply the host's pause/resume policy. After unmount, do not retain and invoke raw native handles. The example's guards do not replace the native host's reload-safe teardown.

## Configuration and units

| Field | Meaning |
| --- | --- |
| `source` | URL `{ kind: "url", uri }` or asset `{ kind: "asset", asset }`; the host must support the requested form |
| `artboard` / `stateMachine` | Exact names from the `.riv` file, not UI labels |
| `width` / `height` / `depth` | Physical surface dimensions in the scene's world units |
| `fit` | Requested fit; inspect `supportedFits` after mount rather than assuming parity |
| `depthMode` | Requested surface/extruded/occluding/embedded behavior; verify native depth composition |
| `interactive` | Enables interaction/drag policy; it does not create a native pointer path |
| `drag` | When supplied, include `enabled`; optional axis, activation distance, maximum displacement and follow-pointer behavior |

The native capability contract declares `nativeRenderer: true`; that is an implementation promise, not runtime proof by itself. `dataBinding`, `stateMachines`, `pointerInput`, `externalRenderTarget` and `depthComposition` are independent flags. Use only capabilities the actual host supplies. `supportedFits` absent has a defined contract meaning; a subset host must report its subset accurately.

## Pointer input versus panel movement

Rive pointer UVs are normalized 0..1 artboard coordinates. `worldPosition` is a scene-space position used by dragging. Never substitute UVs for world coordinates. Carry `phase`, input `source`, UV and timestamp from the real input adapter; send cancel/exit when capture ends or tracking is lost.

Choose **one** drag-driving path: `dispatchPointer` already interprets down/move/up/cancel/exit, or use `beginDrag`/`updateDrag`/`endDrag` explicitly in a host integration. Do not drive both paths for the same gesture. Move the scene node, not the artboard's internal animation coordinate system. Keep animation evaluation/rendering native; do not stream animation frames through React state.

## Tests and remaining proof

`pnpm test:rive-contract` exercises forwarding, activation threshold, axis lock, maximum displacement and cancellation using an injected test host. Those tests do not prove asset loading, native state-machine execution, pointer capture on a headset, fit correctness, depth/occlusion, GPU output, memory release or web parity. Capture those separately before marking the host device-verified.
