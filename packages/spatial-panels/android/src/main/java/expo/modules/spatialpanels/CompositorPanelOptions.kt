package expo.modules.spatialpanels

import io.github.expo.modules.v2.Record

/**
 * Creation parameters for a Rive compositor panel. Sizes are metres, pixel
 * sizes 16 to 4096, the pose is xyz plus an xyzw unit quaternion in the
 * OpenXR app space (the same frame as the Viro scene).
 */
@Record
data class CompositorPanelOptions(
  val id: String,
  val shape: PanelShape = PanelShape.QUAD,
  val position: List<Double>,
  val orientation: List<Double>,
  val widthM: Double,
  val heightM: Double,
  val widthPx: Int,
  val heightPx: Int,
  val cylinderRadiusM: Double = 0.0,
  val cornerRadiusM: Double = 0.0,
  val visible: Boolean = true,
  val artboard: String = "",
  val stateMachine: String = "",
  val fit: RiveFit = RiveFit.CONTAIN,
  val alignmentX: Double = 0.0,
  val alignmentY: Double = 0.0,
  /** Straight 0xAARRGGBB, as a JS number so alpha above 0x7F fits. */
  val clearColor: Double = 0.0,
  val maxFrameRateHz: Double = 72.0,
)
