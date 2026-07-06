package com.margelo.nitro.viromux

import android.view.Surface
import java.util.concurrent.ConcurrentHashMap

/**
 * Producer-facing surface registry for the `surface-producer` texture path.
 *
 * `registerExternalTexture(materialName, { kind: "surface-producer", ... })`
 * creates a SurfaceTexture-backed GL_TEXTURE_EXTERNAL_OES texture inside the
 * Viro GL context and publishes the producer-facing [Surface] here, keyed by
 * `handle.id`. A native producer (react-native-webgpu, Skia, MediaCodec, a
 * Canvas renderer) looks the Surface up by id and renders into it; the Viro
 * renderer consumes frames via its per-frame VideoSink pump
 * (SurfaceTexture.updateTexImage on the render thread — see
 * doc/TextureBridge.md, "Threading contract").
 *
 * The Surface arrives asynchronously (renderer-thread init); poll
 * `isSurfaceReady(id)` from JS, or [getSurface] from native.
 */
object ViroGPUTextureSurfaces {
    private val surfaces = ConcurrentHashMap<Int, Surface>()

    internal fun publish(id: Int, surface: Surface) {
        surfaces[id] = surface
    }

    internal fun remove(id: Int) {
        surfaces.remove(id)
    }

    /** The producer-facing Surface for a registered handle id, or null while binding. */
    @JvmStatic
    fun getSurface(id: Int): Surface? = surfaces[id]
}
