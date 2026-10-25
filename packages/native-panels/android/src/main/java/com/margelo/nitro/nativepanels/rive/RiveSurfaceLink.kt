package com.margelo.nitro.nativepanels.rive

import android.view.Surface
import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip
import com.viromedia.bridge.canvas.CanvasSurfaces

/**
 * Moves the Viro Surface for one surface id into a native RivePanel. Created
 * and closed from C++ (RiveSurfaceLink.cpp); `nativeHandle` points at the C++
 * side's target and stays valid until [close] returns.
 *
 * The lock makes [close] wait for a callback that is already inside native
 * code, and keeps later callbacks out, so C++ can free the target right after
 * [close]. The native calls made under it are short: attaching enqueues a
 * command, and surfaceLost waits only until the panel's render thread has
 * dropped its EGL surface and window reference. That wait has to finish
 * before onSurfaceRevoked returns, because Viro may release the Surface then.
 */
@DoNotStrip
@Keep
class RiveSurfaceLink private constructor(private var nativeHandle: Long) : CanvasSurfaces.Listener {
  private val lock = Any()
  private var closed = false
  private var subscription: CanvasSurfaces.Subscription? = null

  override fun onSurfaceProvided(entry: CanvasSurfaces.Entry) {
    synchronized(lock) {
      if (closed) return
      nativeSurfaceProvided(nativeHandle, entry.surface, entry.width, entry.height)
    }
  }

  override fun onSurfaceRevoked(entry: CanvasSurfaces.Entry) {
    synchronized(lock) {
      if (closed) return
      nativeSurfaceRevoked(nativeHandle)
    }
  }

  /** Ends the subscription. No native call starts after this returns. Idempotent. */
  @DoNotStrip
  @Keep
  fun close() {
    val ending: CanvasSurfaces.Subscription?
    synchronized(lock) {
      if (closed) return
      closed = true
      nativeHandle = 0L
      ending = subscription
      subscription = null
    }
    ending?.close()
  }

  private external fun nativeSurfaceProvided(handle: Long, surface: Surface, width: Int, height: Int)

  private external fun nativeSurfaceRevoked(handle: Long)

  companion object {
    private const val REGISTRY = "com.viromedia.bridge.canvas.CanvasSurfaces"

    /** False when the app's Viro build predates the public CanvasSurfaces registry. */
    @JvmStatic
    @DoNotStrip
    @Keep
    fun isRegistryAvailable(): Boolean {
      return try {
        Class.forName(REGISTRY)
        true
      } catch (missing: ClassNotFoundException) {
        false
      }
    }

    /**
     * Subscribes to [surfaceId]. A Surface Viro already provides is delivered
     * before or shortly after this returns, possibly on another thread.
     */
    @JvmStatic
    @DoNotStrip
    @Keep
    fun subscribe(surfaceId: Int, nativeHandle: Long): RiveSurfaceLink {
      require(nativeHandle != 0L) { "nativeHandle must not be 0" }
      val link = RiveSurfaceLink(nativeHandle)
      val registration = CanvasSurfaces.addListener(surfaceId, link)
      synchronized(link.lock) {
        if (link.closed) {
          registration.close()
        } else {
          link.subscription = registration
        }
      }
      return link
    }
  }
}
