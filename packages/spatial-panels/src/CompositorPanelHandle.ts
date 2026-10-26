import type { StoreApi } from "zustand/vanilla";

import type { CompositorPanelFallback } from "./CompositorPanelFallback";
import type { FallbackState } from "./fallback/FallbackState";
import type { PanelPointerEvent } from "./PanelPointerEvent";
import type { PanelPose } from "./PanelPose";
import type { PanelSubscription } from "./PanelSubscription";
import type { PresentationChange } from "./PresentationChange";
import type { SpatialPanelsHost } from "./SpatialPanelsHost";
import type { StatusChange } from "./StatusChange";

/**
 * A Rive panel shown as an OpenXR compositor layer, created by
 * {@link SpatialPanelsHost.createCompositorPanel}. Call {@link dispose} when
 * done; it also releases the scene fallback material.
 *
 * Mount {@link CompositorPanelFallback} with this handle inside the Viro
 * scene so the panel stays on screen while it is evicted.
 */
export interface CompositorPanelHandle {
  readonly id: string;
  /** The panel's scene fallback state, for {@link CompositorPanelFallback}. */
  readonly fallback: StoreApi<FallbackState>;
  /** The last presentation. */
  getPresentation(): PresentationChange;
  /** Moves the layer and the fallback mesh. */
  setPose(pose: PanelPose): void;
  /** Shows or hides the panel on both backends. A hidden panel holds no layer slot. */
  setVisible(isVisible: boolean): void;
  /** View-model writes on the artboard's default instance. False if refused. */
  setNumber(path: string, value: number): boolean;
  setBoolean(path: string, value: boolean): boolean;
  setString(path: string, value: string): boolean;
  fireTrigger(path: string): boolean;
  /** Pointer input in panel pixels. False if refused. */
  dispatchPointer(event: PanelPointerEvent): boolean;
  /** Pauses or resumes Rive; after `lost`, `true` rebuilds it. */
  setActive(isActive: boolean): boolean;
  addOnPresentationChangeListener(listener: (change: PresentationChange) => void): PanelSubscription;
  addOnStatusChangeListener(listener: (change: StatusChange) => void): PanelSubscription;
  /** Removes the layer, frees Rive and deletes the fallback material. Idempotent. */
  dispose(): void;
}
