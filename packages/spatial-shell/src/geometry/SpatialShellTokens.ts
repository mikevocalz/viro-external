/**
 * Sizes the spatial shell is built from, in dp. Pass a partial set to
 * {@linkcode createSpatialShellGeometry}; anything omitted takes the value in
 * {@linkcode DEFAULT_SPATIAL_SHELL_TOKENS}.
 *
 * @see {@linkcode SpatialShellGeometry.tokens}
 */
export interface SpatialShellTokens {
  /** The rail's width. */
  readonly railWidthDp: number;
  /** One rail destination's slot height. Keep it at least 48dp, Meta's minimum target. */
  readonly railItemDp: number;
  /** Space above the first destination and below the last one. */
  readonly railPaddingDp: number;
  /** Side of the square that marks the selected rail destination. */
  readonly railIndicatorDp: number;
  /** Corner radius of the selected-destination indicator. */
  readonly indicatorRadiusDp: number;
  /** Corner radius the rail, the PICO main surface and the detail surface draw. */
  readonly cornerRadiusDp: number;
  /** Height of the phone bottom tab bar, above the bottom safe-area inset. */
  readonly tabBarHeightDp: number;
  /**
   * The detail panel's width. Must sit inside {@linkcode PANEL_WIDTH_RANGE_DP}
   * and differ from {@linkcode detailHeightDp}: PICO OS 5 ignores a square
   * launch size.
   */
  readonly detailWidthDp: number;
  /** The detail panel's height. */
  readonly detailHeightDp: number;
  /**
   * The main panel's launch width, the `<layout android:defaultWidth>` the
   * headset manifest declares. With {@linkcode mainHeightDp} it fixes the
   * aspect the main content keeps when the user resizes the panel.
   */
  readonly mainWidthDp: number;
  /** The main panel's launch height. */
  readonly mainHeightDp: number;
}

/**
 * The sizes verified on a Quest 3S and a PICO 4 Ultra (expo-pico #45): a 96dp
 * rail with 72dp destination slots and a 40dp indicator at a 10dp radius, a
 * 420x600dp detail panel, and a 1280x800dp main panel.
 */
export const DEFAULT_SPATIAL_SHELL_TOKENS: SpatialShellTokens = Object.freeze({
  railWidthDp: 96,
  railItemDp: 72,
  railPaddingDp: 12,
  railIndicatorDp: 40,
  indicatorRadiusDp: 10,
  cornerRadiusDp: 24,
  tabBarHeightDp: 64,
  detailWidthDp: 420,
  detailHeightDp: 600,
  mainWidthDp: 1280,
  mainHeightDp: 800,
});
