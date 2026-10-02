import type {
  MuxMaxResolution,
  MuxMediaSource,
  MuxMinResolution,
  MuxRenditionOrder,
  MuxTokens,
} from "../types";

export type NormalizedMuxMediaSource = MuxMediaSource & {
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

const MIN_RESOLUTIONS: MuxMinResolution[] = [
  "480p",
  "540p",
  "720p",
  "1080p",
  "1440p",
  "2160p",
];

const MAX_RESOLUTIONS: MuxMaxResolution[] = [
  "720p",
  "1080p",
  "1440p",
  "2160p",
];

function cleanCustomDomain(domain?: string): string | undefined {
  if (!domain) return undefined;
  const clean = domain
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/, "");
  return clean || undefined;
}

export function muxStreamHost(customDomain?: string): string {
  const domain = cleanCustomDomain(customDomain);
  return domain ? `stream.${domain}` : "stream.mux.com";
}

export function muxImageHost(customDomain?: string): string {
  const domain = cleanCustomDomain(customDomain);
  return domain ? `image.${domain}` : "image.mux.com";
}

export function normalizeMuxMediaSource(
  source: MuxMediaSource
): NormalizedMuxMediaSource {
  const playbackId = source.playbackId.trim();
  if (!playbackId) {
    throw new Error("Mux media source requires a non-empty playbackId.");
  }

  const playbackToken =
    source.playbackToken ?? source.tokens?.playback;
  const drmToken = source.drmToken ?? source.tokens?.drm;
  const thumbnailToken =
    source.thumbnailToken ?? source.tokens?.thumbnail;
  const storyboardToken =
    source.storyboardToken ?? source.tokens?.storyboard;

  if (drmToken && !playbackToken) {
    throw new Error(
      "Mux DRM playback requires both drmToken and playbackToken."
    );
  }

  validateResolutionWindow(
    source.minResolution,
    source.maxResolution
  );
  validateClipping(
    source.clipping?.assetStartTime,
    source.clipping?.assetEndTime
  );

  return {
    ...source,
    playbackId,
    customDomain: cleanCustomDomain(source.customDomain),
    playbackToken,
    drmToken,
    thumbnailToken,
    storyboardToken,
    renditionOrder: source.renditionOrder ?? "default",
  };
}

/**
 * Build the HLS URL consumed by Viro's AVPlayer/Media3-backed video path.
 *
 * Public playback modifiers are added as query parameters. For signed
 * playback, Mux requires those modifiers to be embedded in the signed JWT
 * claims, so only the token itself is appended here.
 */
export function buildMuxPlaybackUrl(
  sourceOrPlaybackId: MuxMediaSource | string,
  legacyTokens?: MuxTokens
): string {
  const source = normalizeMuxMediaSource(
    typeof sourceOrPlaybackId === "string"
      ? {
          provider: "mux",
          playbackId: sourceOrPlaybackId,
          tokens: legacyTokens,
        }
      : sourceOrPlaybackId
  );

  if (source.drmToken) {
    throw new Error(
      "@viro-external/media: DRM-protected Mux playback requires a " +
        "FairPlay/Widevine backend that Viro does not expose yet. " +
        "The premium player will not silently fake DRM support."
    );
  }

  const base =
    `https://${muxStreamHost(source.customDomain)}/` +
    encodeURIComponent(source.playbackId) +
    ".m3u8";
  const params = new URLSearchParams();

  if (source.playbackToken) {
    params.set("token", source.playbackToken);
  } else {
    if (source.minResolution) {
      params.set("min_resolution", source.minResolution);
    }
    if (source.maxResolution) {
      params.set("max_resolution", source.maxResolution);
    }
    if (source.renditionOrder === "desc") {
      params.set("rendition_order", "desc");
    }
    if (source.clipping?.assetStartTime != null) {
      params.set(
        "asset_start_time",
        String(source.clipping.assetStartTime)
      );
    }
    if (source.clipping?.assetEndTime != null) {
      params.set(
        "asset_end_time",
        String(source.clipping.assetEndTime)
      );
    }
  }

  const query = params.toString();
  return query ? `${base}?${query}` : base;
}

export function buildMuxThumbnailUrl(
  sourceInput: MuxMediaSource,
  options: MuxThumbnailOptions = {}
): string {
  const source = normalizeMuxMediaSource(sourceInput);
  const params = new URLSearchParams();
  const token = options.token ?? source.thumbnailToken;

  if (options.time != null && Number.isFinite(options.time)) {
    params.set("time", String(Math.max(0, options.time)));
  }
  if (options.width != null && Number.isFinite(options.width)) {
    params.set("width", String(Math.max(1, Math.round(options.width))));
  }
  if (options.height != null && Number.isFinite(options.height)) {
    params.set("height", String(Math.max(1, Math.round(options.height))));
  }
  if (options.fitMode) {
    params.set("fit_mode", options.fitMode);
  }
  if (token) {
    params.set("token", token);
  }

  const query = params.toString();
  const base =
    `https://${muxImageHost(source.customDomain)}/` +
    encodeURIComponent(source.playbackId) +
    "/thumbnail.jpg";

  return query ? `${base}?${query}` : base;
}

export function buildMuxStoryboardVttUrl(
  sourceInput: MuxMediaSource
): string {
  const source = normalizeMuxMediaSource(sourceInput);
  const base =
    `https://${muxImageHost(source.customDomain)}/` +
    encodeURIComponent(source.playbackId) +
    "/storyboard.vtt";

  return source.storyboardToken
    ? `${base}?token=${encodeURIComponent(source.storyboardToken)}`
    : base;
}

export function muxSource(
  playbackId: string,
  tokens?: MuxTokens
): MuxMediaSource {
  return { provider: "mux", playbackId, tokens };
}

export const muxResolutionSupport = {
  min: MIN_RESOLUTIONS,
  max: MAX_RESOLUTIONS,
} as const;

function validateResolutionWindow(
  minResolution?: MuxMinResolution,
  maxResolution?: MuxMaxResolution
): void {
  if (!minResolution || !maxResolution) return;
  const min = Number(minResolution.replace("p", ""));
  const max = Number(maxResolution.replace("p", ""));
  if (min > max) {
    throw new Error(
      `Mux minResolution (${minResolution}) cannot exceed maxResolution (${maxResolution}).`
    );
  }
}

function validateClipping(
  start?: number,
  end?: number
): void {
  if (
    start != null &&
    (!Number.isFinite(start) || start < 0)
  ) {
    throw new Error(
      "Mux clipping.assetStartTime must be a non-negative finite number."
    );
  }
  if (
    end != null &&
    (!Number.isFinite(end) || end < 0)
  ) {
    throw new Error(
      "Mux clipping.assetEndTime must be a non-negative finite number."
    );
  }
  if (start != null && end != null && start >= end) {
    throw new Error(
      "Mux clipping.assetStartTime must be less than assetEndTime."
    );
  }
}
