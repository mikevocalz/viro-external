package expo.modules.spatialpanels

import io.github.expo.modules.v2.Enumerable

/** State of the panel's Rive worker, in com.viro.core.RiveCompositorPanel.State order. */
enum class RivePanelState(val value: String) : Enumerable {
  INITIALIZING("initializing"),
  WAITING_FOR_SURFACE("waiting-for-surface"),
  ACTIVE("active"),
  SUSPENDED("suspended"),
  LOST("lost"),
  DISPOSED("disposed"),
}
