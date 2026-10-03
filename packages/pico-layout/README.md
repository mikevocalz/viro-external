# @viro-external/pico-layout

Maps the shared `@viro-external/xr-contract` surface intents onto PICO Spatial SDK 6 presentation primitives (`WindowContainer`, `Subwindow`, `Augment`, `Toolbar`, `SpatialPopup`, `Stage`, `AttachmentPanelComponent`).

The package is pure TypeScript. It links no PICO native artifact and makes no native call. It answers one question: given a surface's role and placement, plus what the runtime reports it can host, which PICO primitive should present it? Opening that primitive on a headset is the job of `@expo-pico/spatial`, and that binding does not exist yet. See [Status](#status-what-is-not-implemented).

## Where it sits

```text
app layout (React Native / Viro)
  -> @viro-external/xr-contract      SpatialSurfaceIntent: role, placement, priority, fallback, size
  -> @viro-external/pico-layout      resolvePicoSurface(): intent + PicoSpatialRuntime -> PicoResolvedSurface
  -> @expo-pico/spatial (future)     opens WindowContainer / Subwindow / Augment / ... on the device
  -> PICO Spatial SDK 6
```

Viro stays the immersive renderer. PICO `Stage` is a platform container and lifecycle primitive. The 3D scene inside it can still be Viro/OpenXR when that is the selected renderer.

Ownership, as defined in [`doc/Architecture.md`](doc/Architecture.md):

| Layer | Owns |
| --- | --- |
| `@viro-external/xr-contract` | Semantic intent types, priority ordering, capability vocabulary |
| `@viro-external/pico-layout` (this package) | Role-to-primitive mapping and the PICO capability report |
| `@expo-pico/spatial` | SDK detection and versioning, container open/close, Subwindow/Augment/Toolbar/SpatialPopup presentation, `AttachmentPanelComponent` hosting of React Native Android Views, Stage transitions, capability reporting back to JS |
| Viro | Immersive scene composition and 3D |

Application state stays in the normal React Native / Zustand / domain layer. A native window is a presentation target, not a second copy of feature state.

## Install

This is a workspace package in the `viro-external` monorepo. Add it and its peer to the consuming package:

```json
{
  "dependencies": {
    "@viro-external/pico-layout": "workspace:*",
    "@viro-external/xr-contract": "workspace:*"
  }
}
```

| Field | Value |
| --- | --- |
| Version | `0.1.0` |
| Peer dependency | `@viro-external/xr-contract` (`workspace:*`) |
| Entry | `main` and `types` both point at `src/index.ts` |
| Side effects | none (`"sideEffects": false`) |

The package ships TypeScript source and has no build step, so the consumer's bundler (Metro, Vite, and so on) compiles it. Typecheck it on its own with:

```sh
cd packages/pico-layout && npx tsc --noEmit -p .
```

## Exports

| Export | Kind | Purpose |
| --- | --- | --- |
| `resolvePicoSpatialPrimitive(intent, runtime)` | function | Returns the `PicoSpatialPrimitive` for one surface |
| `resolvePicoSurface(intent, runtime)` | function | Returns a `PicoResolvedSurface`: primitive plus id, fallback, size, resizable |
| `PicoSpatialLayoutAdapter` | class | `XRPlatformAdapter` with `family = "pico-spatial"`; reports capabilities |
| `PicoSpatialRuntime` | type | Runtime flags the resolver reads |
| `PicoSpatialPrimitive` | type | The PICO presentation targets |
| `PicoResolvedSurface` | type | Resolver output |

`SpatialSurfaceIntent`, `SpatialWorkspaceIntent`, `resolveSpatialWorkspace`, and `spatialPriorityValue` come from `@viro-external/xr-contract`.

## Configuration reference

### `SpatialSurfaceIntent` (from `@viro-external/xr-contract`)

One entry per surface. The "Read by" column says which code actually uses the field today.

