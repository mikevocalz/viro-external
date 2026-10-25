import type { CompositorPanelHandle } from "./CompositorPanelHandle";

/**
 * A pointer sample in panel pixels, origin top-left. Use one `pointerId` per
 * hand, controller and pen. A press that starts in a transparent corner is
 * dropped.
 *
 * @see {@link CompositorPanelHandle.dispatchPointer}
 */
export interface PanelPointerEvent {
  readonly action: "down" | "move" | "up";
  readonly xPx: number;
  readonly yPx: number;
  readonly pointerId: number;
}
