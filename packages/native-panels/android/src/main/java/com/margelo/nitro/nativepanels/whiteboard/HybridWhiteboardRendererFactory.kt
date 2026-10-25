package com.margelo.nitro.nativepanels.whiteboard

import com.margelo.nitro.core.Promise
import com.margelo.nitro.nativepanels.HybridWhiteboardRendererFactorySpec
import com.margelo.nitro.nativepanels.HybridWhiteboardRendererSpec
import com.margelo.nitro.nativepanels.WhiteboardRendererOptions

/**
 * Android `WhiteboardRendererFactory`. Every member is static; JS never
 * constructs an instance.
 */
class HybridWhiteboardRendererFactory : HybridWhiteboardRendererFactorySpec() {
  companion object : HybridWhiteboardRendererFactorySpec.Companion {
    override val isAvailable: Boolean
      get() = WhiteboardRendererAvailability.isAvailable

    override fun createRenderer(options: WhiteboardRendererOptions): Promise<HybridWhiteboardRendererSpec> {
      if (!WhiteboardRendererAvailability.isAvailable) {
        return Promise.rejected(UnsupportedOperationException(WhiteboardRendererAvailability.unavailableReason()))
      }
      try {
        val renderer = HybridWhiteboardRenderer(options.toRendererConfig())
        renderer.start()
        return Promise.resolved(renderer)
      } catch (error: IllegalArgumentException) {
        return Promise.rejected(error)
      }
    }
  }
}
