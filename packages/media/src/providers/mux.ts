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
  playbackToken?: string;
  drmToken?: string;
  thumbnailToken?: string;
  storyboardToken?: string;
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

export type MuxPlaybackModifierClaims = {
  min_resolution?: MuxMinResolution;
  max_resolution?: MuxMaxResolution;
  rendition_order?: "desc";
  asset_start_time?: number;
  asset_end_time?: number;
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

  const playbackToken =
    source.playbackToken ?? source.tokens?.playback;
  const drmToken =
    source.drmToken ?? source.tokens?.drm;
  const thumbnailToken =
    source.thumbnailToken ?? source.tokens?.thumbnail;
  const storyboardToken =
    source.storyboardToken ?? source.tokens?.storyboard;

  if (drmToken && !playbackToken) {
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
    playbackToken,
    drmToken,
    thumbnailToken,
    storyboardToken,
  };
}

export function muxStreamHost(customDomain?: string): string {
  const domain = cleanDomain(customDomain);
  return domain ? `stream.${domain}` : "stream.mux.com";
}

export function muxImageHost(customDomain?: string): string {
  const domain = cleanDomain(customDomain);
  return domain ? `image.${domain}` : "image.mux.com";
}

export function muxPlaybackModifierClaims(
  sourceInput: MuxMediaSource
): MuxPlaybackModifierClaims {
  const source = normalizeMuxSource(sourceInput);
  return {
    ...(source.minResolution
      ? { min_resolution: source.minResolution }
      : {}),
    ...(source.maxResolution
      ? { max_resolution: source.maxResolution }
      : {}),
    ...(source.renditionOrder === "desc"
      ? { rendition_order: "desc" as const }
      : {}),
    ...(source.clipping?.assetStartTime != null
      ? { asset_start_time: source.clipping.assetStartTime }
      : {}),
    ...(source.clipping?.assetEndTime != null
      ? { asset_end_time: source.clipping.assetEndTime }
      : {}),
  };
}

function hasPublicPlaybackModifiers(
  source: NormalizedMuxMediaSource
): boolean {
  return Object.keys(muxPlaybackModifierClaims(source)).length > 0;
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

  if (source.drmToken) {
    throw new Error(
      "Mux DRM requires native FairPlay/Widevine integration. The current Viro HLS path does not provide that backend yet."
    );
  }

  const query = new URLSearchParams();

  if (source.playbackToken) {
    if (hasPublicPlaybackModifiers(source)) {
      throw new Error(
        "Mux playback modifiers for signed playback must be encoded into the playback JWT. Use muxPlaybackModifierClaims() when minting the token instead of appending public query parameters."
      );
    }
    query.set("token", source.playbackToken);
  } else {
    const modifiers = muxPlaybackModifierClaims(source);
    for (const [key, value] of Object.entries(modifiers)) {
      if (value != null) query.set(key, String(value));
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
    query.set("width", String(Math.max(1, Math.round(options.width))));
  }
  if (options.height != null && Number.isFinite(options.height)) {
    query.set("height", String(Math.max(1, Math.round(options.height))));
  }
  if (options.fitMode) {
    query.set("fit_mode", options.fitMode);
  }

  const token = options.token ?? source.thumbnailToken;
  if (token) query.set("token", token);

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

  if (source.storyboardToken) {
    query.set("token", source.storyboardToken);
  }

  const base =
    `https://${muxImageHost(source.customDomain)}/` +
    encodeURIComponent(source.playbackId) +
    "/storyboard.vtt";

  const qs = query.toString();
  return qs ? `${base}?${qs}` : base;
}

export function muxPlaybackFingerprint(
  sourceInput: MuxMediaSource
): string {
  const source = normalizeMuxSource(sourceInput);
  return [
    source.playbackId,
    source.playbackToken ?? "",
    source.drmToken ?? "",
    source.customDomain ?? "",
    source.minResolution ?? "",
    source.maxResolution ?? "",
    source.renditionOrder,
    source.clipping?.assetStartTime?.toString() ?? "",
    source.clipping?.assetEndTime?.toString() ?? "",
  ].join("|");
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
