package expo.modules.spatialpanels

import com.viro.core.RiveCompositorPanel

/** The JavaScript error code for a native creation failure. */
internal fun createErrorCode(error: RiveCompositorPanel.CreateError): String = when (error) {
  RiveCompositorPanel.CreateError.SESSION_UNAVAILABLE -> "COMPOSITOR_UNAVAILABLE"
  RiveCompositorPanel.CreateError.PRODUCER_UNAVAILABLE -> "COMPOSITOR_UNAVAILABLE"
  RiveCompositorPanel.CreateError.CYLINDER_UNAVAILABLE -> "CYLINDER_UNAVAILABLE"
  RiveCompositorPanel.CreateError.DUPLICATE_ID -> "PANEL_DUPLICATE_ID"
  RiveCompositorPanel.CreateError.LAYER_BUDGET_EXCEEDED -> "PANEL_LAYER_BUDGET_EXCEEDED"
  RiveCompositorPanel.CreateError.SWAPCHAIN_FAILED -> "PANEL_SWAPCHAIN_FAILED"
  RiveCompositorPanel.CreateError.INVALID_RIVE_FILE -> "PANEL_INVALID_RIVE_FILE"
  RiveCompositorPanel.CreateError.EMPTY_ID,
  RiveCompositorPanel.CreateError.MISSING_PRODUCER,
  RiveCompositorPanel.CreateError.INVALID_POSE,
  RiveCompositorPanel.CreateError.INVALID_DIMENSIONS,
  RiveCompositorPanel.CreateError.INVALID_PIXEL_SIZE,
  RiveCompositorPanel.CreateError.INVALID_CYLINDER_RADIUS,
  RiveCompositorPanel.CreateError.INVALID_CYLINDER_ANGLE -> "PANEL_INVALID_ARGUMENT"
}