| Field | Type | Required | Default | Read by |
| --- | --- | --- | --- | --- |
| `id` | `string` | yes | none | `resolvePicoSurface`, copied to `id` |
| `preferredPresentation` | `SpatialPresentation` | yes | none | `resolvePicoSpatialPrimitive`, only when `role` is unset (see below) |
| `fallback` | `"inline" \| "drop"` | yes | none | `resolvePicoSurface`, copied to `fallback` |
| `role` | `SpatialSurfaceRole` | no | unset | `resolvePicoSpatialPrimitive`, picks the primitive |
| `placement` | `SpatialSurfacePlacement` | no | `"start"` for `master`, `"end"` for every other role | `resolvePicoSpatialPrimitive`, only for `master` and `inspector` |
| `priority` | `number \| SpatialPriorityTier` | no | `1` (same as `"secondary"`) | `resolveSpatialWorkspace` in xr-contract; this package ignores it |
| `preferredSize` | `{ width: number; height: number; depth?: number }` | no | unset | `resolvePicoSurface`, copied to `width` / `height` / `depth` |
| `resizable` | `boolean` | no | `true` | `resolvePicoSurface`, copied to `resizable` |
| `promotable` | `boolean` | no | unset | not read by this package |
| `movable` | `boolean` | no | unset | not read by this package |
| `opaqueRoot` | `boolean` | no | unset | not read by this package |

Enum values:

- `SpatialSurfaceRole`: `"master" | "content" | "inspector" | "accessory" | "popup" | "volume" | "immersive"`
- `SpatialSurfacePlacement`: `"start" | "center" | "end" | "top" | "bottom" | "user"`
- `SpatialPresentation`: `"inline" | "system-window" | "system-subwindow" | "spatial-augment" | "spatial-volume" | "spatial-stage" | "spatial-web-element" | "immersive-scene" | "wearable-display"`
- `SpatialPriorityTier` and its numeric value from `spatialPriorityValue`: `"permanent"` = 4, `"primary"` = 3, `"popup"` = 2, `"secondary"` = 1, `"ephemeral"` = 0. A numeric `priority` passes through unchanged.

`SpatialWorkspaceIntent` wraps the surfaces as `{ id: string; surfaces: readonly SpatialSurfaceIntent[]; maxPromotedSurfaces?: number }`. `resolveSpatialWorkspace(workspace)` returns the surfaces sorted by descending `priorityValue`. Nothing in this package or in xr-contract reads `maxPromotedSurfaces` yet, so PICO capacity limits are not enforced.

### `PicoSpatialRuntime`

Describes what the current device can host. The caller builds it. No helper in this package or in `@expo-pico/spatial` derives it from a native probe yet.

| Field | Type | Required | Effect when `false` or omitted |
| --- | --- | --- | --- |
| `isSpatialAvailable` | `boolean` | yes | Every surface resolves to `"inline"`, regardless of the other flags |
| `supportsWindowContainer` | `boolean` | no | `content` resolves to `"inline"` |
| `supportsSubwindow` | `boolean` | no | `master` / `inspector` fall back to `"augment"`, then `"inline"` |
| `supportsAugment` | `boolean` | no | Removes the `"augment"` fallback for `master`, `inspector`, `accessory`, `popup`, and role-less surfaces |
| `supportsToolbar` | `boolean` | no | `accessory` falls back to `"augment"`, then `"inline"` |
| `supportsSpatialPopup` | `boolean` | no | `popup` falls back to `"augment"`, then `"inline"` |
| `supportsVolume` | `boolean` | no | `volume` resolves to `"inline"` |
| `supportsStage` | `boolean` | no | `immersive` resolves to `"inline"` |
| `supportsAttachmentPanel` | `boolean` | no | Role-less surfaces fall back to `"augment"`, then `"inline"` |

Omitted optional flags behave as `false`. `PicoSpatialLayoutAdapter` defaults its runtime to `{ isSpatialAvailable: false }`.

### `PicoResolvedSurface` (output)

| Field | Type | Source |
| --- | --- | --- |
| `id` | `string` | `intent.id` |
| `primitive` | `PicoSpatialPrimitive` | `resolvePicoSpatialPrimitive(intent, runtime)` |
| `fallback` | `"inline" \| "drop"` | `intent.fallback`, unchanged |
| `width` / `height` / `depth` | `number \| undefined` | `intent.preferredSize` |
| `resizable` | `boolean` | `intent.resizable ?? true` |

The resolver never acts on `fallback`. When `primitive` is `"inline"`, the consumer decides: render the surface at its declaration site if `fallback` is `"inline"`, or omit it if `fallback` is `"drop"`. Per the workspace contract, the `content` surface must never depend on promotion, so give it `fallback: "inline"`.

## Role to PICO primitive mapping

Checked against `resolvePicoSpatialPrimitive` in `src/index.ts`. The table assumes `isSpatialAvailable: true`. With `isSpatialAvailable: false`, every row resolves to `"inline"`.

