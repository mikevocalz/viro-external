package expo.modules.spatialpanels

import io.github.expo.modules.v2.Enumerable

/** Where a panel's pixels were shown on the last composed frame. */
enum class PanelPresentationKind(val value: String) : Enumerable {
  PENDING("pending"),
  COMPOSITOR("compositor"),
  EVICTED("evicted"),
}
