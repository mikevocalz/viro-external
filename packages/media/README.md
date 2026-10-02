# @viro-external/media

Premium, provider-neutral spatial video primitives for Viro.

## Why this replaces react-native-viro-mux

The old package mixed four concerns: Mux URL construction, player state, an external GPU-texture bridge, and UI composition. It also made Nitro Modules a hard dependency.

This package deliberately uses Viro's own native video stack:

- ViroVideo for ordinary 2D video
- ViroMaterialVideo for custom flat/curved surfaces
- Viro360Video for immersive 360 playback
- Viro's existing stereoMode support for packed stereo sources

There is no Nitro or Nitrogen dependency. Mux is now one optional source adapter, not the renderer.

## Usage

    import { SpatialVideo, muxSource } from "@viro-external/media";

    <SpatialVideo
      source={muxSource("PLAYBACK_ID")}
      presentation="curved"
      curvature={0.35}
      width={1.6}
      height={0.9}
    />

Switch to immersive playback without changing providers:

    <SpatialVideo
      source={{ uri: "https://example.com/360.m3u8" }}
      presentation="360"
      stereoMode="None"
    />

## Platform note

The package follows the capabilities of the installed Viro renderer. Current upstream Viro does not mount video texture view managers on visionOS, so Vision Pro video remains a renderer-backend task rather than something this package hides or falsely claims to support.


## MuxSpatialPlayer

`MuxSpatialPlayer` borrows the useful controller ergonomics from Mux's React Native
player while keeping Viro as the renderer.

It adds:

- source normalization and validation
- signed playback token support
- custom Mux delivery domains
- public min/max resolution modifiers
- rendition ordering and instant clipping
- Mux poster + storyboard URL helpers
- poster lifecycle until playback actually advances
- status snapshots
- play, pause, replay, seekTo, seekBy, mute, volume, loop, replace and release
- `setMaxResolution()` for public playback with resume-at-current-time
- storyboard VTT parsing for spatial scrubber previews

DRM is deliberately rejected for now. FairPlay/Widevine needs a proper native
ViroCore/Eskiu media backend; appending a DRM token to an HLS URL is not sufficient.

Likewise, exact first-frame notifications, buffered-position reporting,
caption/audio-track selection, playback-rate control, and true data-only preloading
are not faked in JS. Those are tracked as renderer capabilities for the native media
backend.


## Long-lived player controllers

For simple composition, `SpatialVideo` and `MuxSpatialPlayer` remain the shortest path.

For players that must survive view remounts, switch panels, queue seeks before the
native Viro surface exists, or share one playback state across multiple controls, use
the controller/view split:

    const player = useSpatialVideoPlayer(source, (player) => {
      player.setMuted(false);
      player.setLoop(true);
      player.play();
    });

    <SpatialVideoPlayerView player={player} presentation="curved" />

`MuxSpatialPlayerController` extends the same controller with Mux-aware source
replacement, public min/max resolution controls, rendition ordering, and poster /
storyboard URL helpers. Signed-playback modifier changes still require a newly minted
JWT; `muxPlaybackModifierClaims()` exposes the claims to include when generating it.

The controller owns state; the Viro view only attaches the native seek handle and
reports lifecycle events back. This avoids duplicated player state in premium UI.
