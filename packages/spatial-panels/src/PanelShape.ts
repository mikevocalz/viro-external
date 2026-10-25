import type { CompositorPanelOptions } from "./CompositorPanelOptions";
import type { PanelHostCapabilities } from "./PanelHostCapabilities";

/**
 * Compositor layer geometry of a panel. `cylinder` needs
 * {@link PanelHostCapabilities.supportsCylinder}.
 *
 * @see {@link CompositorPanelOptions.shape}
 */
export type PanelShape = "quad" | "cylinder";
