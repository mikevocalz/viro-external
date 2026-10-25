import type { CompositorPanelOptions } from "./CompositorPanelOptions";

/**
 * A backend that may show a compositor panel's pixels.
 *
 * - `compositor`: an OpenXR quad or cylinder layer.
 * - `scene`: a Viro mesh with the same pose, size, pixels and corners, shown
 *   while the layer is evicted.
 *
 * @see {@link CompositorPanelOptions.presentation}
 */
export type PanelBackend = "compositor" | "scene";