| Role | First choice (flag) | Fallback chain | PICO SDK 6 class |
| --- | --- | --- | --- |
| `content` | `"window-container-planar"` (`supportsWindowContainer`) | `"inline"` | planar `WindowContainer` |
| `master` | `"subwindow-start"` or `"subwindow-end"` (`supportsSubwindow`) | `"augment"` (`supportsAugment`), then `"inline"` | `Subwindow`, otherwise `Augment` |
| `inspector` | `"subwindow-end"` or `"subwindow-start"` (`supportsSubwindow`) | `"augment"` (`supportsAugment`), then `"inline"` | `Subwindow`, otherwise `Augment` |
| `accessory` | `"toolbar"` (`supportsToolbar`) | `"augment"` (`supportsAugment`), then `"inline"` | `Toolbar`, otherwise `Augment` |
| `popup` | `"spatial-popup"` (`supportsSpatialPopup`) | `"augment"` (`supportsAugment`), then `"inline"` | `SpatialPopup`, otherwise `Augment` |
| `volume` | `"window-container-volume"` (`supportsVolume`) | `"inline"` | volumetric `WindowContainer` |
| `immersive` | `"stage"` (`supportsStage`) | `"inline"` | `Stage` |
| unset (attached RN / Viro utility surface) | see below | `"augment"` (`supportsAugment`), then `"inline"` | `AttachmentPanelComponent` |

A surface with no `role` is the only path that reads `preferredPresentation`. The checks run in this order:

1. `preferredPresentation: "spatial-volume"` and `supportsVolume` gives `"window-container-volume"`.
2. `preferredPresentation: "spatial-stage"` and `supportsStage` gives `"stage"`.
3. `supportsAttachmentPanel` gives `"attachment-panel"`.
4. `supportsAugment` gives `"augment"`.
5. Otherwise `"inline"`.

`AttachmentPanelComponent` hosts an Android `View` in spatial space. That is the intended bridge point for React Native / Fabric surfaces, so app UI does not need a rewrite in Compose:

```text
React component -> Fabric surface -> Android View -> AttachmentPanelComponent -> spatial entity
```

A PICO `WindowContainer` is associated with an Android `Activity`, so each top-level container is a real native window, not a React child.

`PicoSpatialPrimitive` also includes `"tab-bar"`. The resolver never returns it today.

## LEFT / CENTER / RIGHT slot continuity

The existing Viro three-slot composition maps onto roles and placements without a second authored layout:

| Viro slot | Role | Placement | PICO primitive (full runtime) |
| --- | --- | --- | --- |
| LEFT | `master` | `"start"` | `"subwindow-start"` |
| CENTER | `content` | `"center"` (main) | `"window-container-planar"` |
| RIGHT | `inspector` | `"end"` | `"subwindow-end"` |

Side selection for `master` and `inspector`:

- With no `placement`, `master` goes to `"start"` and `inspector` goes to `"end"`.
- `placement: "start"` gives the start Subwindow. Any other value (`"center"`, `"end"`, `"top"`, `"bottom"`, `"user"`) gives the end Subwindow.
- `content` ignores `placement`. The planar `WindowContainer` is the main window.

Set `placement` on `master` explicitly or leave it unset. `{ role: "master", placement: "center" }` resolves to `"subwindow-end"` here, while `resolvePicoLayoutPrimitive` in `@expo-pico/spatial` (branch `feat/spatial-layout-contract-v2`) defaults `placement` to `"center"` and sends `master` to `"subwindow-start"` for anything except `"end"`. The two agree whenever `placement` is `"start"`, `"end"`, or unset.

## Capability reporting

`PicoSpatialLayoutAdapter.getCapabilities()` returns an `XRCapabilityReport` built from the current `PicoSpatialRuntime`. Each key is either `"unverified"` or `"unsupported"`. It never returns `"supported"`.

| Capability | Value when spatial is available | Condition |
| --- | --- | --- |
| `system-window` | `"unverified"` | `supportsWindowContainer` |
| `spatial-layout` | `"unverified"` | always |
| `multi-window` | `"unverified"` | `supportsSubwindow` or `supportsAugment` |
| `spatial-fallback` | `"unverified"` | always, even when spatial is unavailable |
| `spatial-volume` | `"unverified"` | `supportsVolume` |
| `spatial-stage` | `"unverified"` | `supportsStage` |
| `surface-placement` | `"unverified"` | `supportsAugment` or `supportsAttachmentPanel` |
| `display` | `"unverified"` | always, even when spatial is unavailable |

