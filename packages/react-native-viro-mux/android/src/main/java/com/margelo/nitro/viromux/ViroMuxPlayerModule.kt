package com.margelo.nitro.viromux

import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.util.Log
import androidx.media3.common.MediaItem
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.util.UnstableApi
import androidx.media3.common.util.Util
import androidx.media3.datasource.DefaultDataSourceFactory
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.exoplayer.hls.HlsMediaSource
import androidx.media3.exoplayer.source.MediaSource
import androidx.media3.exoplayer.source.ProgressiveMediaSource
import androidx.media3.extractor.DefaultExtractorsFactory
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * ExoPlayer (androidx.media3) producer for the `surface-producer` texture
 * bridge. One player per texture id; video renders into the Surface published
 * by [ViroGPUTextureSurfaces] (created by `registerExternalTexture` — see
 * HybridViroGPUTextureModule.kt / doc/TextureBridge.md).
 *
 * The media3 version MUST match what the consumer app already ships for
 * virocore's AVPlayer (androidx.media3:*:1.1.1 — decax9
 * android/app/build.gradle:212-215). This module declares it `compileOnly`
 * so a second ExoPlayer copy can never be introduced from here.
 *
 * API pattern mirrors virocore's proven wrapper
 * (com/viro/core/internal/AVPlayer.java):
 *  - `ExoPlayer.Builder(context).build()`            — AVPlayer.java:100
 *  - `player.setVideoSurface(surface)`               — AVPlayer.java:251
 *  - `HlsMediaSource.Factory(...).createMediaSource` — AVPlayer.java:222
 *  - `ProgressiveMediaSource.Factory(...)` fallback  — AVPlayer.java:225
 *
 * Threading: ExoPlayer instances must be accessed from a single thread with a
 * Looper — everything here hops to the main thread, same as AVPlayer's
 * `runSynchronouslyOnMainThread` (AVPlayer.java:151-169) but fire-and-forget
 * (no JS thread blocking).
 */
