import type { MetaAnchorPoint } from "@viro-external/meta-layout";

import { ATTACHED_WINDOW_GAP_DP } from "./createSpatialShellGeometry";
import type { SpatialWindowSpec } from "./SpatialWindowSpec";

/**
 * Size of a window drawn in the PICO main window's strip.
 *
 * @see {@linkcode attachedWindowFrame}
 */
export interface AttachedWindowFrame {
  readonly widthDp: number;
  readonly heightDp: number;
  readonly gapDp: number;
}

function horizontalOf(point: MetaAnchorPoint): string | undefined {
  return typeof point === "string" ? point : point.horizontal;
}

/**
 * The in-window frame for a window Meta attaches flush outside the main
 * window's left edge, or undefined for any other window.
 *
 * PICO OS 5 cannot attach one activity window to another, so an attached
 * window opened as its own panel would float wherever the user looks. Drawn
 * in a strip of the main window instead, it moves with the main panel.
 */
export function attachedWindowFrame(window: SpatialWindowSpec): AttachedWindowFrame | undefined {
  const anchor = window.anchor;
  if (typeof anchor !== "object" || !("parent" in anchor)) return undefined;
  if (window.offset !== undefined) return undefined;
  if (horizontalOf(anchor.parent) !== "left" || horizontalOf(anchor.child) !== "right") return undefined;
  if (typeof window.windowWidth !== "number" || typeof window.windowHeight !== "number") return undefined;
  return {
    widthDp: Math.round(window.windowWidth),
    heightDp: Math.round(window.windowHeight),
    gapDp: ATTACHED_WINDOW_GAP_DP,
  };
}
