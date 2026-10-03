# @viro-external/meta-layout

Maps the shared spatial surface intents from `@viro-external/xr-contract` onto the props of a Meta Horizon OS `SpatialWindow` (Quest), and reports what that path can do through the shared `XRPlatformAdapter` interface.

The package is pure TypeScript. It creates no windows, ships no native code and has no runtime dependencies besides the contract package. Your app renders the windows with Meta's own Layout components. Viro keeps immersive scenes, 3D content and engine-level panels.

## Where it sits

```
@viro-external/xr-contract          SpatialSurfaceIntent / SpatialWorkspaceIntent
  (semantic intent: role, priority,  resolveSpatialWorkspace(), spatialPriorityValue()
   placement, fallback, size)
            |
            v
@viro-external/meta-layout          toMetaSpatialWindowProps(intent) -> MetaSpatialWindowProps
  (this package)                    MetaHorizonLayoutAdapter         -> XRCapabilityReport
            |
            v
your app                            Meta Layout setup: SpatialSceneProvider once,
  (owns the Meta dependency)        then <SpatialWindow {...props}> per promoted surface

Viro renderer                       immersive scenes and the "immersive" role; not a Layout window
```

The split follows the ownership boundary in [`packages/xr-platform-contract/doc/SpatialWorkspace.md`](../xr-platform-contract/doc/SpatialWorkspace.md): the contract holds intent, platform adapters own OS windows, Viro owns immersive rendering. The repository's notes record Meta's React Native Layout packages as `@metavr/layout-compat` (`SpatialSceneProvider`) and `@metavr/layout-window-compat` (`SpatialWindow`). This package does not depend on either, so check names and props against Meta's current docs before you wire them.

## Install

Inside this monorepo, add both workspace packages to the app:

```json
{
  "dependencies": {
    "@viro-external/meta-layout": "workspace:*",
    "@viro-external/xr-contract": "workspace:*"
  }
}
```

| Item | Value |
| --- | --- |
| Version | `0.1.0` |
| Entry point | `src/index.ts` (TypeScript source, no build step) |
| Peer dependency | `@viro-external/xr-contract` (`workspace:*`) |
| Runtime dependencies | none |
| Native code / config plugin | none |

Your bundler must compile TypeScript from `node_modules`, which Metro does by default.

## Exports

| Export | Kind | Purpose |
| --- | --- | --- |
| `toMetaSpatialWindowProps(intent)` | function | Converts one `SpatialSurfaceIntent` into `MetaSpatialWindowProps`. |
| `MetaHorizonLayoutAdapter` | class | `XRPlatformAdapter` with `family: "meta-horizon-layout"`. Provides `getCapabilities()`, `setRuntime()`, `dispose()`. |
| `MetaSpatialWindowProps` | type | `{ label, windowWidth, windowHeight, priority, promotable, anchor, fallback }` |
| `MetaAnchor` | type | `"center" \| "start" \| "end" \| "left" \| "right" \| "top" \| "bottom"` |
| `MetaHorizonLayoutRuntime` | type | `{ isSpatialAvailable: boolean; maxPromotedWindows?: number }` |
| `META_HORIZON_LAYOUT_MIN_OS` | const | `207` |
| `META_HORIZON_RN_DEFAULT_SLOT_BUDGET` | const | `2` |

`MetaAnchor` includes `left` and `right`, but `toMetaSpatialWindowProps` never produces them. Slot continuity uses `start` and `end`.

## Layout configuration reference

### Intent fields read by `toMetaSpatialWindowProps`

| `SpatialSurfaceIntent` field | Output prop | Rule | Default when omitted |
| --- | --- | --- | --- |
| `id` (required) | `label` | Copied as is. Keep it stable across renders; it is the window's identity. | n/a |
| `preferredSize.width` | `windowWidth` | Copied. | `360` |
| `preferredSize.height` | `windowHeight` | Copied. | `480` |
| `priority` | `priority` | `spatialPriorityValue()`: `permanent` 4, `primary` 3, `popup` 2, `secondary` 1, `ephemeral` 0. A number passes through unchanged. | `1` (same as `secondary`) |
| `promotable` | `promotable` | Copied. | `true` |
| `placement` | `anchor` | See the anchor table below. | derived from `role` |
| `role` | `anchor` | Only used when `placement` is omitted. | `center` |
| `fallback` (required) | `fallback` | `"inline"` or `"drop"`, copied. | n/a |

