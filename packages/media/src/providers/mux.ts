import type { MuxMediaSource, MuxTokens } from "../types";

export function buildMuxPlaybackUrl(
  playbackId: string,
  tokens?: MuxTokens
): string {
  const base =
    "https://stream.mux.com/" + encodeURIComponent(playbackId) + ".m3u8";

  const query: string[] = [];
  if (tokens?.playback) {
    query.push("token=" + encodeURIComponent(tokens.playback));
  }
  if (tokens?.drm) {
    query.push("drm_token=" + encodeURIComponent(tokens.drm));
  }

  return query.length === 0 ? base : base + "?" + query.join("&");
}

export function muxSource(
  playbackId: string,
  tokens?: MuxTokens
): MuxMediaSource {
  return { provider: "mux", playbackId, tokens };
}
