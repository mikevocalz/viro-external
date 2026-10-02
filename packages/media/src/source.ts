import { buildMuxPlaybackUrl } from "./providers/mux";
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
