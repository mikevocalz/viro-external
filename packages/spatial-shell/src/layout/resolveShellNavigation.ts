import type { SpatialWindowPlacement } from "../geometry/SpatialWindowSpec";

/**
 * Where the shell's navigation goes.
 *
 * - `rail-window`: the rail in its own window flush left of the main panel
 *   (a Meta Layout SDK window on Horizon OS, the main window's strip on PICO).
 * - `rail-inline`: the same rail as a column on the left inside the main panel.
 * - `bottom-tabs`: the phone tab bar.
 *
 * @see {@linkcode resolveShellNavigation}
 */
export type ShellNavigationPlacement = "rail-window" | "rail-inline" | "bottom-tabs";

/** Material's medium window class starts at 600dp wide: tablets and unfolded foldables. */
export const RAIL_MIN_WIDTH_DP = 600;

/**
 * Input to {@linkcode resolveShellNavigation}.
 *
 * - `isHeadset`: headset hardware or a headset build
 *   ({@linkcode ShellPlatform.isHeadset}).
 * - `railWindow`: the rail window's current placement.
 * - `widthDp`: the window's width, read only off headsets.
 */
export interface ShellNavigationInput {
  readonly isHeadset: boolean;
  readonly railWindow: SpatialWindowPlacement;
  readonly widthDp: number;
}

/**
 * Picks the navigation placement. A headset always gets the rail on the left
 * and never the bottom tab bar, even while the rail window is pending,
 * refused, or the build cannot open one. Tablets and unfolded foldables
 * (at least {@linkcode RAIL_MIN_WIDTH_DP} wide) get the rail inside the
 * window. Phones get the tab bar. Pure.
 */
export function resolveShellNavigation(input: ShellNavigationInput): ShellNavigationPlacement {
  if (input.isHeadset) return input.railWindow === "spatial" ? "rail-window" : "rail-inline";
  return input.widthDp >= RAIL_MIN_WIDTH_DP ? "rail-inline" : "bottom-tabs";
}
