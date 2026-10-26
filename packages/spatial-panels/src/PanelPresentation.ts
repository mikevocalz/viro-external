import type { PresentationChange } from "./PresentationChange";

/**
 * Where a panel's pixels were shown on the last composed frame.
 *
 * - `pending`: not composed yet (Rive has not published a frame).
 * - `compositor`: shown as a layer.
 * - `evicted`: no layer slot; the scene fallback shows when allowed.
 *
 * @see {@link PresentationChange.presentation}
 */
export type PanelPresentation = "pending" | "compositor" | "evicted";
