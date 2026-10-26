import type { CompositorPanelHandle } from "./CompositorPanelHandle";
import type { RivePanelState } from "./RivePanelState";

/**
 * A Rive worker state change. `detail` is non-empty when a command failed
 * without changing the state (bad .riv, unknown artboard or property).
 *
 * @see {@link CompositorPanelHandle.addOnStatusChangeListener}
 */
export interface StatusChange {
  readonly state: RivePanelState;
  readonly detail: string;
}
