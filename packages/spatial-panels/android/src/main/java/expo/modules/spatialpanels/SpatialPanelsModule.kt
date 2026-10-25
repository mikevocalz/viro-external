package expo.modules.spatialpanels

import com.viro.core.RiveCompositorPanel
import io.github.expo.modules.v2.ExpoModule
import io.github.expo.modules.v2.JS
import io.github.expo.modules.v2.Module
import io.github.expo.modules.v2.TypedArray
import io.github.expo.modules.v2.async.Promise
import io.github.expo.modules.v2.react.ReactExpoContext

/**
 * OpenXR compositor panels for the mounted ViroViewOpenXR (Android GLES,
 * Quest and PICO). JavaScript name: `ViroSpatialPanels`.
 */
@ExpoModule("ViroSpatialPanels", classes = [CompositorPanel::class])
class SpatialPanelsModule : Module() {

  /** Session facts; all false and zero when no OpenXR view is mounted. */
  @JS
  fun getCapabilities(): Promise<PanelCapabilities> = Promise { resolve, _ ->
    val view = OpenXRViewResolver.resolve(context)
    if (view == null) {
      resolve(PanelCapabilities(isSessionReady = false, supportsCylinder = false, maxPanels = 0, supportsRive = false))
      return@Promise
    }
    RiveCompositorPanel.getCapabilities(view) { capabilities ->
      resolve(
        PanelCapabilities(
          isSessionReady = capabilities.isSessionReady,
          supportsCylinder = capabilities.supportsCylinder,
          maxPanels = capabilities.maxPanels,
          supportsRive = capabilities.supportsRive,
        ),
      )
    }
  }

  /**
   * Creates a Rive panel as a compositor layer. Resolves once the layer is
   * registered and the .riv is queued; rejects with COMPOSITOR_UNAVAILABLE,
   * CYLINDER_UNAVAILABLE, PANEL_INVALID_ARGUMENT, PANEL_DUPLICATE_ID,
   * PANEL_LAYER_BUDGET_EXCEEDED, PANEL_SWAPCHAIN_FAILED or
   * PANEL_INVALID_RIVE_FILE.
   */
  @JS
  fun createRiveCompositorPanel(options: CompositorPanelOptions, riveFile: TypedArray): Promise<CompositorPanel> {
    // Copied now, on the JS thread: the typed array is JS memory.
    val bytes = ByteArray(riveFile.byteLength)
    riveFile.read(bytes, 0, bytes.size)
    return Promise { resolve, reject ->
      if (options.position.size != 3 || options.orientation.size != 4) {
        throw SpatialPanelsException("PANEL_INVALID_ARGUMENT", "pose needs 3 position and 4 orientation values")
      }
      val reactContext = (context as? ReactExpoContext)?.reactContext
      val view = OpenXRViewResolver.resolve(context)
      if (reactContext == null || view == null) {
        throw SpatialPanelsException("COMPOSITOR_UNAVAILABLE", "no ViroViewOpenXR is mounted; compositor panels need an OpenXR scene navigator")
      }
      val panel = CompositorPanel(context, reactContext, options.id)
      val callback = object : RiveCompositorPanel.CreateCallback {
        override fun onCreated(native: RiveCompositorPanel) {
          panel.attach(native)
          resolve(panel)
        }

        override fun onFailed(error: RiveCompositorPanel.CreateError, message: String) {
          reject(SpatialPanelsException(createErrorCode(error), message))
        }
      }
      try {
        RiveCompositorPanel.create(view, options.toNativeConfig(bytes), panel.listener, callback)
      } catch (error: IllegalArgumentException) {
        throw SpatialPanelsException("PANEL_INVALID_ARGUMENT", error.message ?: "invalid panel options", error)
      } catch (error: IllegalStateException) {
        throw SpatialPanelsException("COMPOSITOR_UNAVAILABLE", error.message ?: "OpenXR renderer unavailable", error)
      }
    }
  }
}
