package expo.modules.spatialpanels

import io.github.expo.modules.v2.Enumerable

/** Why a panel lost its compositor layer. */
enum class PanelEvictionReason(val value: String) : Enumerable {
  NONE("none"),
  LAYER_BUDGET("layer-budget"),
  LAYER_LIMIT_EXCEEDED("layer-limit-exceeded"),
}
