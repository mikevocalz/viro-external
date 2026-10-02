import type {
  MuxMediaSource,
  MuxMaxResolution,
  MuxMinResolution,
  MuxRenditionOrder,
  MuxTokens,
} from "../types";

const MIN_RESOLUTION_ORDER: MuxMinResolution[] = [
  "480p",
  "540p",
  "720p",
  "1080p",
  "1440p",
  "2160p",
];

const MAX_RESOLUTION_ORDER: MuxMaxResolution[] = [
  "720p",
  "1080p",
  "1440p",
  "2160p",
];

export type NormalizedMuxMediaSource = MuxMediaSource & {
  provider: "mux";
  playbackId: string;
  renditionOrder: MuxRenditionOrder;
};

export type MuxThumbnailFitMode =
  | "preserve"
  | "stretch"
  | "crop"
  | "smartcrop"
  | "pad";

export type MuxThumbnailOptions = {
  time?: number;
  width?: number;
  height?: number;
  fitMode?: MuxThumbnailFitMode;
  token?: string;
};

function cleanDomain(value?: string): string | undefined {
  if (!value) return undefined;
  const trimmed = value
    .trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/+$/, "");
  return trimmed || undefined;
}

export function normalizeMuxSource(
  source: MuxMediaSource
): NormalizedMuxMediaSource {
  const playbackId = source.playbackId.trim();
  if (!playbackId) {
    throw new Error("Mux media source requires a non-empty playbackId.");
  }

  if (source.tokens?.drm && !source.tokens.playback) {
    throw new Error(
      "Mux DRM playback requires both drm and playback tokens."
    );
  }

  if (source.minResolution && source.maxResolution) {
    const min = Number(source.minResolution.replace("p", ""));
    const max = Number(source.maxResolution.replace("p", ""));
    if (min > max) {
      throw new Error(
        `Mux minResolution (${source.minResolution}) cannot exceed maxResolution (${source.maxResolution}).`
      );
    }
  }

  const start = source.clipping?.assetStartTime;
  const end = source.clipping?.assetEndTime;
  if (start != null && (!Number.isFinite(start) || start < 0)) {
    throw new Error(
      "Mux clipping.assetStartTime must be a non-negative finite number."
    );
  }
  if (end != null && (!Number.isFinite(end) || end < 0)) {
    throw new Error(
      "Mux clipping.assetEndTime must be a non-negative finite number."
    );
  }
  if (start != null && end != null && start >= end) {
    throw new Error(
      "Mux clipping.assetStartTime must be less than assetEndTime."
    );
  }

  return {
    ...source,
    provider: "mux",
    playbackId,
    customDomain: cleanDomain(source.customDomain),
    renditionOrder: source.renditionOrder ?? "default",
  };
}

function muxStreamHost(customDomain?: string): string {
  const domain = cleanDomain(customDomain);
  return domain ? `stream.${domain}` : "stream.mux.com";
}

export function muxImageHost(customDomain?: string): string {
  const domain = cleanDomain(customDomain);
  return domain ? `image.${domain}` : "image.mux.com";
}

function hasPublicPlaybackModifiers(
  source: NormalizedMuxMediaSource
): boolean {
  return Boolean(
    source.minResolution ||
      source.maxResolution ||
      source.renditionOrder === "desc" ||
      source.clipping?.assetStartTime != null ||
      source.clipping?.assetEndTime != null
  );
}

export function buildMuxPlaybackUrl(
  sourceOrPlaybackId: MuxMediaSource | string,
  tokens?: MuxTokens
): string {
  const source = normalizeMuxSource(
    typeof sourceOrPlaybackId === "string"
      ? {
          provider: "mux",
          playbackId: sourceOrPlaybackId,
          tokens,
        }
      : sourceOrPlaybackId
  );

  if (source.tokens?.drm) {
    throw new Error(
      "Mux DRM requires native FairPlay/Widevine integration. The current Viro HLS path does not provide that backend yet."
    );
  }

  const query = new URLSearchParams();

  if (source.tokens?.playback) {
    if (hasPublicPlaybackModifiers(source)) {
      throw new Error(
        "Mux playback modifiers for signed playback must be encoded into the playback JWT. Do not append min/max resolution, rendition order, or clipping as query parameters."
      );
    }
    query.set("token", source.tokens.playback);
  } else {
    if (source.minResolution) {
      query.set("min_resolution", source.minResolution);
    }
    if (source.maxResolution) {
      query.set("max_resolution", source.maxResolution);
    }
    if (source.renditionOrder === "desc") {
      query.set("rendition_order", "desc");
    }
    if (source.clipping?.assetStartTime != null) {
      query.set(
        "asset_start_time",
        String(source.clipping.assetStartTime)
      );
    }
    if (source.clipping?.assetEndTime != null) {
      query.set(
        "asset_end_time",
        String(source.clipping.assetEndTime)
      );
    }
  }

  const base =
    `https://${muxStreamHost(source.customDomain)}/` +
    encodeURIComponent(source.playbackId) +
    ".m3u8";

  const qs = query.toString();
  return qs ? `${base}?${qs}` : base;
}

export function buildMuxThumbnailUrl(
  sourceInput: MuxMediaSource,
  options: MuxThumbnailOptions = {}
): string {
  const source = normalizeMuxSource(sourceInput);
  const query = new URLSearchParams();

  if (options.time != null && Number.isFinite(options.time)) {
    query.set("time", String(Math.max(0, options.time)));
  }
  if (options.width != null && Number.isFinite(options.width)) {
    query.set("width", String(Math.round(options.width)));
  }
  if (options.height != null && Number.isFinite(options.height)) {
    query.set("height", String(Math.round(options.height)));
  }
  if (options.fitMode) {
    query.set("fit_mode", options.fitMode);
  }

  const token = options.token ?? source.tokens?.thumbnail;
  if (token) {
    query.set("token", token);
  }

  const base =
    `https://${muxImageHost(source.customDomain)}/` +
    encodeURIComponent(source.playbackId) +
    "/thumbnail.jpg";

  const qs = query.toString();
  return qs ? `${base}?${qs}` : base;
}

export function buildMuxStoryboardVttUrl(
  sourceInput: MuxMediaSource
): string {
  const source = normalizeMuxSource(sourceInput);
  const query = new URLSearchParams();

  if (source.tokens?.storyboard) {
    query.set("token", source.tokens.storyboard);
  }

  const base =
    `https://${muxImageHost(source.customDomain)}/` +
    encodeURIComponent(source.playbackId) +
    "/storyboard.vtt";

  const qs = query.toString();
  return qs ? `${base}?${qs}` : base;
}

export function muxSource(
  playbackId: string,
  tokens?: MuxTokens
): MuxMediaSource {
  return { provider: "mux", playbackId, tokens };
}

export const muxResolutionSupport = {
  min: MIN_RESOLUTION_ORDER,
  max: MAX_RESOLUTION_ORDER,
} as const;
