import React, { useEffect, useMemo } from "react";
import { ViroMaterials, ViroMaterialVideo } from "@reactvision/react-viro";
import defaults from "../config/defaults.json";

export type MuxTokens = {
  /** Signed playback JWT (Mux signed playback). */
  playback?: string;
  /** DRM token for FairPlay/Widevine signed playback. */
  drm?: string;
};

export type ViroMuxVideoEvents = {
  onBufferStart?: (event: unknown) => void;
  onBufferEnd?: (event: unknown) => void;
  onFinish?: () => void;
  onError?: (event: unknown) => void;
  onUpdateTime?: (currentTime: number, totalTime: number) => void;
};

export type ViroMuxVideoProps = {
  playbackId: string;
  tokens?: MuxTokens;
  paused?: boolean;
  muted?: boolean;
  loop?: boolean;
  /** Named material this video texture binds to. Will be auto-registered if absent. */
  materialName: string;
} & ViroMuxVideoEvents;

function buildHlsUrl(playbackId: string, tokens?: MuxTokens): string {
  const base = `https://stream.mux.com/${encodeURIComponent(playbackId)}.m3u8`;
  if (!tokens?.playback && !tokens?.drm) return base;
  const params = new URLSearchParams();
  if (tokens.playback) params.set("token", tokens.playback);
  if (tokens.drm) params.set("drm_token", tokens.drm);
  return `${base}?${params.toString()}`;
}

/**
 * Plays a Mux asset as a Viro video texture bound to a named material.
 *
 * Uses Viro's verified ViroMaterialVideo component (the non-visual sibling that
 * sets a video texture on a named material). Visual placement is handled by a
 * consumer (e.g. ViroMuxSurface).
 *
 * Mux Data telemetry should attach at the AVPlayer/ExoPlayer layer below this
 * bridge — see doc/MuxPlayback.md.
 */
export function ViroMuxVideo(props: ViroMuxVideoProps): React.ReactElement {
  const {
    playbackId,
    tokens,
    paused,
    muted = defaults.mux.playback.muted,
    loop = defaults.mux.playback.loop,
    materialName,
    onBufferStart,
    onBufferEnd,
    onFinish,
    onError,
    onUpdateTime,
  } = props;

  const source = useMemo(() => ({ uri: buildHlsUrl(playbackId, tokens) }), [playbackId, tokens]);

  // ponytail: ViroMaterials.createMaterials accepts a video source on diffuseTexture.
  // Re-registering with the new URI is the canonical way to swap the playing asset.
  useEffect(() => {
    ViroMaterials.createMaterials({
      [materialName]: {
        diffuseTexture: source,
      },
    });
  }, [materialName, source]);

  return (
    <ViroMaterialVideo
      material={materialName}
      paused={paused}
      loop={loop}
      muted={muted}
      onBufferStart={onBufferStart}
      onBufferEnd={onBufferEnd}
      onFinish={onFinish}
      onError={onError}
      onUpdateTime={onUpdateTime}
    />
  );
}
