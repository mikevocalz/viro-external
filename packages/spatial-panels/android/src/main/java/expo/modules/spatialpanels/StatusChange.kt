package expo.modules.spatialpanels

import io.github.expo.modules.v2.Record

/** A Rive worker state change; detail is non-empty when a command failed. */
@Record
data class StatusChange(
  val state: RivePanelState,
  val detail: String,
)
