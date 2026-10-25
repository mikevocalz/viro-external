import type { RivePanel } from "./RivePanel.nitro";

/**
 * Phase of one pointer sample sent to {@linkcode RivePanel.dispatchPointer}.
 * `cancel` ends the press like `up` at the given position, because Rive's
 * state machine has no cancel input.
 */
export type RivePointerPhase = "down" | "move" | "up" | "cancel";
