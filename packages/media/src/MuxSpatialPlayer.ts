import * as React from "react";
import { SpatialVideoPlayer } from "./SpatialVideoPlayer";
import {
  buildMuxStoryboardVttUrl,
  buildMuxThumbnailUrl,
  normalizeMuxMediaSource,
  type MuxThumbnailOptions,
  type NormalizedMuxMediaSource,
} from "./providers/mux";
import { mediaSourceKey } from "./source";
import type {
  MuxMaxResolution,
  MuxMediaSource,
  MuxMinResolution,
  MuxRenditionOrder,
} from "./types";

export type MuxSpatialPlayerSource =
  | string
  | Omit<MuxMediaSource, "provider">;

export class MuxSpatialPlayer extends SpatialVideoPlayer {
  constructor(source?: MuxSpatialPlayerSource) {
    super(source ? toMuxMediaSource(source) : undefined);
  }

  get muxSource(): NormalizedMuxMediaSource | undefined {
    const source = this.source;
    return source &&
      typeof source !== "string" &&
      source.provider === "mux"
      ? normalizeMuxMediaSource(source)
      : undefined;
  }

  replaceMux(source: MuxSpatialPlayerSource): void {
    this.replace(toMuxMediaSource(source));
  }

  setMaxResolution(
    maxResolution?: MuxMaxResolution
  ): void {
    this.updatePublicPlaybackModifiers({
      maxResolution,
    });
  }

  setMinResolution(
    minResolution?: MuxMinResolution
  ): void {
    this.updatePublicPlaybackModifiers({
      minResolution,
    });
  }

  setRenditionOrder(
    renditionOrder: MuxRenditionOrder = "default"
  ): void {
    this.updatePublicPlaybackModifiers({
      renditionOrder,
    });
  }

  posterUrl(options?: MuxThumbnailOptions): string | undefined {
    const source = this.muxSource;
    return source
      ? buildMuxThumbnailUrl(source, options)
      : undefined;
  }

  storyboardUrl(): string | undefined {
    const source = this.muxSource;
    return source
      ? buildMuxStoryboardVttUrl(source)
      : undefined;
  }

  private updatePublicPlaybackModifiers(
    patch: Partial<
      Pick<
        MuxMediaSource,
        | "minResolution"
        | "maxResolution"
        | "renditionOrder"
      >
    >
  ): void {
    const source = this.muxSource;
    if (!source) {
      throw new Error(
        "MuxSpatialPlayer has no Mux source to update."
      );
    }

    if (source.playbackToken) {
      throw new Error(
        "Mux signed playback modifiers must be embedded " +
          "in a newly signed playback JWT. Replace the " +
          "source with the new token instead of mutating " +
          "resolution/rendition settings client-side."
      );
    }

    const resumeAt = this.currentTime;
    this.replace(
      {
        ...source,
        ...patch,
        provider: "mux",
      },
      { resumeAt }
    );
  }
}

export function createMuxSpatialPlayer(
  source?: MuxSpatialPlayerSource
): MuxSpatialPlayer {
  return new MuxSpatialPlayer(source);
}

export function useMuxSpatialPlayer(
  source?: MuxSpatialPlayerSource,
  setup?: (player: MuxSpatialPlayer) => void
): MuxSpatialPlayer {
  const normalized = source
    ? toMuxMediaSource(source)
    : undefined;
  const key = mediaSourceKey(normalized);
  const playerRef = React.useRef<MuxSpatialPlayer | null>(
    null
  );

  if (playerRef.current === null) {
    const player = new MuxSpatialPlayer(source);
    setup?.(player);
    playerRef.current = player;
  }

  const player = playerRef.current;
  const keyRef = React.useRef(key);

  React.useEffect(() => {
    if (keyRef.current === key) return;
    keyRef.current = key;
    if (source) {
      player.replaceMux(source);
    }
  }, [key, player, source]);

  React.useEffect(
    () => () => {
      player.release();
    },
    [player]
  );

  return player;
}

function toMuxMediaSource(
  source: MuxSpatialPlayerSource
): MuxMediaSource {
  return typeof source === "string"
    ? { provider: "mux", playbackId: source }
    : { ...source, provider: "mux" };
}