@UnstableApi
class ViroMuxPlayerModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    private val players = HashMap<Int, ExoPlayer>() // main-thread only
    private val urls = HashMap<Int, String>() // main-thread only — current source per player
    private val lastVolumes = HashMap<Int, Float>() // main-thread only — last NON-ZERO volume (unmute target)
    private val mainHandler = Handler(Looper.getMainLooper())

    override fun getName(): String = NAME

    /**
     * Start (or resume) playback of [url] into the Surface registered under
     * [textureId]. Idempotent resume: if a player already exists for the id,
     * loop/mute are re-applied and playback resumes without re-preparing.
     */
    @ReactMethod
    fun play(textureId: Double, url: String, loop: Boolean, muted: Boolean) {
        val id = textureId.toInt()
        mainHandler.post {
            val existing = players[id]
            if (existing != null) {
                // Source switch on the SAME texture: re-prepare with the new
                // url (playlist selection). Same-url play() stays a resume.
                if (urls[id] != url) {
                    try {
                        existing.setMediaSource(buildMediaSource(url))
                        existing.prepare()
                        urls[id] = url
                        Log.i(TAG, "play($id): switched url=$url")
                    } catch (t: Throwable) {
                        Log.e(TAG, "play($id): url switch failed", t)
                        return@post
                    }
                } else {
                    Log.i(TAG, "play($id): resumed")
                }
                existing.repeatMode = if (loop) Player.REPEAT_MODE_ALL else Player.REPEAT_MODE_OFF
                existing.volume = if (muted) 0f else 1f
                existing.playWhenReady = true
                return@post
            }

            val surface = ViroGPUTextureSurfaces.getSurface(id)
            if (surface == null) {
                Log.e(TAG, "play($id): no Surface registered — call registerExternalTexture " +
                        "and wait for isExternalTextureReady before play()")
                return@post
            }

            try {
                val context = reactApplicationContext
                val player = ExoPlayer.Builder(context).build()
                player.addListener(object : Player.Listener {
                    override fun onPlaybackStateChanged(playbackState: Int) {
                        Log.i(TAG, "state($id) ${stateName(playbackState)}")
                    }

                    override fun onIsPlayingChanged(isPlaying: Boolean) {
                        Log.i(TAG, "isPlaying($id)=$isPlaying")
                    }

                    override fun onRenderedFirstFrame() {
                        Log.i(TAG, "renderedFirstFrame($id)")
                    }

                    override fun onPlayerError(error: PlaybackException) {
                        Log.e(TAG, "error($id): $error", error)
                    }
                })
                player.setVideoSurface(surface)
                player.setMediaSource(buildMediaSource(url))
                player.repeatMode = if (loop) Player.REPEAT_MODE_ALL else Player.REPEAT_MODE_OFF
                player.volume = if (muted) 0f else 1f
                player.prepare()
                player.playWhenReady = true
                players[id] = player
                urls[id] = url
                Log.i(TAG, "play($id): url=$url loop=$loop muted=$muted")
            } catch (t: Throwable) {
                Log.e(TAG, "play($id): failed to start ExoPlayer", t)
            }
        }
    }

    @ReactMethod
    fun pause(textureId: Double) {
        val id = textureId.toInt()
        mainHandler.post {
            players[id]?.let {
                it.playWhenReady = false
                Log.i(TAG, "pause($id)")
            } ?: Log.w(TAG, "pause($id): no player")
        }
    }

    /** Resume without re-sending the url (play() would also work, but this is unambiguous). */
    @ReactMethod
    fun resume(textureId: Double) {
        val id = textureId.toInt()
        mainHandler.post {
            players[id]?.let {
                it.playWhenReady = true
                Log.i(TAG, "resume($id)")
            } ?: Log.w(TAG, "resume($id): no player")
        }
    }

    @ReactMethod
    fun seekTo(textureId: Double, seconds: Double) {
        val id = textureId.toInt()
        mainHandler.post {
            players[id]?.let {
                it.seekTo((seconds * 1000.0).toLong().coerceAtLeast(0L))
                Log.i(TAG, "seekTo($id): ${seconds}s")
            } ?: Log.w(TAG, "seekTo($id): no player")
        }
    }

    /**
     * Set player volume 0..1. Volume 0 mutes; any non-zero value is
     * remembered as the unmute target. setVolume(-1) restores the last
     * non-zero volume (unmute without JS having to remember it).
     */
    @ReactMethod
    fun setVolume(textureId: Double, volume: Double) {
        val id = textureId.toInt()
        mainHandler.post {
            val player = players[id]
            if (player == null) {
                Log.w(TAG, "setVolume($id): no player")
                return@post
            }
            val v = if (volume < 0.0) (lastVolumes[id] ?: 1f) else volume.toFloat().coerceIn(0f, 1f)
            if (v > 0f) lastVolumes[id] = v
            player.volume = v
            Log.i(TAG, "setVolume($id): $v")
        }
    }

    /**
     * Snapshot playback state:
     * { positionSec, durationSec, bufferedSec, isPlaying, volume }.
     * durationSec is 0 until the timeline is known (C.TIME_UNSET while
     * preparing / for live streams).
     */
    @ReactMethod
    fun getStatus(textureId: Double, promise: Promise) {
        val id = textureId.toInt()
        mainHandler.post {
            val player = players[id]
            if (player == null) {
                promise.reject("ENO_PLAYER", "getStatus($id): no player for texture id")
                return@post
            }
            val durationMs = player.duration // C.TIME_UNSET when unknown
            val map = Arguments.createMap().apply {
                putDouble("positionSec", player.currentPosition.coerceAtLeast(0L) / 1000.0)
                putDouble("durationSec", if (durationMs > 0) durationMs / 1000.0 else 0.0)
                putDouble("bufferedSec", player.bufferedPosition.coerceAtLeast(0L) / 1000.0)
                putBoolean("isPlaying", player.isPlaying)
                putDouble("volume", player.volume.toDouble())
            }
            promise.resolve(map)
        }
    }

    /** Stop and release the player. The texture/Surface stays registered. */
    @ReactMethod
    fun stop(textureId: Double) {
        val id = textureId.toInt()
        mainHandler.post { releasePlayer(id) }
    }

    // Same content-type inference as AVPlayer.java:229-246 — Mux HLS URLs end
    // in .m3u8 (query params allowed; Uri.getPath() strips them).
    private fun buildMediaSource(url: String): MediaSource {
        val uri = Uri.parse(url)
        val dataSourceFactory = DefaultDataSourceFactory(
            reactApplicationContext,
            Util.getUserAgent(reactApplicationContext, "ViroMuxPlayer")
        )
        val path = uri.path ?: ""
        return if (path.endsWith(".m3u8", ignoreCase = true)) {
            HlsMediaSource.Factory(dataSourceFactory).createMediaSource(MediaItem.fromUri(uri))
        } else {
            ProgressiveMediaSource.Factory(dataSourceFactory, DefaultExtractorsFactory())
                .createMediaSource(MediaItem.fromUri(uri))
        }
    }

    private fun releasePlayer(id: Int) {
        urls.remove(id)
        lastVolumes.remove(id)
        val player = players.remove(id) ?: return
        try {
            player.stop()
            player.release()
            Log.i(TAG, "stop($id): player released")
        } catch (t: Throwable) {
            Log.e(TAG, "stop($id): release failed", t)
        }
    }

    override fun invalidate() {
        mainHandler.post {
            for (id in players.keys.toList()) releasePlayer(id)
        }
        super.invalidate()
    }

    companion object {
        const val NAME = "ViroMuxPlayer"
        private const val TAG = "ViroMuxPlayer"

        private fun stateName(state: Int): String = when (state) {
            Player.STATE_IDLE -> "STATE_IDLE"
            Player.STATE_BUFFERING -> "STATE_BUFFERING"
            Player.STATE_READY -> "STATE_READY"
            Player.STATE_ENDED -> "STATE_ENDED"
            else -> "STATE_$state"
        }
    }
}
