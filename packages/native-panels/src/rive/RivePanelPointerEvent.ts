import type { createRivePanelPointerSink } from "./createRivePanelPointerSink";

/**
 * The fields {@linkcode createRivePanelPointerSink} reads from a board input
 * event. `QuickDrawPointerEvent` from `@viro-external/xr-contract` (what
 * `createBoardInputRouter` emits for Viro rays and the Muse pen) has this shape.
 */
export interface RivePanelPointerEvent {
  phase: "hover" | "down" | "move" | "up" | "cancel" | "leave";
  /** Stable id per hand, controller or pen. Integer. */
  pointerId: number;
  /** Position on the panel, `[0, 0]` top-left to `[1, 1]` bottom-right. */
  uv: readonly [number, number];
}
