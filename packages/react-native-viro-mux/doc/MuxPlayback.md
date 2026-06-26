# Mux playback

## HLS manifest URL

```
https://stream.mux.com/{PLAYBACK_ID}.m3u8
```

For signed playback: `?token={JWT}`. For DRM: append `drm_token` per Mux docs. `ViroMuxVideo` accepts a `tokens` prop carrying both.

## Pipeline

| Layer                       | iOS                        | Android                              |
| --------------------------- | -------------------------- | ------------------------------------ |
| Manifest loader             | `AVPlayerItem(URL:)`       | ExoPlayer-backed `Uri` via `VideoTexture(Uri)` |
| Texture surface             | `VROVideoTextureiOS::loadVideo(AVPlayerItem*)` (ViroKit) | `com.viro.core.VideoTexture(Uri)`    |
| Material binding            | `ViroMaterials.createMaterials({ <name>: { diffuseTexture: <video texture> } })` (verified Viro API) | same                                  |
| Visual component            | `<ViroQuad materials={["<name>"]} />` or `<ViroMuxSurface />` | same                                  |

`ViroMaterials.createMaterials` is the documented `2.56.0` API (`components/Material/ViroMaterials.ts`).

## Telemetry layering

**Mux Data attaches at the player layer**, beneath the bridge. Never above. The Viro layer must not see analytics calls.

- iOS: attach `MUXSDKStats` to the `AVPlayer` before handing the `AVPlayerItem` to `VROVideoTextureiOS`.
- Android: attach `MuxStatsExoPlayer` to the underlying `ExoPlayer` instance owned by `VideoTexture`.

If a future Viro version blocks reaching the underlying `ExoPlayer`, we drop Android telemetry rather than fork — analytics gaps are recoverable; layering violations are not.

## Events (verified in `components/ViroMaterialVideo.tsx`)

- `onBufferStart(event)` ✅
- `onBufferEnd(event)` ✅
- `onFinish()` ✅
- `onError(event)` ✅
- `onUpdateTime(currentTime, totalTime)` ✅

These are the exact callback names `ViroMuxVideo` exposes. No additions.
