import type { SpatialPanelsError } from "./SpatialPanelsError";

/**
 * Codes of a {@link SpatialPanelsError}.
 *
 * - `COMPOSITOR_UNAVAILABLE`: no OpenXR view, no session, iOS or visionOS, or
 *   Rive could not be built for this session.
 * - `CYLINDER_UNAVAILABLE`: the runtime did not enable cylinder layers.
 * - `PANEL_INVALID_ARGUMENT`: an option is out of range; the message names it.
 * - `PANEL_DUPLICATE_ID`, `PANEL_LAYER_BUDGET_EXCEEDED`, `PANEL_SWAPCHAIN_FAILED`.
 * - `PANEL_INVALID_RIVE_FILE`: the .riv is empty, larger than 64 MiB, or does not start with the `RIVE` signature.
 */
export type SpatialPanelsErrorCode =
  | "COMPOSITOR_UNAVAILABLE"
  | "CYLINDER_UNAVAILABLE"
  | "PANEL_INVALID_ARGUMENT"
  | "PANEL_DUPLICATE_ID"
  | "PANEL_LAYER_BUDGET_EXCEEDED"
  | "PANEL_SWAPCHAIN_FAILED"
  | "PANEL_INVALID_RIVE_FILE";
