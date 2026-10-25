import type { RivePanel } from "./RivePanel.nitro";

/**
 * Lifecycle state of a {@linkcode RivePanel}.
 *
 * - `initializing`: the panel's render thread is creating its EGL context.
 * - `waiting-for-surface`: ready; Viro has not provided the Surface yet, or
 *   withdrew it. File, artboard, state machine and view-model values are kept.
 * - `active`: drawing into the Surface, only when the state machine advances
 *   or after input, data or lifecycle changes.
 * - `suspended`: the Surface is attached but `setActive(false)` stopped frames.
 * - `lost`: EGL or Rive failed. The next Surface Viro provides retries from
 *   scratch and re-imports the file.
 * - `disposed`: `dispose()` ran. Terminal.
 *
 * @see {@linkcode RivePanel.state}
 * @see {@linkcode RivePanel.addOnStateChangedListener}
 */
export type RivePanelState =
  | "initializing"
  | "waiting-for-surface"
  | "active"
  | "suspended"
  | "lost"
  | "disposed";
