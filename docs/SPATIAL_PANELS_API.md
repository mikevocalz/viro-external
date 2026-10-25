# Spatial Panels API

**Companions:** [ViroCore #111](https://github.com/mikevocalz/virocore/pull/111) (compositor engine) and virocore `feat/compositor-panel-jni` (Java API). The `SpatialPanel` component in `@viro-external/ui` is a Viro **scene mesh**, even when `curved` and `snapTo` are set. Compositor panels live in `@viro-external/spatial-panels`.

## What exists

`@viro-external/spatial-panels` is an Expo Modules API 2.0 module (`ViroSpatialPanels`) with one shared object class (`CompositorPanel`). It shows **Rive content only**: the Rive finish pass is the only compositor producer in virocore. React Native roots, Android Surface swapchains and OS windows are not implemented.

```tsx
import { CompositorPanelFallback, spatialPanels, SpatialPanelsError } from "@viro-external/spatial-panels";

// 1. Happy path and cleanup.
const capabilities = await spatialPanels.getCapabilities();
const panel = await spatialPanels.createCompositorPanel({
  id: "board-tools",
  pose: { position: [0, 1.2, -1.4], orientation: [0, 0, 0, 1] },
  widthM: 0.6, heightM: 0.375, widthPx: 1248, heightPx: 780,
  cornerRadiusM: tokens.chrome.radiusM,
  content: { kind: "rive", file: rivBytes, artboard: "BoardChrome", stateMachine: "BoardChrome" },
});
panel.setNumber("tool", 2);
// Inside the Viro scene, at the root, so the pose is world space:
<CompositorPanelFallback panel={panel} />;
// On unmount:
panel.dispose();

// 2. Capability unavailable (iOS, visionOS, no OpenXR view): explicit failure.
if (!spatialPanels.isAvailable || !capabilities.supportsRive) renderRiveSceneFallback();

// 3. Invalid argument: typed rejection.
try {
  await spatialPanels.createCompositorPanel({ ...options, widthPx: 8 });
} catch (error) {
  if (error instanceof SpatialPanelsError && error.code === "PANEL_INVALID_ARGUMENT") report(error.message);
}
```

`tokens`, `rivBytes`, `renderRiveSceneFallback`, `options` and `report` stand for app code.

## Public contract

| Concern | Shape | Guarantees |
| --- | --- | --- |
| Factory | `createCompositorPanel(options): Promise<CompositorPanelHandle>` | Resolves after the layer is registered on the XR render thread and the .riv is queued |
| Shape | `shape?: "quad" \| "cylinder"` | A requirement: `cylinder` rejects with `CYLINDER_UNAVAILABLE` when the runtime lacks it, never degrades silently |
| Ranked intent | `presentation?: readonly ("compositor" \| "scene")[]` | Default `["compositor", "scene"]`. `["compositor"]` forbids the scene fallback |
| Corners | `cornerRadiusM` | Applied by the finish pass and by the fallback texture through the same coverage function |
| Presentation | `addOnPresentationChangeListener`, `getPresentation()` | `pending`, `compositor`, `evicted` with reason `layer-budget` or `layer-limit-exceeded`. An evicted panel returns to `compositor` by itself; the handle stays usable |
| Scene fallback | `CompositorPanelFallback` | Shown while `evicted` and the fallback texture is bound; hidden on `compositor` |
| Rive | `setNumber`, `setBoolean`, `setString`, `fireTrigger`, `dispatchPointer`, `setActive`, `addOnStatusChangeListener` | Queued to the Rive worker; a press in a transparent corner is dropped |
| Lifetime | `setPose`, `setVisible`, `dispose` | Pose and visibility move both the layer and the fallback mesh. `dispose` is idempotent and deletes the fallback material |
| Errors | `SpatialPanelsError.code` | `COMPOSITOR_UNAVAILABLE`, `CYLINDER_UNAVAILABLE`, `PANEL_INVALID_ARGUMENT`, `PANEL_DUPLICATE_ID`, `PANEL_LAYER_BUDGET_EXCEEDED`, `PANEL_SWAPCHAIN_FAILED`, `PANEL_INVALID_RIVE_FILE` |

Differences from the PR #58 sketch (`packages/ui/src/SpatialPanels.types.ts`, still a sketch):

- Options carry `content: { kind: "rive", ... }`; there is no producer for other content.
- No `resize`: the compositor cannot resize a swapchain in place. Dispose and create.
- No `addOnPointerListener`: native code does not ray-cast compositor layers. Callers map their own hits to panel pixels and call `dispatchPointer`.
- Eviction does not end the handle, and the reasons are the two the engine reports. `session-stopped` is not produced (see gaps).
- `capabilities` is a promise (`getCapabilities()`), because the facts come from the session on the render thread. There is no `supportsDepthTestedPanels` or `supportsSystemWindows`: neither exists.

## How the fallback reaches a Viro material

No Viro API registers a native texture under a material name (`ViroMaterials.ts` and `MaterialManager.java` on `feat/canvas-surfaces-registry` have none; `CanvasSurfaces` hands out Surfaces, not textures). The package uses public API only:

1. JS registers `viro-external.spatial-panels.<id>.fallback` with `ViroMaterials.createMaterials`: `PremultiplyAlpha`, `Constant` lighting, white diffuse colour, no depth writes, no culling.
2. JS calls `CompositorPanel.bindFallbackMaterial(name)`.
3. On the main thread, when the renderer first evicts the panel and hands Java the fallback `Texture`, Kotlin calls `MaterialManager.getMaterial(name).setDiffuseTexture(texture)` and `VRTNode.refreshNodesUsingMaterial(name)`, then emits `presentationChange` with `hasFallback: true`.

The material registration (a React Native bridge call) and the bind (an Expo v2 call posted to the main thread) do not share a queue. If the bind runs first it finds no material; the next eviction retries, and JS asks again when it sees `evicted` without `hasFallback`.

## Threads

| Work | Thread |
| --- | --- |
| Layer add, pose, visibility, remove, capabilities, fallback texture | XR render thread (posted; waits while the render loop is paused) |
| Rive file, view-model writes, pointers, `setActive` | Rive worker (queued from any thread) |
| Native callbacks, fallback binding, `MaterialManager` and `VRTNode` access | Android main thread |
| `@JS` members | JS thread; they read volatile snapshots and post the rest |

## Rules

- **Expo Modules API 2.0 only** (`@ExpoModule`, `@ExpoSharedObject`, `@JS`, `@Event`, `@Record` from `io.github.expo.modules.v2`, `expoModule { v2 true }`). No Nitro and no `definition()` DSL. API source read: `expo-modules-core` 58.0.26 (`android/src/main/java/expo/modules/v2/ExpoModulesV2Host.kt`, `android/build.gradle` pinning `expo-modules-v2-react` 0.2.5, `expo-module-gradle-plugin/.../ExpoModuleExtension.kt` `v2`) and the `expo-modules-v2-react` 0.2.5 sources jar from Maven Central (`ExpoModule.kt`, `ExpoSharedObject.kt`, `JS.kt`, `Event.kt`, `SharedObject.kt`, `async/Promise.kt`, `JavaScriptThrowable.kt`). Layout mirrors `expo-crypto` 58.0.7's v2 `CryptoModule`.
- A compositor panel renders over scene geometry. Panels that must be occluded stay scene meshes.
- Keep the scene and compositor copies off screen at the same time: the fallback is hidden whenever the presentation is not `evicted`.
- iOS and visionOS: unavailable. The compositor is GLES-only in v1.

## Gaps

- Never built with Gradle, never autolinked into an app, never run on a headset. The Kotlin compiles with kotlinc 2.2.21 without the v2 compiler plugin, so the generated bindings (`@Event` binding, shared-class registration) are unchecked.
- Fallback orientation (`uvCoordinates` `[0, 1, 1, 0]`, arc `v = 1` at the top) follows virocore's statement that panel textures are bottom-up; not seen on a device.
- Session STOPPING or loss destroys the layers with no event; the handle then stops receiving presentation changes and should be disposed.
- Other agents' `packages/ui` sketch is unchanged and still marked as a sketch.
