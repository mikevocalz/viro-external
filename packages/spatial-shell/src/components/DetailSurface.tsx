import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import Svg, { Path } from "react-native-svg";

import type { SpatialShellTheme } from "../theme/SpatialShellTheme";

/**
 * Props for {@linkcode DetailSurface}.
 *
 * - `cornerRadiusDp`: the surface's corner radius, usually the geometry's
 *   `tokens.cornerRadiusDp`.
 * - `onClose`: Close was pressed.
 */
export interface DetailSurfaceProps {
  readonly title: string;
  readonly theme: SpatialShellTheme;
  readonly cornerRadiusDp: number;
  readonly onClose: () => void;
  readonly children: React.ReactNode;
}

/**
 * Detail content with its header: the title on the leading edge and Close on
 * the trailing edge. The same surface shows in the detail panel on headsets
 * and as a pushed screen on phones.
 */
export function DetailSurface({ title, theme, cornerRadiusDp, onClose, children }: DetailSurfaceProps): React.JSX.Element {
  return (
    <View style={[styles.surface, { backgroundColor: theme.background, borderRadius: cornerRadiusDp }]}>
      <View style={[styles.header, { borderBottomColor: theme.divider }]}>
        <Text style={[styles.title, { color: theme.text }]} accessibilityRole="header" numberOfLines={1}>
          {title}
        </Text>
        <Pressable
          onPress={onClose}
          style={({ pressed }) => [
            styles.close,
            { backgroundColor: pressed ? theme.raisedSurface : theme.cardSurface },
          ]}
          accessibilityRole="button"
          accessibilityLabel={`Close ${title}`}
        >
          <Svg width={20} height={20} viewBox="0 0 24 24">
            <Path d="M18 6 6 18M6 6l12 12" stroke={theme.text} strokeWidth={2} strokeLinecap="round" fill="none" />
          </Svg>
          <Text style={[styles.closeLabel, { color: theme.text }]}>Close</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.body}>{children}</ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  surface: { flex: 1, borderCurve: "continuous", overflow: "hidden" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingStart: 24,
    paddingEnd: 8,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { flex: 1, fontSize: 20, fontWeight: "600", letterSpacing: -0.3 },
  close: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minHeight: 48,
    paddingHorizontal: 16,
    borderRadius: 999,
  },
  closeLabel: { fontSize: 14, fontWeight: "600" },
  body: { padding: 24 },
});
