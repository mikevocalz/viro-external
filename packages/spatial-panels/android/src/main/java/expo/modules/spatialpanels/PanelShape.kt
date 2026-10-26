package expo.modules.spatialpanels

import io.github.expo.modules.v2.Enumerable

/** Compositor layer geometry. */
enum class PanelShape(val value: String) : Enumerable {
  QUAD("quad"),
  CYLINDER("cylinder"),
}
