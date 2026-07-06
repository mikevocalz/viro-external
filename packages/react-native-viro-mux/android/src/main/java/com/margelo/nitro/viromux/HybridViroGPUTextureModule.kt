package com.margelo.nitro.viromux

import android.os.Handler
import android.os.Looper
import android.util.Log
import android.view.Surface
import android.view.View
import android.view.ViewGroup
import androidx.annotation.Keep
import com.facebook.proguard.annotations.DoNotStrip
import com.margelo.nitro.NitroModules
import com.viro.core.ExternalSurfaceTexture
import com.viro.core.Material
import com.viro.core.ViroView
import com.viromedia.bridge.module.MaterialManager
import com.viromedia.bridge.module.PerfMonitor
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.atomic.AtomicInteger

/**
 * Android implementation of the external GPU texture bridge
 * (`src/spec/ViroGPUTextureModule.nitro.ts`).
 *
 * v1 implements the `surface-producer` path (doc/TextureBridge.md):
 *
 *  1. `registerExternalTexture` allocates a handle id synchronously and posts
 *     the actual binding to the main thread (the renderer discovers itself
 *     asynchronously).
 *  2. Binding resolves the active [ViroView] (via the bridge's PerfMonitor
 *     module, which every VRT scene navigator registers its ViroView with;
 *     falls back to a decor-view walk), creates a
 *     [com.viro.core.ExternalSurfaceTexture] (SurfaceTexture + Surface
 *     created on the Viro render thread, pumped per-frame by the VideoSink
 *     frame listener), and binds it to the named material's diffuse slot via
 *     [Material.setDiffuseTexture].
 *  3. The producer-facing [Surface] is published to [ViroGPUTextureSurfaces]
 *     under the handle id.
 *
 * `updateTexture` is a documented no-op on this path: the renderer calls
 * SurfaceTexture.updateTexImage() every rendered frame already (VideoSink
 * pattern, ViroViewOpenXR.onDrawFrame), and XR renders continuously.
 */
@DoNotStrip
@Keep
class HybridViroGPUTextureModule : HybridViroGPUTextureModuleSpec() {

    private class Entry(
        val materialName: String,
        val width: Int,
        val height: Int,
    ) {
        @Volatile var texture: ExternalSurfaceTexture? = null
        @Volatile var boundMaterial: Material? = null
        @Volatile var surfaceReady = false
        @Volatile var released = false
    }

    private val entries = ConcurrentHashMap<Int, Entry>()
    private val mainHandler = Handler(Looper.getMainLooper())

    override fun registerExternalTexture(
        materialName: String,
        source: NitroExternalTextureSource
    ): NitroExternalTextureHandle {
        if (source.kind != ExternalTextureKind.SURFACE_PRODUCER) {
            throw IllegalArgumentException(
                "ViroGPUTexture[Android]: kind '${source.kind}' is not implemented in v1 — " +
                "only 'surface-producer' is. A raw GL texture name from a foreign EGL context " +
                "cannot be imported without context sharing (see doc/TextureBridge.md)."
            )
        }
        val width = source.width.toInt()
        val height = source.height.toInt()
        require(width > 0 && height > 0) {
            "ViroGPUTexture[Android]: invalid size ${width}x${height} for material '$materialName'"
        }
        if (source.colorSpace == ExternalTextureColorSpace.LINEAR) {
            Log.w(TAG, "colorSpace 'linear' requested for '$materialName' — the v1 " +
                    "surface-producer substrate is created sRGB; treating as 'srgb'.")
        }

        val id = nextId.getAndIncrement()
        val entry = Entry(materialName, width, height)
        entries[id] = entry
        mainHandler.post { bind(id, entry, BIND_ATTEMPTS) }

        return NitroExternalTextureHandle(
            id = id.toDouble(),
            kind = source.kind,
            width = source.width,
            height = source.height,
            colorSpace = source.colorSpace,
            nativeToken = id.toDouble(),
        )
    }

    override fun updateTexture(id: Double) {
        // No-op on the surface-producer path: the VideoSink frame listener
        // calls SurfaceTexture.updateTexImage() on the render thread every
        // frame, and the OpenXR renderer renders continuously.
    }

