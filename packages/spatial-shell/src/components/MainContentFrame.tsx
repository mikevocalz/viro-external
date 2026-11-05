import React from "react";
import { StyleSheet, View } from "react-native";

import { useMainContentFrameStore } from "../stores/mainContentFrameStore";
import { useSpatialShellContext } from "./SpatialShellContext";

/**
 * Keeps the main panel's content at the panel's launch aspect when the user
 * resizes the panel on a headset.
 *
 * Horizon OS and PICO OS 5 resize the window to any shape and the manifest
 * cannot lock it. This measures the main panel and lays the content out in
 * the largest centred frame at `mainWidthDp / mainHeightDp` that fits,
 * filling the rest with the theme background. The window bounds stay as they
 * are, so the rail window and the detail panel are unaffected. Ported from
 * MoyoLearn's `MainContentFrame` by way of expo-pico #45.
 *
 * With `isFramed` false (phones, tablets, an immersive route that owns the
 * whole surface) the content renders unchanged.
 */
export function MainContentFrame({
  isFramed,
  children,
}: {
  isFramed: boolean;
  children: React.ReactNode;
}): React.JSX.Element {
  const { geometry, theme } = useSpatialShellContext();
  const setHostSize = useMainContentFrameStore((state) => state.setHostSize);
  // Two scalar selectors: a selector returning a new frame object each call
  // would re-render forever.
  const hostWidth = useMainContentFrameStore((state) => state.hostWidth);
  const hostHeight = useMainContentFrameStore((state) => state.hostHeight);
  if (!isFramed) return <View style={styles.fill}>{children}</View>;
  const frame = geometry.fitMainContent(hostWidth, hostHeight);
  return (
    <View
      testID="spatial-shell-main-host"
      style={[styles.host, { backgroundColor: theme.background }]}
      onLayout={({ nativeEvent: { layout } }) => setHostSize(layout.width, layout.height)}
    >
      {/* Hidden until measured, so the content never flashes at the window's shape. */}
      <View
        testID="spatial-shell-main-surface"
        style={
          frame === undefined
            ? [styles.fill, styles.hidden]
            : [styles.surface, { backgroundColor: theme.background }, frame]
        }
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  host: { flex: 1, overflow: "hidden" },
  surface: { position: "absolute", overflow: "hidden" },
  hidden: { opacity: 0 },
});
