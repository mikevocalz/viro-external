import type { CompositorPanelHandle } from "./CompositorPanelHandle";

/**
 * Removes a listener. Idempotent.
 *
 * @see {@link CompositorPanelHandle.addOnPresentationChangeListener}
 */
export interface PanelSubscription {
  remove(): void;
}
