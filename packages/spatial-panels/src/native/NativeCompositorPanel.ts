import type { PanelEvictionReason } from "../PanelEvictionReason";
import type { PanelPresentation } from "../PanelPresentation";
import type { RivePanelState } from "../RivePanelState";

/** Payload of the native `presentationChange` event. */
export interface NativePresentationChange {
  presentation: PanelPresentation;
  reason: PanelEvictionReason;
  hasFallback: boolean;
}

/** Payload of the native `statusChange` event. */
export interface NativeStatusChange {
  state: RivePanelState;
  detail: string;
}

/** Events of the native shared object. */
export interface NativeCompositorPanelEvents {
  presentationChange: (event: NativePresentationChange) => void;
  statusChange: (event: NativeStatusChange) => void;
}

/**
 * The `CompositorPanel` shared object of the `ViroSpatialPanels` Expo module
 * (android/.../CompositorPanel.kt). Internal: callers use the handle.
 */
export interface NativeCompositorPanel {
  readonly id: string;
  readonly presentation: NativePresentationChange;
  readonly status: NativeStatusChange;
  addListener<Name extends keyof NativeCompositorPanelEvents>(
    eventName: Name,
    listener: NativeCompositorPanelEvents[Name],
  ): { remove(): void };
  setPose(position: number[], orientation: number[]): void;
  setVisible(visible: boolean): void;
  setNumber(path: string, value: number): boolean;
  setBoolean(path: string, value: boolean): boolean;
  setString(path: string, value: string): boolean;
  fireTrigger(path: string): boolean;
  dispatchPointer(action: "down" | "move" | "up", xPx: number, yPx: number, pointerId: number): boolean;
  setActive(active: boolean): boolean;
  bindFallbackMaterial(materialName: string): void;
  dispose(): void;
}
