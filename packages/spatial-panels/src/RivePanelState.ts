import type { CompositorPanelHandle } from "./CompositorPanelHandle";
import type { StatusChange } from "./StatusChange";

/**
 * State of a panel's Rive worker. After `lost`,
 * {@link CompositorPanelHandle.setActive}(true) rebuilds it.
 *
 * @see {@link StatusChange.state}
 */
export type RivePanelState = "initializing" | "waiting-for-surface" | "active" | "suspended" | "lost" | "disposed";
