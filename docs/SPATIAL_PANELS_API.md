# Spatial Panels API — review contract (not implemented)

**Companion:** [ViroCore #111](https://github.com/mikevocalz/virocore/pull/111). The existing `SpatialPanel` on this branch is a Viro **scene mesh**, even when `curved` and `snapTo` are set. This document is a design gate for a future Expo Modules 2.0 host; it is not a claim of working compositor surfaces.

## Call-site-first contract

```tsx
// Existing API (works with Viro scene geometry; current behavior).
<SpatialWorkspaceFrame headPosition={settledHead.position} headYawDeg={settledHead.yawDeg}>
  <SpatialPanel curved snapTo="left" title="Navigation" />
  <SpatialPanel snapTo="center" title="Workspace" />
  <SpatialPanel curved snapTo="right" title="Inspector" />
</SpatialWorkspaceFrame>
```

```ts
// Proposed API only; SpatialPanelsHost is a type sketch, not a runtime import.
// 1. Happy path + resource cleanup:
import type { SpatialPanelsHost } from "../packages/ui/src/SpatialPanels.types";
declare const host: SpatialPanelsHost;
const panel = await host.createCompositorPanel({
  id: "navigation",
  widthM: 1.2, heightM: 0.8, widthPx: 1536, heightPx: 1024,
  curved: true,
  pose: { position: [-1.0, 1.4, -2.0], orientation: [0, 0, 0, 1] },
});
const eviction = panel.addOnEvictedListener((event) => {
  // Future resolver moves this panel to a real Viro scene mesh.
  onPanelEvicted(event.reason);
});
try {
  panel.setVisible(true);
  panel.setPose(nextPose);
} finally {
  eviction.remove();
  panel.dispose();
}
```

```ts
// 2. Capability unavailable: explicit, coded failure instead of silently
//    rendering a scene panel when the compositor is mandatory.
if (!host.capabilities.supportsCompositorPanels) {
  throw new Error("COMPOSITOR_UNAVAILABLE");
}
const requiredPresentation = ["compositor"] as const;
// resolver(requiredPresentation) must reject if the host lacks that backend.
```

```ts
// 3. Invalid argument: typed rejection from native, not swallowed by JS.
try {
  await host.createCompositorPanel({
    id: "bad", widthM: -1, heightM: 0.8, widthPx: 1536, heightPx: 1024,
    pose: { position: [0, 1.4, -2], orientation: [0, 0, 0, 1] },
  });
} catch (error) {
  // Expected future code: PANEL_INVALID_ARGUMENT
  reportPanelFailure(error);
}
```

These call sites are API examples, not runnable product tests. `onPanelEvicted`, `nextPose`, and `reportPanelFailure` stand for app callbacks.

## Public contract

Source sketch: `packages/ui/src/SpatialPanels.types.ts`. The type file is **not exported from @viro-external/ui** until implementation.

| Concern | Proposed shape | Guarantees |
| --- | --- | --- |
| Curvature | `curved?: boolean` | Preference; compositor cylinder when extension supported, otherwise quad/scene |
| Placement | `snapTo?: 'left' \| 'center' \| 'right'` | Workspace captures head pose once; dragging after release may snap or remain freely world-locked |
| Ranked intent | `presentation?: readonly ('compositor' \| 'scene' \| 'system-window')[]` | Omitted means `['compositor', 'scene']`; singleton forbids silent fallback |
| Resolution | `onPresentationChange(ResolvedPanelPresentation)` | Discriminated `compositor` (quad/cylinder + depth fact), `scene`, `system-window` |
| Capabilities | `SpatialPanelsHost.capabilities` | Facts from native OpenXR/OS, never optimistic JS feature flags |
| Factory | `createCompositorPanel(options): Promise<CompositorPanelHandle>` | Resolves only after a usable native backing swapchain exists |
| Lifetime | `setPose`, `setVisible`, `resize`, `dispose` | Renderer thread owns XR calls, one native handle owns teardown |
| Events | `addOnEvictedListener(cb)`, `addOnPointerListener(cb)` | Subscription owns `remove()`; loss of capture emits cancel |
| Errors | `COMPOSITOR_UNAVAILABLE`, `PANEL_INVALID_ARGUMENT`, `PANEL_DUPLICATE_ID` | Specific, observable failures; messages name missing capability or invalid value |

## Design and implementation rules

- **Expo Modules 2.0 only.** Proposed package: `packages/spatial-panels` as `@viro-external/spatial-panels`. Check the installed SDK 58 annotation implementation, real Android discovery and release startup before committing Kotlin syntax. Do not introduce Nitro or the Expo Modules 1.0 `definition()` DSL.
- The module is a native companion, not a JS-only texture adapter. Native class owns the `Surface`, `VirtualDisplay` / `Presentation`, React root and renderer-queue handoff.
- GLES texture-producer swapchains follow acquire → successful wait → draw → release. `XR_KHR_android_surface_swapchain` swapchains have a **different** lifecycle: no acquire/wait/release calls. Only `xrDestroySwapchain` applies to that kind.
- Meta SpatialWindow and PICO WindowContainer are OS-managed **shared-space** windows. Present `system-window` only in non-immersive mode until coexistence has been demonstrated on headsets; never conflate an OS window with an OpenXR layer.
- A compositor panel may render over scene geometry. Occluding panels should stay scene meshes unless runtime depth-tested composition is supported.
- Runtime layer budget is a ceiling. When an actual compositor slot is evicted, display the scene fallback and emit `onPresentationChange` so the caller knows which backend won.
- Keep scene/compositor duplicates out of the display simultaneously. Controller and hand rays must hit quad/cylinder pixel coordinates and send cancel/up when capture is lost.
- Native resources must release on unmount, JS refresh, app background, session STOPPING, or XR loss. Include memory-pressure reporting and leak assertions.

## Skills and design review

Applied disciplines: [Margelo API Design](https://github.com/margelo/react-native-skills/tree/main/skills/api-design) (types and call sites before implementation), [C++](https://github.com/margelo/react-native-skills/tree/main/skills/cpp) (swapchain ownership), [Kotlin](https://github.com/margelo/react-native-skills/tree/main/skills/kotlin) (planned module threading), and [petergyang/no-ai-slop](https://github.com/petergyang/no-ai-slop) (no fake implementation or unsupported completion claims).

**Blocking gates:** Expo 58 Modules 2.0 Android discovery + release load; verified Kotlin annotation signatures; native Android Surface extension on Quest/PICO; RN ReactHost/ReactSurface API inspection; Fabric-to-Surface frame proof; pointer injection; fallback; NDK and TypeScript checks; device evidence. Tests and screenshots are not implied by committing this proposal.

## Scope decisions for v1

- Keep `@reactvision/react-viro` fork until a tested upstream release supports the required Expo/RN versions.
- `system-window` only in shared-space/2D mode pending explicit coexistence evidence.
- GLES Android first; Metal/Vulkan are separate backends, not pretend portability.
- Quest 3 and PICO 4 Ultra: **device availability not confirmed**; do not waive hardware gates.