`preferredSize` defaults as a pair: if you omit it, both width and height come from `360 x 480`. If you pass it, both values come from you. `preferredSize.depth` is ignored.

### Placement to anchor

| `placement` | `anchor` |
| --- | --- |
| `start`, `end`, `top`, `bottom`, `center` | same value |
| `user` | `center` |
| omitted, `role: "master"` | `start` |
| omitted, `role: "inspector"` | `end` |
| omitted, any other role or no role | `center` |

### Intent fields this package ignores

`preferredPresentation`, `movable`, `resizable`, `opaqueRoot` and `preferredSize.depth` are part of the contract but are not read. In particular, the mapper does not check `preferredPresentation` or `role: "immersive"`. Filter those surfaces out yourself and send them to Viro (see the worked example).

`SpatialWorkspaceIntent.maxPromotedSurfaces` is also not read by anything in this package.

### `MetaHorizonLayoutRuntime`

| Field | Read by | Effect |
| --- | --- | --- |
| `isSpatialAvailable` | `getCapabilities()` | `true`: window capabilities report `"unverified"`. `false`: they report `"unsupported"`. |
| `maxPromotedWindows` | nothing | Stored only. See [Not implemented](#not-implemented). |

The constructor default is `{ isSpatialAvailable: false, maxPromotedWindows: META_HORIZON_RN_DEFAULT_SLOT_BUDGET }`. `setRuntime()` replaces the whole object, so pass `maxPromotedWindows` again if you want it kept.

## Horizon OS v207 and the two-window budget

`META_HORIZON_LAYOUT_MIN_OS` is `207`. Per the repository's Meta notes, Horizon OS older than v207 falls back instead of promoting a `SpatialWindow`. The package exports the number and never reads the OS version, so your app decides: read the OS version with whatever native API you already use, and set `isSpatialAvailable: osVersion >= META_HORIZON_LAYOUT_MIN_OS`.

`META_HORIZON_RN_DEFAULT_SLOT_BUDGET` is `2`, the number of promoted window slots the repository's notes record for the current React Native integration. The main React Native window is not one of them. Capacity belongs to the platform, so:

- give every surface a priority tier and let the highest ones win the slots;
- give every non-main surface a deliberate `fallback` (`inline` renders it in place, `drop` omits it);
- make sure the main task still works when every extra window falls back.

`resolveSpatialWorkspace()` from the contract sorts surfaces by priority value, highest first. Apply your own budget to that order, as the worked example does.

## Slot continuity

The Viro LEFT / CENTER / RIGHT composition maps to Meta without a second authored layout:

| Viro slot | Contract role | Meta target | Default anchor |
| --- | --- | --- | --- |
| LEFT | `master` | start `SpatialWindow` | `start` |
| CENTER | `content` | main Android / React Native window | `center` (but do not wrap the main window in a `SpatialWindow`) |
| RIGHT | `inspector` | end `SpatialWindow` | `end` |

Other roles, from the contract's role table:

| Role | Meta Horizon target | Default anchor from this package |
| --- | --- | --- |
| `accessory` | bottom or anchored window when capacity allows, otherwise inline | `center`; set `placement: "bottom"` explicitly |
| `popup` | priority window | `center` |
| `volume` | adapter-specific or Viro | `center` |
| `immersive` | Viro / OpenXR, never a Layout window | `center` (filter it out before mapping) |

Suggested tiers from `doc/Architecture.md`: master `permanent`; an important inspector `primary` or `secondary`; popup `popup`; accessory and tips `ephemeral`.

## Capabilities report "unverified"

`getCapabilities()` returns:

| Capability | `isSpatialAvailable: true` | `isSpatialAvailable: false` |
| --- | --- | --- |
| `system-window` | `unverified` | `unsupported` |
| `spatial-layout` | `unverified` | `unsupported` |
| `multi-window` | `unverified` | `unsupported` |
| `spatial-priority` | `unverified` | `unsupported` |
| `spatial-fallback` | `unverified` | `unverified` |
| `display` | `unverified` | `unverified` |

No path reports `"supported"`. This package maps props and nothing else, so it has no evidence that a window was created, promoted or placed. In the contract, `"supported"` means the capability works. Claiming that from a prop mapper would let calling code skip its fallback path on a device where promotion silently failed. A capability can move to `"supported"` once a native path creates the window and a device run proves it. Treat `"unverified"` as "try it, keep the fallback".

The adapter does not implement the optional `presentSurface()` or `updatePortableScene()` from `XRPlatformAdapter`, and `dispose()` does nothing.

## Expo CNG

This package has no config plugin and touches no native files. Meta's native dependencies (the BOM and Layout artifacts) still have to reach the Android build. Put them in an Expo config plugin that your app owns, so `npx expo prebuild --clean` regenerates the `android/` directory correctly every time. Do not hand-edit the generated `android/app/build.gradle`, `settings.gradle` or `AndroidManifest.xml`: prebuild overwrites them, and every consuming app would need the same manual edit. `@viro-external/meta-wearables` in this repo shows the pattern with `withAppBuildGradle` and `withAndroidManifest`.

See https://docs.expo.dev/config-plugins/introduction/.

## Worked example

A three-slot workspace with an extra accessory. The TypeScript part compiles against this package (checked with `tsc --noEmit`):

```ts
import {
  resolveSpatialWorkspace,
  type SpatialResolvedSurface,
  type SpatialWorkspaceIntent,
} from "@viro-external/xr-contract";
import {
  META_HORIZON_LAYOUT_MIN_OS,
  META_HORIZON_RN_DEFAULT_SLOT_BUDGET,
  MetaHorizonLayoutAdapter,
  toMetaSpatialWindowProps,
  type MetaSpatialWindowProps,
} from "@viro-external/meta-layout";

export const workspace: SpatialWorkspaceIntent = {
  id: "editor",
  surfaces: [
    {
      id: "navigator",
      role: "master",
      preferredPresentation: "system-window",
      fallback: "inline",
      priority: "permanent",
      preferredSize: { width: 320, height: 560 },
    },
    {
      id: "document",
      role: "content",
      preferredPresentation: "inline",
      fallback: "inline",
      priority: "primary",
    },
    {
      id: "properties",
      role: "inspector",
      preferredPresentation: "system-window",
      fallback: "inline",
      priority: "secondary",
      preferredSize: { width: 420, height: 620 },
    },
    {
      id: "tips",
      role: "accessory",
      preferredPresentation: "system-window",
      fallback: "drop",
      priority: "ephemeral",
      placement: "bottom",
    },
    {
      id: "preview-3d",
      role: "immersive",
      preferredPresentation: "immersive-scene",
      fallback: "drop",
    },
  ],
};

export type MetaWorkspacePlan = {
  promoted: MetaSpatialWindowProps[];
  inline: SpatialResolvedSurface[];
  dropped: SpatialResolvedSurface[];
  viro: SpatialResolvedSurface[];
};

// horizonOsVersion comes from your app's native code; this package does not read it.
export function planMetaWorkspace(
  intent: SpatialWorkspaceIntent,
  horizonOsVersion: number
): MetaWorkspacePlan {
  const isSpatialAvailable = horizonOsVersion >= META_HORIZON_LAYOUT_MIN_OS;
  const budget = intent.maxPromotedSurfaces ?? META_HORIZON_RN_DEFAULT_SLOT_BUDGET;
  const plan: MetaWorkspacePlan = { promoted: [], inline: [], dropped: [], viro: [] };

  // Highest priority first.
  for (const surface of resolveSpatialWorkspace(intent)) {
    if (surface.role === "immersive" || surface.preferredPresentation === "immersive-scene") {
      plan.viro.push(surface);
      continue;
    }
    if (surface.role === "content") {
      plan.inline.push(surface); // The main window never depends on promotion.
      continue;
    }
    const props = toMetaSpatialWindowProps(surface);
    if (isSpatialAvailable && props.promotable && plan.promoted.length < budget) {
      plan.promoted.push(props);
    } else if (surface.fallback === "inline") {
      plan.inline.push(surface);
    } else {
      plan.dropped.push(surface);
    }
  }
  return plan;
}

export const adapter = new MetaHorizonLayoutAdapter();

export function onHorizonOsVersion(horizonOsVersion: number) {
  adapter.setRuntime({
    isSpatialAvailable: horizonOsVersion >= META_HORIZON_LAYOUT_MIN_OS,
    maxPromotedWindows: META_HORIZON_RN_DEFAULT_SLOT_BUDGET,
  });
  return adapter.getCapabilities();
}
```

On Horizon OS v207 or later, `planMetaWorkspace(workspace, 207)` gives:

| Surface | Result | Props |
| --- | --- | --- |
| `navigator` | promoted | `label "navigator"`, `320 x 560`, `priority 4`, `anchor "start"`, `fallback "inline"` |
| `document` | inline (main window) | none |
| `properties` | promoted | `label "properties"`, `420 x 620`, `priority 1`, `anchor "end"`, `fallback "inline"` |
| `tips` | dropped (budget of 2 is full) | would have been `360 x 480`, `priority 0`, `anchor "bottom"` |
| `preview-3d` | Viro | none |

On older Horizon OS, `navigator` and `properties` render inline and `tips` is dropped.

The app-side render belongs to your app and uses Meta's components. It is not typechecked here because this repo does not install `@metavr/*`:

```tsx
import { SpatialSceneProvider } from "@metavr/layout-compat";
import { SpatialWindow } from "@metavr/layout-window-compat";

function EditorShell({ plan }: { plan: MetaWorkspacePlan }) {
  return (
    <SpatialSceneProvider>
      <DocumentScreen />
      {plan.promoted.map((props) => (
        <SpatialWindow key={props.label} {...props}>
          <SurfaceContent id={props.label} />
        </SpatialWindow>
      ))}
    </SpatialSceneProvider>
  );
}
```

Wrap the tree in `SpatialSceneProvider` once. Render `plan.inline` surfaces at their declaration sites, as you would on a phone. Keep `windowWidth`, `windowHeight` and `anchor` fixed while a window is open: they are layout configuration, and per-frame changes cross the process boundary. Animate inside the window instead. `doc/Architecture.md` also asks for opaque window roots; put glass or material effects inside the content.

## Not implemented

- **No `SpatialWindow` is created.** The package returns props. Your app renders the window.
- **No `@metavr` dependency.** The package neither imports nor declares Meta's Layout packages, so it cannot detect version drift in their props.
- **`maxPromotedWindows` is not enforced.** It is stored on the runtime and never read. Enforce the budget in your own code, as the worked example does.
- **The OS version is not read.** `META_HORIZON_LAYOUT_MIN_OS` is a constant. Your app sets `isSpatialAvailable`.
- **No config plugin.** Native Meta artifacts need an app-owned Expo config plugin.
- **`presentSurface()` and `updatePortableScene()` are not implemented**, and `dispose()` is empty.
- **Nothing is device-validated.** No part of this package has run on a Quest or any other Horizon OS device. The mapping is checked by `tsc` only, and the package has no unit tests.

## References

- React Native for Meta Horizon OS docs: https://oss.callstack.com/react-native-meta-horizon-os/
- React Native for Meta Horizon OS source: https://github.com/callstack/react-native-meta-horizon-os
- Meta Spatial SDK: https://developers.meta.com/horizon/develop/spatial-sdk
- Expo config plugins: https://docs.expo.dev/config-plugins/introduction/
- Pull request adding this package: https://github.com/mikevocalz/viro-external/pull/30
- Shared contract: [`packages/xr-platform-contract/doc/SpatialWorkspace.md`](../xr-platform-contract/doc/SpatialWorkspace.md)
- Package notes: [`doc/Architecture.md`](doc/Architecture.md)
