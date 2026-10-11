# Spatial layouts: one product model, explicit presentation owners

[Handbook](README.md) · [Runnable source examples](examples/README.md) · [Capability matrix](CAPABILITIES.md)

## Three concepts that must not be conflated

| Concept | What it owns | What it does not prove |
| --- | --- | --- |
| `WorkspaceDefinition` | Semantic surfaces, lifecycle, requirements, focus/back behavior, fallback and budget | It creates no native windows by itself |
| `SpatialWorkspaceFrame` + `SpatialPanel` | Captured scene origin, geometry, transforms and panel interaction | It is not an independent OpenXR compositor layer |
| Native platform host | System-window/container requests and platform lifecycle | A requested window is not necessarily presented |

The app keeps selected items, open surfaces, navigation, and media sessions in its existing Zustand store. Pass a snapshot to the resolver; do not let every platform invent a competing store. Keep animation in the existing Kinetrell layer. OS-level size, anchor and placement should not be rewritten on every animation frame.

## Scene workspace recipe

See [SpatialWorkspaceExample.tsx](examples/SpatialWorkspaceExample.tsx). Capture `headPosition` and `headYawDeg` after the user settles into the workspace. `SpatialWorkspaceFrame` freezes them on mount. For deliberate recentering, supply a new settled pose and change its React `key`.

| API | Default / behavior |
| --- | --- |
| `snapTo` | Initial `left`, `center`, or `right` slot |
| `snapOnRelease` | Defaults to enabled when `snapTo` exists |
| `snapDistanceM` | 0.8 m; drops outside the radius remain where released |
| `snapOptions` | Default arc distance 2.6 m, side angle 28 degrees; supports vertical offset |
| `curved` | Shorthand when `shape` is omitted; explicit `shape` wins |
| `curvature` | 0.32 by default; controls the background arc |
| `defaultPinned` | True; unpinning enables `billboardY` orientation, not head-position following |
| `draggable` / `resizable` | Independent movement/scaling controls; pin state is not a drag-disable switch |
| `onClose` | Synchronize close with the app's selection/open state so it unmounts consistently |

The visible surface, header, content, hit targets and accessories should move under one carrier. Never nest `SpatialPanel snapTo=...` inside `SpatialWorkspaceSlotNode`: that double-applies world placement. The lower-level slot node remains useful for non-snapping groups whose single transform is owned by the parent.

**Geometry is not arbitrary-content deformation.** `curved` bends the panel background mesh. It does not automatically curve child text, a React Native view, or a video renderer. Rounded backgrounds likewise do not establish arbitrary-child clipping. Use the media surface's own presentation API for curved video.

Keep explicit `position`/`rotation` updates intentional. The panel state differentiates a parent mirroring a released pose from a new authored pose. Avoid a per-frame parent update that fights user placement.

## Semantic list/detail/inspector recipe

[workspace-contract.ts](examples/workspace-contract.ts) is a complete `WorkspaceDefinition` with a permanent main surface, discovery window, and selection-owned inspector. All required fields are present, and its tests use the actual source validator.

The newer `WorkspaceIntent` contains `{ definition, activity }`. `WorkspaceActivity.selections` contains **selection keys that currently hold values**, such as `"place"`, not every place ID. `openSurfaceIds` carries user-owned surface IDs. A selected detail surface should unmount when the selection clears, including on back/close.

Do not interchange this shape with legacy `SpatialWorkspaceIntent`; both remain exported. The older roles (`master`, `content`, `inspector`, `accessory`, `popup`) and newer roles (`discover`, `main`, `detail`, `tools`, `assistant`) are related by `WORKSPACE_ROLE_TO_SPATIAL_ROLE`, not identical string unions.

For the Meta resolver, pass the newer intent and a runtime object built from actual platform probes. The resolver returns a plan; [MetaWorkspaceHost](../packages/ui/src/MetaWorkspaceHost.tsx) needs the actual optional Viro Meta wrapper components to present it. Keep main inline, respect the reported promotion budget, and let lower-priority/unavailable windows take their declared fallback. Do not set availability merely because a package installed.

## Responsive and platform mapping

| Product role | Compact app | Expanded/tablet/web app | Viro immersive | Native OS presentation |
| --- | --- | --- | --- | --- |
| Main task | Primary screen | Main/detail pane | Center scene content | Main application surface |
| Discover | Drawer/stack selected by app | Leading pane/rail | Left scene panel | Start-side window when supported |
| Detail | Sheet or route | Trailing inspector | Right scene panel | End-side window when supported |
| Assistant/tools | Overlay or sheet | Accessory pane | Floating scene controls | Budgeted secondary window or inline fallback |

This table is application integration guidance, not a claim that the library automatically transforms arbitrary mobile JSX into native windows. Keep start/end semantic for RTL. Keep immersive left/right coordinates explicit.

### Meta

`resolveMetaWorkspace` plans surfaces; `MetaWorkspaceHost` delegates to the provided scene-provider/window components. The app must enable the verified fork's Meta layout configuration and install its runtime peers. Native presentation remains a device-validation gate; system windows are not the same thing as active OpenXR compositor layers.

### PICO

`PicoWindowContainerHost` consumes `getLayoutBridgeStatus`, `openWindowContainer`, and `closeWindowContainer` from the actual bridge. It owns one activity-backed container and preserves ownership when close fails. A `requested` result is not presentation completion. Independent per-surface Subwindows/AttachmentPanels are not implemented by that bridge in this baseline.

### Web

Viro scene geometry and web layout adapters are different integration paths. Drag/pinch/scroll depend on the corresponding Viro web bridge and ViroCore WASM exports. The existing UI guide records that rendering and interaction have not been proven here in a browser against the combined dependency build. DOM application panes should keep the application's semantic UI components; do not insert DOM/React Native views directly under Viro scene nodes.

## Acceptance checklist for an application

Record one run for: initial settled placement; left/right snapping; drop outside the radius; release outside a hit target; pinch cancellation; close/reopen; recenter; app-authored pose updates; keyboard/back and focus return; unsupported-platform fallback; and window-budget eviction. Add browser wheel/trackpad tests and native release/device evidence separately. A unit test of the resolver does not check any of those pixels or native lifetimes.
