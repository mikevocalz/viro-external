import {
  buildMuxPlaybackUrl,
  muxPlaybackFingerprint,
} from "./providers/mux";
import type { MediaSource } from "./types";

export type ResolvedMediaSource = { uri: string };

export function resolveMediaSource(source: MediaSource): ResolvedMediaSource {
  if (typeof source === "string") {
    return { uri: source };
  }

  if (source.provider === "mux") {
    return { uri: buildMuxPlaybackUrl(source) };
  }

  return { uri: source.uri };
}

export function mediaSourceKey(
  source: MediaSource | undefined
): string {
  if (source == null) return "none";
  if (typeof source === "string") return "url:" + source;
  if (source.provider === "mux") {
    return "mux:" + muxPlaybackFingerprint(source);
  }
  return "url:" + source.uri;
}