    override fun releaseTexture(id: Double) {
        val key = id.toInt()
        val entry = entries.remove(key) ?: return
        entry.released = true
        ViroGPUTextureSurfaces.remove(key)
        mainHandler.post {
            try {
                // Unbind from the material if we are still its diffuse texture,
                // then release the renderer-side wrapper. The producer's own
                // GPU resources are untouched (it only ever saw a Surface).
                val material = entry.boundMaterial
                val texture = entry.texture
                if (material != null && texture != null && material.diffuseTexture === texture) {
                    material.setDiffuseTexture(null)
                }
                texture?.dispose()
            } catch (t: Throwable) {
                Log.e(TAG, "releaseTexture($key) failed", t)
            }
        }
    }

    override fun isSurfaceReady(id: Double): Boolean {
        return entries[id.toInt()]?.surfaceReady == true
    }

    // ── Binding ───────────────────────────────────────────────────────────

    private fun bind(id: Int, entry: Entry, attemptsLeft: Int) {
        if (entry.released) return

        val reactContext = NitroModules.applicationContext
        if (reactContext == null) {
            Log.e(TAG, "bind($id): no ReactApplicationContext — is Nitro installed?")
            return
        }

        val viroView = resolveViroView(reactContext)
        val viroContext = viroView?.viroContext
        val material = try {
            reactContext.getNativeModule(MaterialManager::class.java)?.getMaterial(entry.materialName)
        } catch (t: Throwable) {
            Log.e(TAG, "bind($id): MaterialManager lookup failed", t)
            null
        }

        if (viroContext == null || material == null) {
            if (attemptsLeft > 0) {
                mainHandler.postDelayed({ bind(id, entry, attemptsLeft - 1) }, BIND_RETRY_MS)
            } else {
                Log.e(TAG, "bind($id): giving up after ${BIND_ATTEMPTS} attempts — " +
                        (if (viroContext == null) "no active ViroView/ViroContext (is a scene navigator mounted?); "
                         else "") +
                        (if (material == null) "material '${entry.materialName}' not registered " +
                                "(call ViroMaterials.createMaterials first — see createPlaceholderMaterial)."
                         else ""))
            }
            return
        }

        try {
            val texture = ExternalSurfaceTexture(viroContext, entry.width, entry.height) { surface: Surface ->
                // Renderer thread. Publish only; no GL work here.
                if (!entry.released) {
                    ViroGPUTextureSurfaces.publish(id, surface)
                    entry.surfaceReady = true
                }
            }
            entry.texture = texture
            entry.boundMaterial = material
            material.setDiffuseTexture(texture)
            Log.i(TAG, "bind($id): bound ${entry.width}x${entry.height} surface-producer " +
                    "texture to material '${entry.materialName}'")
        } catch (t: Throwable) {
            Log.e(TAG, "bind($id): failed to create/bind ExternalSurfaceTexture", t)
        }
    }

    /**
     * The active ViroView. Primary source: the viro bridge's PerfMonitor
     * module — every VRT scene navigator constructor calls
     * `perfMonitor.setView(mViroView)` (VRT3DSceneNavigator). Fallback: walk
     * the current activity's decor view (covers exotic hosting setups).
     */
    private fun resolveViroView(reactContext: com.facebook.react.bridge.ReactApplicationContext): ViroView? {
        try {
            val fromPerfMonitor = reactContext.getNativeModule(PerfMonitor::class.java)?.view
            if (fromPerfMonitor != null) return fromPerfMonitor
        } catch (t: Throwable) {
            Log.w(TAG, "resolveViroView: PerfMonitor lookup failed", t)
        }
        val decor = reactContext.currentActivity?.window?.decorView ?: return null
        return findViroView(decor)
    }

    private fun findViroView(view: View): ViroView? {
        if (view is ViroView) return view
        if (view is ViewGroup) {
            for (i in 0 until view.childCount) {
                findViroView(view.getChildAt(i))?.let { return it }
            }
        }
        return null
    }

    companion object {
        private const val TAG = "ViroGPUTexture"
        // Source of truth: config/defaults.json → texture.bind (Kotlin cannot
        // read the JSON at runtime — keep in sync).
        private const val BIND_RETRY_MS = 250L        // texture.bind.retryIntervalMs
        private const val BIND_ATTEMPTS = 40          // texture.bind.maxAttempts (40 × 250ms = 10s)
        private val nextId = AtomicInteger(1)
    }
}
