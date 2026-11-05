import { fitMainContent, type MainContentRect } from "./fitMainContent";
import { DEFAULT_SPATIAL_SHELL_TOKENS, type SpatialShellTokens } from "./SpatialShellTokens";
import type { SpatialWindowSpec } from "./SpatialWindowSpec";

/**
 * Gap between the rail and the main panel. Measured on a Quest 3S, Horizon OS
 * 207 (Harlem Might ADR 0006): a window anchored `{ parent: "left", child:
 * "right" }` with no offset sits flush with the main window, gap -0.4dp, in
 * two runs. PICO's in-window rail strip leaves the same gap.
 */
export const ATTACHED_WINDOW_GAP_DP = 0;

/** Meta's documented width range for a second activity panel (panel-sizing docs). */
export const PANEL_WIDTH_RANGE_DP = Object.freeze({ min: 384, max: 1440 });

/** The Layout SDK label of the rail window. */
export const RAIL_WINDOW_LABEL = "rail";

/** Layout SDK priority of the rail window, so navigation wins a tethered slot. */
export const RAIL_WINDOW_PRIORITY = 20;

/**
 * Geometry every headset and phone reads, built from
 * {@linkcode SpatialShellTokens} by {@linkcode createSpatialShellGeometry}.
 */
export interface SpatialShellGeometry {
  /** The resolved tokens, defaults filled in. */
  readonly tokens: SpatialShellTokens;
  /**
   * The rail's height for `itemCount` destinations: the slots plus top and
   * bottom padding. Shorter than the main panel for any realistic count.
   *
   * @throws {RangeError} When `itemCount` is not a positive integer.
   */
  railHeightDp(itemCount: number): number;
  /**
   * The rail as a Meta Layout SDK window: outside the main window's physical
   * left edge (`left`/`right` never mirror in RTL), flush, vertically centred,
   * at the main window's depth. `fallback: "drop"` so it never draws at the
   * host's origin; the shell draws the in-panel rail while the window is not
   * placed.
   *
   * @throws {RangeError} When `itemCount` is not a positive integer.
   */
  railWindow(itemCount: number, windowBackgroundColor?: string): SpatialWindowSpec;
  /** Width of the strip a PICO main window reserves for the rail: rail plus gap. */
  readonly railStripWidthDp: number;
  /** The detail panel's launch size, rounded to whole dp. */
  readonly detailPanelSizeDp: Readonly<{ widthDp: number; heightDp: number }>;
  /** Width over height of the main panel's launch size. */
  readonly mainContentAspectRatio: number;
  /** {@linkcode fitMainContent} at {@linkcode mainContentAspectRatio}. */
  fitMainContent(width: number, height: number): MainContentRect | undefined;
}

function assertPositive(name: string, value: number): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`[spatial-shell] ${name} must be a positive number of dp, got ${value}.`);
  }
}

/**
 * Builds the shell's geometry. Ported from `createSpatialShell` in
 * `@expo-pico/spatial` (expo-pico #45), which a Quest 3S and a PICO 4 Ultra
 * ran on 2026-11-04.
 *
 * @example
 * ```ts
 * const geometry = createSpatialShellGeometry({ railWidthDp: 104 });
 * geometry.railWindow(4, theme.railSurface); // label "rail", 104 x 312 dp
 * ```
 *
 * @throws {RangeError} When a token is not positive, the detail width is
 *   outside {@linkcode PANEL_WIDTH_RANGE_DP}, or the detail size is square.
 */
export function createSpatialShellGeometry(
  overrides: Partial<SpatialShellTokens> = {}
): SpatialShellGeometry {
  const tokens: SpatialShellTokens = Object.freeze({ ...DEFAULT_SPATIAL_SHELL_TOKENS, ...overrides });
  for (const [name, value] of Object.entries(tokens)) assertPositive(name, value);
  const { detailWidthDp, detailHeightDp } = tokens;
  if (detailWidthDp < PANEL_WIDTH_RANGE_DP.min || detailWidthDp > PANEL_WIDTH_RANGE_DP.max) {
    throw new RangeError(
      `[spatial-shell] detailWidthDp ${detailWidthDp} is outside Meta's ` +
        `${PANEL_WIDTH_RANGE_DP.min}-${PANEL_WIDTH_RANGE_DP.max}dp panel range.`
    );
  }
  if (detailWidthDp === detailHeightDp) {
    throw new RangeError(
      `[spatial-shell] the detail panel is ${detailWidthDp}x${detailHeightDp}dp. PICO OS 5 ` +
        "ignores a square launch size; make width and height differ."
    );
  }

  const railHeightDp = (itemCount: number): number => {
    if (!Number.isInteger(itemCount) || itemCount < 1) {
      throw new RangeError(`[spatial-shell] the rail needs at least one destination, got ${itemCount}.`);
    }
    return itemCount * tokens.railItemDp + 2 * tokens.railPaddingDp;
  };

  const mainContentAspectRatio = tokens.mainWidthDp / tokens.mainHeightDp;

  return {
    tokens,
    railHeightDp,
    railWindow: (itemCount, windowBackgroundColor) => {
      const window: SpatialWindowSpec = {
        label: RAIL_WINDOW_LABEL,
        windowWidth: tokens.railWidthDp,
        windowHeight: railHeightDp(itemCount),
        priority: RAIL_WINDOW_PRIORITY,
        promotable: true,
        fallback: "drop",
        anchor: { parent: "left", child: "right" },
      };
      return windowBackgroundColor === undefined ? window : { ...window, windowBackgroundColor };
    },
    railStripWidthDp: tokens.railWidthDp + ATTACHED_WINDOW_GAP_DP,
    detailPanelSizeDp: Object.freeze({
      widthDp: Math.round(detailWidthDp),
      heightDp: Math.round(detailHeightDp),
    }),
    mainContentAspectRatio,
    fitMainContent: (width, height) => fitMainContent(width, height, mainContentAspectRatio),
  };
}