A key whose condition is false, or any conditional key while `isSpatialAvailable` is `false`, reports `"unsupported"`. Other `XRCapabilityName` keys are omitted.

The adapter reports `"unverified"` because the runtime flags describe PICO SDK classes the caller probed, not native calls anyone has bound. A class being present on the classpath does not mean `expo-pico` can open that container, and no path has run on a device. `"supported"` would be a false claim until `@expo-pico/spatial` binds the call and it passes device validation. The expo-pico readiness model draws the same line: `nativeLayoutBridgeBound` stays `false` even when the SDK 6 runtime probe succeeds.

Other adapter members:

- `family` is `"pico-spatial"`.
- `setRuntime(runtime)` replaces the runtime used by later `getCapabilities()` calls.
- `dispose()` does nothing.
- `presentSurface` and `updatePortableScene` (optional on `XRPlatformAdapter`) are not implemented.

## Worked example

A notes app with a library on the left, the editor in the center, and a properties inspector on the right. The editor must always render. The inspector can disappear when it cannot be promoted.

```ts
import {
  resolveSpatialWorkspace,
  type SpatialWorkspaceIntent,
} from "@viro-external/xr-contract";
import {
  PicoSpatialLayoutAdapter,
  resolvePicoSurface,
  type PicoResolvedSurface,
  type PicoSpatialRuntime,
} from "@viro-external/pico-layout";

const workspace: SpatialWorkspaceIntent = {
  id: "notes-workspace",
  surfaces: [
    {
      id: "library",
      role: "master",
      placement: "start",
      preferredPresentation: "system-subwindow",
      fallback: "inline",
      priority: "secondary",
      preferredSize: { width: 360, height: 640 },
    },
    {
      id: "editor",
      role: "content",
      placement: "center",
      preferredPresentation: "system-window",
      fallback: "inline",
      priority: "permanent",
      preferredSize: { width: 960, height: 720 },
    },
    {
      id: "properties",
      role: "inspector",
      placement: "end",
      preferredPresentation: "system-subwindow",
      fallback: "drop",
      priority: "ephemeral",
      preferredSize: { width: 420, height: 620 },
      resizable: false,
    },
  ],
};

// PICO OS 6 with every Spatial SDK 6 primitive reported present.
const os6: PicoSpatialRuntime = {
  isSpatialAvailable: true,
  supportsWindowContainer: true,
  supportsSubwindow: true,
  supportsAugment: true,
  supportsToolbar: true,
  supportsSpatialPopup: true,
  supportsVolume: true,
  supportsStage: true,
  supportsAttachmentPanel: true,
};

// Highest priority first: editor (4), library (1), properties (0).
const ordered = resolveSpatialWorkspace(workspace);

const resolved: PicoResolvedSurface[] = ordered.map((surface) =>
  resolvePicoSurface(surface, os6)
);

const adapter = new PicoSpatialLayoutAdapter(os6);
const capabilities = adapter.getCapabilities();
```

`resolved` on the full OS 6 runtime:

```json
[
  { "id": "editor", "primitive": "window-container-planar", "fallback": "inline", "width": 960, "height": 720, "resizable": true },
  { "id": "library", "primitive": "subwindow-start", "fallback": "inline", "width": 360, "height": 640, "resizable": true },
  { "id": "properties", "primitive": "subwindow-end", "fallback": "drop", "width": 420, "height": 620, "resizable": false }
]
```

`depth` is omitted from the JSON because no surface set `preferredSize.depth`.

With `{ ...os6, supportsSubwindow: false }`, the side panels move to `Augment`:

```json
[
  { "id": "editor", "primitive": "window-container-planar", "fallback": "inline", "width": 960, "height": 720, "resizable": true },
  { "id": "library", "primitive": "augment", "fallback": "inline", "width": 360, "height": 640, "resizable": true },
  { "id": "properties", "primitive": "augment", "fallback": "drop", "width": 420, "height": 620, "resizable": false }
]
```

With `{ isSpatialAvailable: false }` (PICO OS 5, or OS 6 without the SDK), all three resolve to `"inline"`. The consumer renders `editor` and `library` in the normal React Native layout and omits `properties` because its `fallback` is `"drop"`.

