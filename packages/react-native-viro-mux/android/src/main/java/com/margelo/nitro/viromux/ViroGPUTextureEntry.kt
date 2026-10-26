package com.margelo.nitro.viromux

import com.viro.core.ExternalSurfaceTexture
import com.viro.core.Material

/**
 * Bookkeeping for one registered surface-producer texture. Written on the main
 * thread (binding) and the Viro render thread (surface callback), read from the
 * JS thread (`isSurfaceReady`), hence the volatile fields.
 */
internal class ViroGPUTextureEntry(
    val materialName: String,
    val width: Int,
    val height: Int,
) {
    @Volatile var texture: ExternalSurfaceTexture? = null
    @Volatile var boundMaterial: Material? = null
    @Volatile var surfaceReady = false
    @Volatile var released = false
}
