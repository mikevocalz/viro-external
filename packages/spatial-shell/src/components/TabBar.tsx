import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useSpatialShellContext } from "./SpatialShellContext";

const ICON_SIZE_DP = 22;

/**
 * The phone's bottom tab bar: the same destinations the rail shows. Never
 * rendered on a headset. Needs a `SafeAreaProvider` above the shell.
 */
export function TabBar(): React.JSX.Element {
  const { geometry, theme, destinations, activeDestinationId, onSelectDestination } =
    useSpatialShellContext();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.bar,
        { paddingBottom: insets.bottom, backgroundColor: theme.raisedSurface, borderTopColor: theme.divider },
      ]}
      accessibilityRole="tablist"
    >
      {destinations.map((destination) => {
        const isSelected = destination.id === activeDestinationId;
        return (
          <Pressable
            key={destination.id}
            onPress={() => onSelectDestination(destination.id)}
            style={({ pressed }) => [
              styles.item,
              { height: geometry.tokens.tabBarHeightDp },
              pressed && styles.itemPressed,
            ]}
            accessibilityRole="tab"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={destination.title}
          >
            {destination.renderIcon({
              color: isSelected ? theme.accent : theme.textMuted,
              size: ICON_SIZE_DP,
              isSelected,
            })}
            <Text style={[styles.label, { color: isSelected ? theme.text : theme.textMuted }]}>
              {destination.title}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", borderTopWidth: StyleSheet.hairlineWidth },
  item: { flex: 1, alignItems: "center", justifyContent: "center", gap: 4 },
  itemPressed: { opacity: 0.7 },
  label: { fontSize: 12, fontWeight: "600" },
});
