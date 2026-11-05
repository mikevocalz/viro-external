import React, { useEffect, useMemo } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";

import type { SpatialShellDetailConfig } from "../detail/SpatialShellDetailConfig";
import { createSpatialShellGeometry, type SpatialShellGeometry } from "../geometry/createSpatialShellGeometry";
import { resolveShellNavigation, type ShellNavigationPlacement } from "../layout/resolveShellNavigation";
import type { SpatialShellRuntime } from "../runtime/createSpatialShellRuntime";
import { useSpatialShellStore } from "../stores/shellStore";
import type { SpatialShellTheme } from "../theme/SpatialShellTheme";
import { DetailPanelController } from "./DetailPanelController";
import { MainContentFrame } from "./MainContentFrame";
import { NavRail } from "./NavRail";
import { PicoMainFrame } from "./PicoMainFrame";
import { PHYSICAL_LEFT_ROW } from "./physicalLeftRow";
import type { ShellDestination } from "./ShellDestination";
import { SpatialShellContext, useSpatialShellContext, type SpatialShellContextValue } from "./SpatialShellContext";
import { SpatialWindowHost } from "./SpatialWindowHost";
import { TabBar } from "./TabBar";
import { useHostedSpatialWindow } from "./useHostedSpatialWindow";

/**
 * Props for {@linkcode SpatialShell}.
 *
 * - `runtime`: from {@linkcode createSpatialShellRuntime}, built once at
 *   module scope.
 * - `destinations`: the rail on headsets, tablets and unfolded foldables, the
 *   bottom tab bar on phones, in order. At least one.
 * - `activeDestinationId` and `onSelectDestination`: the app's router state,
 *   so the shell works with Expo Router, Solito or React Navigation.
 * - `theme`: the app's colors. Required; the shell has no palette of its own.
 * - `geometry`: defaults to `createSpatialShellGeometry()`.
 * - `detail`: enables the detail panel and {@linkcode useOpenDetail}.
 * - `isMainPanelFullBleed`: true while the current route owns the whole main
 *   panel (an inline XR scene), which skips the launch-aspect frame.
 */
export interface SpatialShellProps<Id extends string = string> {
  readonly runtime: SpatialShellRuntime;
  readonly destinations: readonly ShellDestination<Id>[];
  readonly activeDestinationId: Id;
  readonly onSelectDestination: (id: Id) => void;
  readonly theme: SpatialShellTheme;
  readonly geometry?: SpatialShellGeometry;
  readonly detail?: SpatialShellDetailConfig;
  readonly isMainPanelFullBleed?: boolean;
  readonly children: React.ReactNode;
}

const DEFAULT_GEOMETRY = createSpatialShellGeometry();

/**
 * One layout for every target this shell supports:
 *
 * - Headsets: the rail on the main panel's physical left, in its own window
 *   (a Meta Layout SDK window on Horizon OS, the main window's strip on PICO).
 *   While that window is pending or refused, or the build cannot open one,
 *   the rail draws as a column on the left inside the main panel. Never the
 *   bottom tab bar. The main content keeps the panel's launch aspect when the
 *   panel is resized. Detail content opens in a panel beside the main panel.
 * - Tablets and unfolded foldables (600dp and wider): the rail on the left
 *   inside the window.
 * - Phones: the content above the bottom tab bar; detail opens as a screen.
 *
 * Render it at the app root, inside `SafeAreaProvider`. Ported from expo-pico
 * #45 (`example/src/ui/AppShell.tsx` and `app/_layout.tsx`), which a Quest 3S
 * and a PICO 4 Ultra ran on 2026-11-04.
 *
 * @throws {RangeError} When `destinations` is empty.
 */
export function SpatialShell<Id extends string>({
  runtime,
  destinations,
  activeDestinationId,
  onSelectDestination,
  theme,
  geometry = DEFAULT_GEOMETRY,
  detail,
  isMainPanelFullBleed = false,
  children,
}: SpatialShellProps<Id>): React.JSX.Element {
  if (destinations.length === 0) {
    throw new RangeError("[spatial-shell] <SpatialShell> needs at least one destination.");
  }
  const context = useMemo<SpatialShellContextValue>(
    () => ({
      runtime,
      geometry,
      theme,
      destinations,
      activeDestinationId,
      onSelectDestination: onSelectDestination as (id: string) => void,
      detail,
    }),
    [runtime, geometry, theme, destinations, activeDestinationId, onSelectDestination, detail]
  );
  const { SceneProvider } = runtime.metaWindows;
  return (
    <SpatialShellContext.Provider value={context}>
      <SceneProvider>
        <View
          style={[
            styles.root,
            { backgroundColor: runtime.windowBackend === "pico-spatial" ? "transparent" : theme.background },
          ]}
        >
          {runtime.platform.isHeadset ? (
            <HeadsetShell isMainPanelFullBleed={isMainPanelFullBleed}>{children}</HeadsetShell>
          ) : (
            <AdaptiveShell>{children}</AdaptiveShell>
          )}
          <SpatialWindowHost />
          {detail === undefined ? null : <DetailPanelController detail={detail} />}
        </View>
      </SceneProvider>
    </SpatialShellContext.Provider>
  );
}

function HeadsetShell({
  isMainPanelFullBleed,
  children,
}: {
  isMainPanelFullBleed: boolean;
  children: React.ReactNode;
}): React.JSX.Element {
  const { geometry, theme, destinations } = useSpatialShellContext();
  const railWindowSpec = useMemo(
    () => geometry.railWindow(destinations.length, theme.raisedSurface),
    [geometry, destinations.length, theme.raisedSurface]
  );
  const railWindow = useHostedSpatialWindow(railWindowSpec, <NavRail />);
  const setRailPlacement = useSpatialShellStore((state) => state.setRailPlacement);
  useEffect(() => setRailPlacement(railWindow), [railWindow, setRailPlacement]);
  const placement = resolveShellNavigation({ isHeadset: true, railWindow, widthDp: 0 });
  return (
    <PicoMainFrame>
      <RailFrame placement={placement}>
        <MainContentFrame isFramed={!isMainPanelFullBleed}>{children}</MainContentFrame>
      </RailFrame>
    </PicoMainFrame>
  );
}

function AdaptiveShell({ children }: { children: React.ReactNode }): React.JSX.Element {
  const { width } = useWindowDimensions();
  const placement = resolveShellNavigation({ isHeadset: false, railWindow: "inline", widthDp: width });
  if (placement === "bottom-tabs") {
    return (
      <View style={styles.fill}>
        <View style={styles.fill}>{children}</View>
        <TabBar />
      </View>
    );
  }
  return <RailFrame placement={placement}>{children}</RailFrame>;
}

function RailFrame({
  placement,
  children,
}: {
  placement: ShellNavigationPlacement;
  children: React.ReactNode;
}): React.JSX.Element {
  const { geometry, theme, destinations } = useSpatialShellContext();
  return (
    <View style={[styles.fill, { flexDirection: PHYSICAL_LEFT_ROW, backgroundColor: theme.background }]}>
      {placement === "rail-inline" ? (
        <View style={styles.inlineRail}>
          <View style={{ width: geometry.tokens.railWidthDp, height: geometry.railHeightDp(destinations.length) }}>
            <NavRail />
          </View>
        </View>
      ) : null}
      <View style={styles.fill}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fill: { flex: 1 },
  inlineRail: { justifyContent: "center", paddingLeft: 16 },
});
