package expo.modules.spatialpanels

import io.github.expo.modules.v2.Enumerable

/** Pointer phase sent to the Rive state machine. */
enum class PointerAction(val value: String) : Enumerable {
  DOWN("down"),
  MOVE("move"),
  UP("up"),
}
