package expo.modules.spatialpanels

import com.viro.core.RiveCompositorPanel

/** Builds the virocore config. Pose arrays must already be checked for length. */
internal fun CompositorPanelOptions.toNativeConfig(riveFile: ByteArray): RiveCompositorPanel.Config =
  RiveCompositorPanel.Config(id, riveFile)
    .shape(RiveCompositorPanel.Shape.values()[shape.ordinal])
    .pose(position.toFloatValues(), orientation.toFloatValues())
    .size(widthM.toFloat(), heightM.toFloat(), widthPx, heightPx)
    .cylinderRadius(cylinderRadiusM.toFloat())
    .cornerRadius(cornerRadiusM.toFloat())
    .visible(visible)
    .fit(RiveCompositorPanel.Fit.values()[fit.ordinal])
    .alignment(alignmentX.toFloat(), alignmentY.toFloat())
    .clearColor(clearColor.toLong().toInt())
    .maxFrameRate(maxFrameRateHz.toFloat())
    .artboard(artboard)
    .stateMachine(stateMachine)
