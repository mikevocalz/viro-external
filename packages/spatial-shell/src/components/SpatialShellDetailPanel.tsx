import React from "react";
import { StyleSheet, View } from "react-native";

import { DEFAULT_SPATIAL_SHELL_TOKENS } from "../geometry/SpatialShellTokens";
import { useSpatialShellStore } from "../stores/shellStore";
import type { SpatialShellTheme } from "../theme/SpatialShellTheme";
import { DetailSurface } from "./DetailSurface";

/**
 * Props for {@linkcode SpatialShellDetailPanel}.
 *
 * - `renderDetail`: the title and body for a selected detail id.
 * - `cornerRadiusDp`: defaults to the shell's default corner radius.
 */
export interface SpatialShellDetailPanelProps {
  readonly theme: SpatialShellTheme;
  readonly renderDetail: (id: string) => { title: string; content: React.ReactNode };
  readonly cornerRadiusDp?: number;
}

/**
 * The detail panel's own surface. Register it under the
 * {@linkcode SpatialShellDetailConfig.componentName} with `AppRegistry` at
 * module scope, before the panel activity can ask for it:
 *
 * @example
 * ```ts
 * AppRegistry.registerComponent("AppDetailPanel", () => () => (
 *   <SpatialShellDetailPanel theme={theme} renderDetail={renderDetail} />
 * ));
 * ```
 *
 * It is a separate React root on the main window's JS runtime, so it reads
 * the selection from the shell store; Close clears it and the shell closes
 * the panel.
 */
export function SpatialShellDetailPanel({
  theme,
  renderDetail,
  cornerRadiusDp = DEFAULT_SPATIAL_SHELL_TOKENS.cornerRadiusDp,
}: SpatialShellDetailPanelProps): React.JSX.Element {
  const selectedDetailId = useSpatialShellStore((state) => state.selectedDetailId);
  const clearDetail = useSpatialShellStore((state) => state.clearDetail);
  if (selectedDetailId === undefined) {
    return <View style={[styles.fill, { backgroundColor: theme.background, borderRadius: cornerRadiusDp }]} />;
  }
  const { title, content } = renderDetail(selectedDetailId);
  return (
    <DetailSurface title={title} theme={theme} cornerRadiusDp={cornerRadiusDp} onClose={clearDetail}>
      {content}
    </DetailSurface>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
