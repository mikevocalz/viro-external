package expo.modules.spatialpanels

import io.github.expo.modules.v2.Enumerable

/** How the Rive artboard fits the panel, in com.viro.core.RiveCompositorPanel.Fit order. */
enum class RiveFit(val value: String) : Enumerable {
  FILL("fill"),
  CONTAIN("contain"),
  COVER("cover"),
  FIT_WIDTH("fit-width"),
  FIT_HEIGHT("fit-height"),
  NONE("none"),
  SCALE_DOWN("scale-down"),
}
