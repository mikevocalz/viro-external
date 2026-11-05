/**
 * Colors the shell draws with. There are no defaults: every app passes its
 * own theme tokens to {@linkcode SpatialShell}, so no palette is baked in.
 *
 * Any React Native color string works.
 */
export interface SpatialShellTheme {
  /** The main panel's and detail panel's surface, and the window behind them. */
  readonly background: string;
  /**
   * The rail's and tab bar's fill. Also the rail window's
   * `windowBackgroundColor`, so no light edge shows at its rounded corners.
   */
  readonly raisedSurface: string;
  /** The detail header's Close button. */
  readonly cardSurface: string;
  /** The rounded square behind the selected rail destination. */
  readonly indicator: string;
  /** Primary text and the selected tab's label. */
  readonly text: string;
  /** Unselected labels and icons. */
  readonly textMuted: string;
  /** The selected destination's icon. */
  readonly accent: string;
  /** Hairlines: the tab bar's top edge and the detail header's bottom edge. */
  readonly divider: string;
}
