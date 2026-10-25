package expo.modules.spatialpanels

import android.os.Handler
import android.os.Looper
import com.facebook.react.bridge.ReactApplicationContext
import com.viro.core.RiveCompositorPanel
import com.viro.core.Texture
import io.github.expo.modules.v2.Event
import io.github.expo.modules.v2.ExpoContext
import io.github.expo.modules.v2.ExpoSharedObject
import io.github.expo.modules.v2.JS
import io.github.expo.modules.v2.SharedObject

/**
 * One Rive compositor panel, owned by JavaScript.
 *
 * Threads: @JS members run on the JS thread. Pose, visibility and dispose are
 * posted by com.viro.core.RiveCompositorPanel to the XR render thread; Rive
 * writes and pointers go to the Rive worker. The fallback texture and the
 * material it is bound to are touched only on the main thread, where the
 * native listener also runs. JS reads the latest presentation and status
 * through volatile snapshots.
 */
@ExpoSharedObject("CompositorPanel")
class CompositorPanel internal constructor(
  context: ExpoContext,
  private val reactContext: ReactApplicationContext,
  @property:JS val id: String,
) : SharedObject(context) {

  /** Presentation changes. JavaScript name: `presentationChange`. */
  @Event
  val onPresentationChange = event<PresentationChange>()

  /** Rive worker state changes and command failures. JavaScript name: `statusChange`. */
  @Event
  val onStatusChange = event<StatusChange>()

  private val mainHandler = Handler(Looper.getMainLooper())

  @Volatile
  private var native: RiveCompositorPanel? = null

  @Volatile
  private var isDisposed = false

  @Volatile
  private var latestPresentation =
    PresentationChange(PanelPresentationKind.PENDING, PanelEvictionReason.NONE, hasFallback = false)

  @Volatile
  private var latestStatus = StatusChange(RivePanelState.INITIALIZING, "")

  // Main thread only.
  private var fallbackMaterialName: String? = null
  private var boundTexture: Texture? = null

  /** The last presentation, for reading right after creation resolves. */
  @JS
  val presentation: PresentationChange
    get() = latestPresentation

  /** The last Rive worker state. */
  @JS
  val status: StatusChange
    get() = latestStatus

  internal val listener = object : RiveCompositorPanel.Listener {
    override fun onPresentationChanged(
      panel: RiveCompositorPanel,
      presentation: RiveCompositorPanel.Presentation,
      reason: RiveCompositorPanel.EvictionReason,
    ) {
      bindFallbackIfReady(panel)
      publishPresentation(
        PanelPresentationKind.entries[presentation.ordinal],
        PanelEvictionReason.entries[reason.ordinal],
      )
    }

    override fun onStatus(panel: RiveCompositorPanel, state: RiveCompositorPanel.State, detail: String) {
      val change = StatusChange(RivePanelState.entries[state.ordinal], detail)
      latestStatus = change
      onStatusChange.emit(change)
    }
  }

  internal fun attach(panel: RiveCompositorPanel) {
    if (isDisposed) {
      panel.dispose()
      return
    }
    native = panel
  }

  /** Moves the layer: xyz metres and an xyzw unit quaternion. */
  @JS
  fun setPose(position: List<Double>, orientation: List<Double>) {
    if (position.size != 3 || orientation.size != 4) {
      throw SpatialPanelsException("PANEL_INVALID_ARGUMENT", "pose needs 3 position and 4 orientation values")
    }
    native?.setPose(position.toFloatValues(), orientation.toFloatValues())
  }

  /** Shows or hides the layer. A hidden panel holds no layer slot. */
  @JS
  fun setVisible(visible: Boolean) {
    native?.setVisible(visible)
  }

  @JS
  fun setNumber(path: String, value: Double): Boolean = native?.setNumber(path, value.toFloat()) ?: false

  @JS
  fun setBoolean(path: String, value: Boolean): Boolean = native?.setBoolean(path, value) ?: false

  @JS
  fun setString(path: String, value: String): Boolean = native?.setString(path, value) ?: false

  @JS
  fun fireTrigger(path: String): Boolean = native?.fireTrigger(path) ?: false

  /** Panel pixels, origin top-left; one pointerId per hand, controller or pen. */
  @JS
  fun dispatchPointer(action: PointerAction, xPx: Double, yPx: Double, pointerId: Int): Boolean {
    val code = when (action) {
      PointerAction.DOWN -> RiveCompositorPanel.POINTER_DOWN
      PointerAction.MOVE -> RiveCompositorPanel.POINTER_MOVE
      PointerAction.UP -> RiveCompositorPanel.POINTER_UP
    }
    return native?.pointer(code, xPx.toFloat(), yPx.toFloat(), pointerId) ?: false
  }

  /** Pauses or resumes Rive; after `lost`, true rebuilds it. */
  @JS
  fun setActive(active: Boolean): Boolean = native?.setActive(active) ?: false

  /**
   * Names the Viro material that should carry the scene fallback texture. The
   * texture goes on it as soon as both exist; the next presentationChange
   * reports hasFallback.
   */
  @JS
  fun bindFallbackMaterial(materialName: String) {
    mainHandler.post {
      if (isDisposed) return@post
      fallbackMaterialName = materialName
      boundTexture = null
      native?.let { bindFallbackIfReady(it) }
      val latest = latestPresentation
      if (latest.hasFallback != (boundTexture != null)) {
        publishPresentation(latest.presentation, latest.reason)
      }
    }
  }

  /** Removes the layer and frees Rive. Idempotent. */
  @JS
  fun dispose() {
    if (isDisposed) return
    isDisposed = true
    val panel = native
    native = null
    panel?.dispose()
    mainHandler.post {
      // The material keeps its own reference to the native texture.
      panel?.fallbackTexture?.dispose()
      boundTexture = null
      fallbackMaterialName = null
    }
  }

  override fun sharedObjectDidRelease() {
    dispose()
  }

  // Main thread.
  private fun bindFallbackIfReady(panel: RiveCompositorPanel) {
    val texture = panel.fallbackTexture ?: return
    val name = fallbackMaterialName ?: return
    if (boundTexture === texture) return
    if (FallbackMaterialBinder.bind(reactContext, name, texture)) {
      boundTexture = texture
    }
  }

  // Main thread.
  private fun publishPresentation(presentation: PanelPresentationKind, reason: PanelEvictionReason) {
    val change = PresentationChange(presentation, reason, hasFallback = boundTexture != null)
    latestPresentation = change
    onPresentationChange.emit(change)
  }
}