`capabilities` for the full OS 6 runtime:

```json
{
  "system-window": "unverified",
  "spatial-layout": "unverified",
  "multi-window": "unverified",
  "spatial-fallback": "unverified",
  "spatial-volume": "unverified",
  "spatial-stage": "unverified",
  "surface-placement": "unverified",
  "display": "unverified"
}
```

All outputs above come from running this example against `src/index.ts` on this branch.

## PICO OS 5 vs OS 6

| | PICO OS 5 / legacy (PICO 4-class devices) | PICO OS 6 with Spatial SDK 6 |
| --- | --- | --- |
| App UI | Normal React Native adaptive layout | The same semantic workspace, promoted into native spatial containers when the runtime flags allow it |
| Immersive | Viro / OpenXR | `Stage` lifecycle, with Viro / OpenXR as the scene renderer |
| `PicoSpatialRuntime` | `{ isSpatialAvailable: false }`, so every surface resolves to `"inline"` | `isSpatialAvailable: true`, plus per-primitive flags |
| SDK packages | PVR-era `com.picovr.spatial.*` (what the original `@expo-pico/spatial` bridge probes) | `com.pico.spatial.*`, documented in Spatial SDK 6.1.9 |

Rules from `doc/Architecture.md` and the expo-pico layout doc:

- Branch on runtime capabilities inside the adapter. Never branch product components on device name.
- If the PICO Spatial SDK is not linked, not supported by the OS or device, or cannot host the requested primitive, return inline or drop behaviour rather than claiming spatial support.
- The OS 5 OpenXR path must stay available for PICO 4-class devices after the OS 6 bridge lands.

The `@expo-pico/spatial` readiness probe (`layoutReadinessFromProbe`, branch `feat/spatial-layout-contract-v2`) reports `modernSpatialUiRuntimePresent`, `legacySpatialRuntimePresent`, `attachmentPanelRuntimePresent`, `spatialNavigatorRuntimePresent`, and `nativeLayoutBridgeBound` (hard-coded `false`). It does not produce a `PicoSpatialRuntime`. Any translation between the two is the caller's code today.

## Status: what is NOT implemented

- **No PICO container call is bound.** Nothing here or in `@expo-pico/spatial` opens, updates, or closes a `WindowContainer`, `Subwindow`, `Augment`, `Toolbar`, `SpatialPopup`, `Stage`, or `AttachmentPanelComponent`. This package returns strings.
- **`nativeLayoutBridgeBound` is `false`.** expo-pico sets it to `true` only after the Kotlin / Expo Module implementation owns those calls and passes device or emulator validation.
- **Nothing is device-validated.** No mapping in this README has run on PICO hardware or an emulator. The mapping follows the PICO Spatial SDK 6.1.9 documentation as read on 2026-10-03.
- `PicoSpatialLayoutAdapter` does not implement `presentSurface` or `updatePortableScene`.
- `maxPromotedSurfaces` and platform capacity are not enforced. `priority` only orders surfaces through `resolveSpatialWorkspace`.
- `promotable`, `movable`, and `opaqueRoot` are not read.
- The `"tab-bar"` primitive is declared but never returned.
- No helper builds a `PicoSpatialRuntime` from a native probe.
- `master` with `placement: "center"` resolves to the end Subwindow here and to the start Subwindow in `@expo-pico/spatial`. See [slot continuity](#left--center--right-slot-continuity).

The planned native follow-up in expo-pico: link the public Spatial SDK 6.x artifact through the Expo config plugin, bind container open/close/update, expose Subwindow/Augment/Toolbar/SpatialPopup presentation, create a Fabric / Android View host through `AttachmentPanelComponent`, map `Stage` lifecycle to the existing Viro/OpenXR launcher, then flip `nativeLayoutBridgeBound`.

## References

- PICO Spatial SDK documentation: https://developer.picoxr.com/document/spatial-sdk/
- viro-external PR #31, PICO spatial layout adapter: https://github.com/mikevocalz/viro-external/pull/31
- expo-pico PR #16, Spatial SDK 6 layout contract and readiness probe: https://github.com/mikevocalz/expo-pico/pull/16
- Shared workspace contract: [`../xr-platform-contract/doc/SpatialWorkspace.md`](../xr-platform-contract/doc/SpatialWorkspace.md)
- Native bridge ownership: [`doc/Architecture.md`](doc/Architecture.md)
