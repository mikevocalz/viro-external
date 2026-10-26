import type { PresentationChange } from "./PresentationChange";

/**
 * Why a panel lost its layer.
 *
 * - `layer-budget`: no free slot this frame.
 * - `layer-limit-exceeded`: the runtime rejected a frame for too many layers
 *   and the renderer lowered its layer cap.
 *
 * @see {@link PresentationChange.reason}
 */
export type PanelEvictionReason = "none" | "layer-budget" | "layer-limit-exceeded";
