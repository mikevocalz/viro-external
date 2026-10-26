package expo.modules.spatialpanels

import io.github.expo.modules.v2.Record

/**
 * A presentation change. hasFallback is true once the scene fallback texture
 * is bound to the material named by CompositorPanel.bindFallbackMaterial.
 */
@Record
data class PresentationChange(
  val presentation: PanelPresentationKind,
  val reason: PanelEvictionReason,
  val hasFallback: Boolean,
)
