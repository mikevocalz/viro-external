# @viro-external/spatial-shell

One navigation layout for Viro apps on every target:

| Target | Navigation | Detail content |
| --- | --- | --- |
| Meta Quest (quest flavor) | Rail in its own Layout SDK window, flush against the main panel's left edge | Second activity panel beside the main panel, with a title and Close |
| PICO (pico flavor) | Rail in a transparent strip of the main window, at the Quest window's size | Second activity panel |
| Any headset whose rail window is pending, refused or unavailable | Rail as a column on the left inside the main panel | Same as above |
| Tablets and unfolded foldables (600dp and wider) | Rail on the left inside the window | Pushed screen |
| Phones | Bottom tab bar | Pushed screen |

A headset never gets the bottom tab bar. The main content keeps the main
panel's launch aspect (1280x800dp by default) when the user resizes the panel.

This is the shell from expo-pico #45 (`packages/expo-pico-spatial/src/shell.ts`,
`src/mainContent.ts` and the example's `AppShell`, `NavRail`, `MainContentFrame`,
`PicoMainFrame`, `SpatialWindowHost` and `DetailPanelHost`), which ran on a
Quest 3S and a PICO 4 Ultra on 2026-11-04. That code was ported from Harlem
Might (`docs/spatial-layout/adr/0005` rail window, `0006` detail panel
activity) and MoyoLearn (`railWindow.ts`, `main-content-geometry.ts`).
It has not yet been run on a headset from this package.

## Install

```bash
npx expo install @viro-external/spatial-shell react-native-svg react-native-safe-area-context
```

`@reactvision/react-viro`'s config plugin applies this package's plugin
automatically when `android.xRMode` includes `"QUEST"` or `"PICO"`. In an app
without react-viro, add `"@viro-external/spatial-shell"` to `plugins` with
`{ "platforms": ["QUEST"] }`.

For the detail panel, install `@expo-pico/core`, which ships the panel
activity (`expo.modules.pico.PicoPanelActivity`) on both flavors. Without it
detail opens as a pushed screen and prebuild says so.

## Use

Build the runtime once at module scope, then render the shell at the app root.
The shell has no palette of its own: pass your theme tokens.

```tsx
// src/shell.ts
import { Platform } from "react-native";
import { requireOptionalNativeModule } from "expo";
import { isPicoBuild } from "@expo-pico/core";
import { createMetaWindows, createSpatialShellRuntime, resolveShellPlatform } from "@viro-external/spatial-shell";

const isHorizonBuild = requireOptionalNativeModule<{ isHorizonBuild?: boolean }>("ExpoHorizon")?.isHorizonBuild ?? false;

export const shellRuntime = createSpatialShellRuntime({
  platform: resolveShellPlatform({
    isHorizonBuild,
    isPicoBuild: isPicoBuild(),
    os: Platform.OS,
    deviceConstants: Platform.constants,
  }),
  metaWindows: createMetaWindows(isHorizonBuild, () => ({
    layout: require("@metavr/layout-compat"),
    window: require("@metavr/layout-window-compat"),
  })),
});
```

```tsx
// app/_layout.tsx
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Slot, usePathname, useRouter } from "expo-router";
import { PicoWindows } from "@expo-pico/core";
import { SpatialShell } from "@viro-external/spatial-shell";

import { shellRuntime } from "../src/shell";
import { destinations, destinationForPath } from "../src/destinations";
import { theme } from "../src/theme";

export default function RootLayout() {
  const router = useRouter();
  const pathname = usePathname();
  return (
    <SafeAreaProvider>
      <SpatialShell
        runtime={shellRuntime}
        destinations={destinations}
        activeDestinationId={destinationForPath(pathname)}
        onSelectDestination={(id) => router.navigate(`/${id === "home" ? "" : id}`)}
        theme={{
          background: theme.bg,
          raisedSurface: theme.bgRaised,
          cardSurface: theme.bgCard,
          indicator: theme.borderBright,
          text: theme.text,
          textMuted: theme.textMuted,
          accent: theme.accent,
          divider: theme.border,
        }}
        detail={{
          componentName: "AppDetailPanel",
          createPanelHost: () => new PicoWindows().createPanelHost(),
          showAsScreen: (id) => router.push(`/detail/${id}`),
        }}
      >
        <Slot />
      </SpatialShell>
    </SafeAreaProvider>
  );
}
```

Register the detail panel's surface at module scope in your entry file, so it
exists before the panel activity asks for it:

```tsx
AppRegistry.registerComponent("AppDetailPanel", () => () => (
  <SpatialShellDetailPanel theme={shellTheme} renderDetail={(id) => ({ title: titles[id], content: <Detail id={id} /> })} />
));
```

Open detail content with `useOpenDetail()(id)`. A pushed detail screen calls
`useSpatialShellStore.getState().leaveDetailScreen(id)` when it unmounts.

Sizes come from `createSpatialShellGeometry(overrides)`; the defaults are the
verified ones (96dp rail, 72dp slots, a 40dp selected square at a 10dp radius,
a 420x600dp detail panel, a 1280x800dp main panel). Keep `mainWidthDp` and
`mainHeightDp` equal to the panel size your headset manifest declares.

## Config plugin options

| Option | Default | What it writes |
| --- | --- | --- |
| `platforms` | `["QUEST"]` (react-viro passes its QUEST/PICO modes) | Which flavors to configure |
| `detailPanel` | `{ activity: "expo.modules.pico.PicoPanelActivity", defaultWidth: "420dp", defaultHeight: "600dp" }` | The panel activity in `app/src/quest/AndroidManifest.xml`, sized by `<layout>`; in the pico manifest only when `@expo-pico/core` did not declare it. `false` skips it |
| `horizonSdk` | `{ minSdkVersion: 207, targetSdkVersion: 209 }` | `metavr:uses-metavr-sdk` in the quest manifest when expo-horizon-core did not write one. `false` skips it |
| `immersiveActivityMarker` | `true` | `expo.modules.pico.IMMERSIVE_ACTIVITY` on Viro's `.VRActivity`, which `enterImmersiveScene()` looks for |
| `activityIdentityGuard` | `true` | `skipActivityIdentityAssertionOnHostPause` in `MainApplication.kt`, so Enter XR does not crash on the paused 2D panel |

The plugin also moves the quest flavor declaration above the first
`questImplementation` block in `app/build.gradle`. It runs after every other
mod, and a second prebuild changes nothing.

Opt out from react-viro with `android.spatialShell: false`.

## Doctor

```bash
npx viro-spatial-shell-doctor [projectRoot] [--json] [--allow-tab-navigator]
```

Run it after `expo prebuild`. It exits 1 when a headset project (a quest or
pico flavor, or Viro's `.VRActivity`) does not have this package, renders no
`<SpatialShell>`, imports a bottom tab navigator, or is missing the marker,
the guard, the Horizon OS SDK declaration or the quest flavor order. A
phone-only project passes.
