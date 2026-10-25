package com.margelo.nitro.nativepanels.whiteboard

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.util.Base64
import android.util.Log
import kotlin.math.max

/**
 * Decoded image assets keyed by asset id and `src`. Decodes `data:` URLs
 * (base64) and local files (`file://` or an absolute path). Remote URLs are
 * not fetched; their image shapes draw QuickDraw's placeholder. Decoding runs
 * on the render thread, downsampled so the longest side is at most
 * [MAX_SIDE_PX]. Render thread only.
 */
internal class AssetBitmaps {
  private class Entry(val src: String, val bitmap: Bitmap?)

  private val entries = HashMap<String, Entry>()

  /** @return the bitmap, or null when the asset cannot be decoded here. */
  fun bitmapFor(asset: BoardAsset): Bitmap? {
    entries[asset.id]?.let { if (it.src == asset.src) return it.bitmap else it.bitmap?.recycle() }
    val bitmap = decode(asset.src)
    entries[asset.id] = Entry(asset.src, bitmap)
    return bitmap
  }

  fun retainOnly(ids: Set<String>) {
    val iterator = entries.entries.iterator()
    while (iterator.hasNext()) {
      val next = iterator.next()
      if (next.key !in ids) {
        next.value.bitmap?.recycle()
        iterator.remove()
      }
    }
  }

  fun byteCount(): Long = entries.values.sumOf { it.bitmap?.allocationByteCount?.toLong() ?: 0L }

  fun clear() {
    for (entry in entries.values) entry.bitmap?.recycle()
    entries.clear()
  }

  private fun decode(src: String): Bitmap? {
    try {
      if (src.startsWith("data:")) {
        val comma = src.indexOf(',')
        if (comma < 0 || !src.substring(0, comma).endsWith(";base64")) return null
        val bytes = Base64.decode(src.substring(comma + 1), Base64.DEFAULT)
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
        return BitmapFactory.decodeByteArray(bytes, 0, bytes.size, sampled(bounds))
      }
      val path = when {
        src.startsWith("file://") -> Uri.parse(src).path ?: return null
        src.startsWith("/") -> src
        else -> return null
      }
      val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
      BitmapFactory.decodeFile(path, bounds)
      return BitmapFactory.decodeFile(path, sampled(bounds))
    } catch (error: IllegalArgumentException) {
      Log.w(TAG, "Could not decode image asset", error)
      return null
    } catch (error: OutOfMemoryError) {
      Log.w(TAG, "Image asset too large to decode", error)
      return null
    }
  }

  private fun sampled(bounds: BitmapFactory.Options): BitmapFactory.Options {
    var sample = 1
    while (max(bounds.outWidth, bounds.outHeight) / sample > MAX_SIDE_PX) sample *= 2
    return BitmapFactory.Options().apply {
      inSampleSize = sample
      inPreferredConfig = Bitmap.Config.ARGB_8888
    }
  }

  private companion object {
    const val TAG = "WhiteboardRenderer"
    const val MAX_SIDE_PX = 2048
  }
}
