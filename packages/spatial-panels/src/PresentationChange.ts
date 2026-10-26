import type { CompositorPanelHandle } from "./CompositorPanelHandle";
import type { PanelEvictionReason } from "./PanelEvictionReason";
import type { PanelPresentation } from "./PanelPresentation";

/**
 * A change of a panel's presentation. An evicted panel returns to
 * `compositor` by itself when a layer slot frees; the handle stays usable.
 *
 * @see {@link CompositorPanelHandle.addOnPresentationChangeListener}
 */
export interface PresentationChange {
  readonly presentation: PanelPresentation;
  readonly reason: PanelEvictionReason;
  /** The scene fallback texture is bound to the panel's material. */
  readonly hasFallback: boolean;
}
