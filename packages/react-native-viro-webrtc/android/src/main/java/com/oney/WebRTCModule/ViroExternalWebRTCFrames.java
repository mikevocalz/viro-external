package com.oney.WebRTCModule;

import android.os.Handler;
import android.os.Looper;
import android.util.Log;
import android.view.Surface;

import com.facebook.react.bridge.ReactApplicationContext;

import org.webrtc.EglBase;
import org.webrtc.EglRenderer;
import org.webrtc.GlRectDrawer;
import org.webrtc.MediaStream;
import org.webrtc.VideoTrack;

import java.lang.ref.WeakReference;
import java.util.HashMap;
import java.util.Map;

/**
 * Fishjam/react-native-webrtc producer for ViroExternalVideo.
 *
 * Lives in com.oney.WebRTCModule on purpose: it can use the same package-level
 * stream lookup/executor helpers as Fishjam without patching Fishjam's source.
 */
public final class ViroExternalWebRTCFrames {
    private static final String TAG = "ViroExternalWebRTC";
    private static final int RETRY_MS = 250;
    private static final int MAX_RETRIES = 40;

    private static final Handler RETRY_HANDLER =
            new Handler(Looper.getMainLooper());
    private static final Map<String, Entry> ENTRIES = new HashMap<>();
    private static WeakReference<ReactApplicationContext> sContext =
            new WeakReference<>(null);

    private ViroExternalWebRTCFrames() {}

    public static void initialize(ReactApplicationContext context) {
        sContext = new WeakReference<>(context);
    }

    private static final class Entry {
        final String sourceKey;
        final String consumerId;
        final Surface surface;
        final int width;
        final int height;

        EglRenderer renderer;
        VideoTrack track;
        int retries;
        boolean revoked;

        Entry(String sourceKey, String consumerId, Surface surface,
              int width, int height) {
            this.sourceKey = sourceKey;
            this.consumerId = consumerId;
            this.surface = surface;
            this.width = width;
            this.height = height;
        }

        String id() {
            return sourceKey + "\u0000" + consumerId;
        }
    }

    public static void provideSurface(
            String sourceKey,
            String consumerId,
            Surface surface,
            int width,
            int height) {
        if (sourceKey == null || consumerId == null || surface == null) {
            return;
        }

        final Entry entry = new Entry(
                sourceKey, consumerId, surface, width, height);

        ThreadUtils.runOnExecutor(() -> {
            revokeLocked(entry.id());

            ENTRIES.put(entry.id(), entry);
            attachOrRetry(entry);
        });
    }

    /** Backward-compatible v1 reflection contract. */
    public static void provideSurface(
            String sourceKey,
            Surface surface,
            int width,
            int height) {
        provideSurface(
                sourceKey,
                "legacy:" + sourceKey,
                surface,
                width,
                height);
    }

    public static void revokeSurface(
            String sourceKey,
            String consumerId) {
        if (sourceKey == null || consumerId == null) {
            return;
        }
        final String id = sourceKey + "\u0000" + consumerId;
        ThreadUtils.runOnExecutor(() -> revokeLocked(id));
    }

    /** Backward-compatible v1 reflection contract. */
    public static void revokeSurface(String sourceKey) {
        revokeSurface(sourceKey, "legacy:" + sourceKey);
    }

    private static void attachOrRetry(Entry entry) {
        if (entry.revoked || ENTRIES.get(entry.id()) != entry) {
            return;
        }

        ReactApplicationContext context = sContext.get();
        if (context == null) {
            scheduleRetry(entry, "React context not ready");
            return;
        }

        WebRTCModule module = context.getNativeModule(WebRTCModule.class);
        if (module == null) {
            scheduleRetry(entry, "WebRTCModule not ready");
            return;
        }

        MediaStream stream = module.getStreamForReactTag(entry.sourceKey);
        if (stream == null || stream.videoTracks.isEmpty()) {
            scheduleRetry(entry, "stream/video track not ready");
            return;
        }

        VideoTrack track = stream.videoTracks.get(0);
        EglRenderer renderer =
                new EglRenderer("ViroExternalVideo:" + entry.consumerId);
        renderer.init(
                EglUtils.getRootEglBaseContext(),
                EglBase.CONFIG_PLAIN,
                new GlRectDrawer());
        renderer.createEglSurface(entry.surface);
        track.addSink(renderer);

        entry.track = track;
        entry.renderer = renderer;

        Log.i(
                TAG,
                "attached " + entry.sourceKey
                        + " consumer=" + entry.consumerId
                        + " (" + entry.width + "x" + entry.height + ")");
    }

    private static void scheduleRetry(Entry entry, String reason) {
        if (entry.revoked || ENTRIES.get(entry.id()) != entry) {
            return;
        }
        if (entry.retries++ >= MAX_RETRIES) {
            Log.e(
                    TAG,
                    "giving up on " + entry.sourceKey
                            + " consumer=" + entry.consumerId
                            + ": " + reason);
            return;
        }

        RETRY_HANDLER.postDelayed(
                () -> ThreadUtils.runOnExecutor(
                        () -> attachOrRetry(entry)),
                RETRY_MS);
    }

    private static void revokeLocked(String id) {
        Entry entry = ENTRIES.remove(id);
        if (entry == null) {
            return;
        }

        entry.revoked = true;

        if (entry.track != null && entry.renderer != null) {
            try {
                entry.track.removeSink(entry.renderer);
            } catch (Exception error) {
                Log.w(TAG, "removeSink failed", error);
            }
        }

        if (entry.renderer != null) {
            try {
                entry.renderer.releaseEglSurface(() -> {});
                entry.renderer.release();
            } catch (Exception error) {
                Log.w(TAG, "renderer release failed", error);
            }
        }

        entry.renderer = null;
        entry.track = null;
    }
}
