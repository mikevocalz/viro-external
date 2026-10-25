import type { RivePanel } from "../specs/RivePanel.nitro";
import type { RivePanelPointerEvent } from "./RivePanelPointerEvent";
import type { ViroNativeRivePanel } from "./ViroNativeRivePanel";

/**
 * Ref handle of {@linkcode ViroNativeRivePanel} on the native route. On the
 * `ViroRivePanel` route the ref receives `ViroRivePanelHandle` instead; tell
 * them apart with `"native" in handle`.
 */
export interface NativeRivePanelHandle {
  readonly native: true;
  /** The panel once created, else `null`. */
  readonly panel: RivePanel | null;
  readonly surfaceId: number;
  readonly materialName: string;
  /**
   * Sends one board input event (for example from `createBoardInputRouter`)
   * to the panel. Dropped before the panel exists.
   */
  dispatchPointer(event: RivePanelPointerEvent): void;
}
