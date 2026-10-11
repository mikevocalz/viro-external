# Rive in a Viro scene

[Handbook](README.md) · [Host-lifecycle example](examples/rive-session.ts) · [Native responsibilities](../packages/ui/doc/RiveNativeHost.md)

## What is available

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
