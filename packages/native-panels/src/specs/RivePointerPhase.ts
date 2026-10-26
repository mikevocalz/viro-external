import type { RivePanel } from "./RivePanel.nitro";

/**
 * Phase of one pointer sample sent to {@linkcode RivePanel.dispatchPointer}.
 * Rive's state machine has no cancel input, so `cancel` moves the pressed
 * pointer far off the artboard and releases it there: shapes see the
 * pointer leave and no click fires. The position passed with `cancel` is
 * ignored.
 */
export type RivePointerPhase = "down" | "move" | "up" | "cancel";
