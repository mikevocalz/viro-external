package expo.modules.spatialpanels

import android.util.Log
import com.viro.core.ViroViewOpenXR
import com.viromedia.bridge.module.PerfMonitor
import io.github.expo.modules.v2.ExpoContext
import io.github.expo.modules.v2.react.ReactExpoContext

/**
 * Finds the mounted ViroViewOpenXR. Every VRT3DSceneNavigator registers its
 * view with the bridge's PerfMonitor module; on Quest and PICO that view is a
 * ViroViewOpenXR. Any other view, or none, means no compositor.
 */
internal object OpenXRViewResolver {
  private const val TAG = "ViroSpatialPanels"

  fun resolve(context: ExpoContext): ViroViewOpenXR? {
    val reactContext = (context as? ReactExpoContext)?.reactContext ?: return null
    try {
      return reactContext.getNativeModule(PerfMonitor::class.java)?.view as? ViroViewOpenXR
    } catch (error: RuntimeException) {
      Log.w(TAG, "PerfMonitor lookup failed", error)
      return null
    }
  }
}
