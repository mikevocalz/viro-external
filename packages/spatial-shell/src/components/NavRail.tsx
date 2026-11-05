import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { Rect } from "react-native-svg";

import type { ShellDestination } from "./ShellDestination";
import { useSpatialShellContext } from "./SpatialShellContext";

const ICON_SIZE_DP = 22;

function RailItem({
  destination,
  isSelected,
  onPress,
}: {
  destination: ShellDestination;
  isSelected: boolean;
  onPress: () => void;
}): React.JSX.Element {
  const { geometry, theme } = useSpatialShellContext();
  const { railItemDp, railIndicatorDp, indicatorRadiusDp } = geometry.tokens;
  const tint = isSelected ? theme.text : theme.textMuted;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.item, { height: railItemDp }, pressed && styles.itemPressed]}
      accessibilityRole="tab"
      accessibilityState={{ selected: isSelected }}
      accessibilityLabel={destination.title}
    >
      <View style={[styles.indicator, { width: railIndicatorDp, height: railIndicatorDp }]}>
        {/*
          An SVG rounded square, not a View background with borderRadius: in a
          Meta Layout SDK rail window the View drew rounded on first render and
          lost its radius once the selection moved (Quest 3S, expo-pico #45).
        */}
        {isSelected ? (
          <Svg style={StyleSheet.absoluteFill} width={railIndicatorDp} height={railIndicatorDp}>
            <Rect
              width={railIndicatorDp}
              height={railIndicatorDp}
              rx={indicatorRadiusDp}
              ry={indicatorRadiusDp}
              fill={theme.indicator}
            />
          </Svg>
        ) : null}
        {destination.renderIcon({
          color: isSelected ? theme.accent : tint,
          size: ICON_SIZE_DP,
          isSelected,
        })}
      </View>
      <Text style={[styles.label, { color: tint }]} numberOfLines={1}>
        {destination.title}
      </Text>
    </Pressable>
  );
}

/**
 * The navigation rail: the phone tab bar's destinations as a narrow vertical
 * panel. It fills whatever holds it: the rail window on Horizon OS, the main
 * window's strip on PICO, or a column inside the main panel. It has no
 * outline, no close button and no grab bar; it reads as its own surface from
 * its raised fill and rounded corners, and never closes or moves on its own.
 * Ported from expo-pico #45 (`example/src/ui/NavRail.tsx`), itself from
 * Harlem Might's rail window (ADR 0005).
 */
export function NavRail(): React.JSX.Element {
  const { geometry, theme, destinations, activeDestinationId, onSelectDestination } =
    useSpatialShellContext();
  return (
    <View
      style={[
        styles.rail,
        {
          paddingVertical: geometry.tokens.railPaddingDp,
          backgroundColor: theme.raisedSurface,
          borderRadius: geometry.tokens.cornerRadiusDp,
        },
      ]}
      accessibilityRole="tablist"
    >
      {destinations.map((destination) => (
        <RailItem
          key={destination.id}
          destination={destination}
          isSelected={destination.id === activeDestinationId}
          onPress={() => onSelectDestination(destination.id)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    flex: 1,
    alignItems: "stretch",
    justifyContent: "center",
    borderCurve: "continuous",
  },
  item: { alignItems: "center", justifyContent: "center", gap: 4 },
  itemPressed: { opacity: 0.7 },
  indicator: { alignItems: "center", justifyContent: "center" },
  label: { fontSize: 12, fontWeight: "600" },
});
