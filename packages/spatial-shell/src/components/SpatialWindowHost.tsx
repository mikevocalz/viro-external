import React from "react";
import { StyleSheet, View } from "react-native";

import { useSpatialWindowHostStore } from "../stores/spatialWindowHostStore";
import { useSpatialShellContext } from "./SpatialShellContext";

/**
 * Renders every hosted window at the main surface's origin. The shell mounts
 * it once, as a direct child of its root.
 *
 * Why the origin (Harlem Might ADR 0005): Meta's `SpatialWindowRootViewGroup`
 * reports touches relative to the promoted window, while React Native's
 * Pressability measures the pressed view in the main surface. A window
 * declared deep in the layout sits far from the origin, so the first move of
 * a controller ray or pinch reads as leaving the press rectangle and cancels
 * the press. At (0, 0) the two coordinate spaces agree and presses complete.
 *
 * Windows render with `fallback: "drop"`, so nothing draws inline at the
 * origin. Renders nothing where the Layout SDK is not linked; on PICO the
 * main window's strip draws attached windows instead.
 */
export function SpatialWindowHost(): React.JSX.Element | null {
  const { runtime } = useSpatialShellContext();
  const windows = useSpatialWindowHostStore((state) => state.windows);
  if (runtime.windowBackend !== "meta-horizon-layout") return null;
  const { Window } = runtime.metaWindows;
  return (
    <View style={styles.origin} pointerEvents="box-none">
      {Object.values(windows).map(({ window, content }) => (
        <Window key={window.label} window={{ ...window, fallback: "drop" }}>
          {content}
        </Window>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  origin: { position: "absolute", left: 0, top: 0, width: 0, height: 0 },
});
