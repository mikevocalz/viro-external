package expo.modules.spatialpanels

import io.github.expo.modules.v2.Record

/** Compositor facts of the current OpenXR session. */
@Record
data class PanelCapabilities(
  val isSessionReady: Boolean,
  val supportsCylinder: Boolean,
  val maxPanels: Int,
  val supportsRive: Boolean,
)
