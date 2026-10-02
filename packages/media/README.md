# @viro-external/media

Premium, provider-neutral spatial media for Viro.

The package deliberately uses Viro's own video renderer instead of maintaining
a second Nitro/native video stack.

## Controller + view

The player lifecycle is separate from the rendered XR surface:

```tsx
const player = useMuxSpatialPlayer(
  {
    playbackId: "PLAYBACK_ID",
    maxResolution: "1080p",
    metadata: {
      videoTitle: "Spatial lesson",
      viewerUserId: "student-123",
    },
  },
  player => player.play()
);

<SpatialVideoPlayerView
  player={player}
  presentation="curved"
  curvature={0.35}
  width={1.6}
  height={0.9}
/>
```

The controller owns play/pause, mute, volume, loop, seek, replay, source
replacement and playback status. Commands issued before the Viro surface mounts
are safe; seeks are queued until a native video ref exists.

## Mux adapter

Mux is a source/provider adapter, not the native player:

```tsx
import {
  MuxSpatialPlayer,
  buildMuxThumbnailUrl,
  buildMuxStoryboardVttUrl,
} from "@viro-external/media/mux";
```

Supported Mux source options include:

- playback IDs and signed playback tokens
- custom delivery domains
- min/max manifest resolution
- rendition order
- instant-clip start/end times
- thumbnail and storyboard tokens
- Mux metadata stored on the source for telemetry integrations

Public playback modifiers are written to the HLS query string. Signed playback
modifiers must be embedded in the JWT claims; use `muxPlaybackModifierClaims()`
when constructing the backend signing request.

`MuxSpatialPlayer.setMaxResolution()`, `setMinResolution()`, and
`setRenditionOrder()` rebuild public playback URLs and resume at the previous
playhead position.

## Posters and storyboard previews

`MuxSpatialPlayer.posterUrl()` and `storyboardUrl()` expose the Mux image
assets. `parseMuxStoryboardVtt()` maps storyboard WebVTT cues into sprite
rectangles so premium XR controls can add scrub-preview cards without another
video decoder.

## Spatial presentation

The same controller/source can render as:

- `flat`
- `curved`
- `360`

Packed stereo uses Viro's existing stereo-mode support where the selected Viro
video primitive supports it.

## Intentionally not faked

The current Viro renderer does not expose everything the official Mux native
player SDKs expose. These remain explicit renderer/backend work:

- FairPlay/Widevine DRM
- exact first-frame event
- audio/caption track enumeration and selection
- playback-rate control
- live/DVR seekable-window metadata
- native data-only media preloading
- AirPlay / Picture in Picture / Now Playing
- automatic Mux Data instrumentation
- Vision Pro video textures

If an application needs those today, it should use an appropriate native media
surface outside this package or add the capability to ViroCore. The premium
media API will not claim support that the renderer cannot deliver.
