package com.margelo.nitro.nativepanels.whiteboard

/** Malformed snapshot, diff or overlay JSON. The whole call is rejected. */
internal class BoardParseException(message: String, cause: Throwable? = null) :
  IllegalArgumentException(message, cause)
