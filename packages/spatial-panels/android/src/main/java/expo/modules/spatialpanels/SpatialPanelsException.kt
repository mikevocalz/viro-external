package expo.modules.spatialpanels

import io.github.expo.modules.v2.JavaScriptThrowable

/** A rejection JavaScript sees as an Error with this code. */
class SpatialPanelsException(
  override val code: String,
  message: String,
  cause: Throwable? = null,
) : JavaScriptThrowable(message, cause)
