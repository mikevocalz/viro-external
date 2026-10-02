export type Vec3 = [number, number, number];

export type VideoStereoMode =
  | "LeftRight"
  | "RightLeft"
  | "TopBottom"
  | "BottomTop"
  | "None";

export type VideoPresentation = "flat" | "curved" | "360";

export type MuxMaxResolution = "720p" | "1080p" | "1440p" | "2160p";
export type MuxMinResolution =
  | "480p"
  | "540p"
  | "720p"
  | "1080p"
  | "1440p"
  | "2160p";
export type MuxRenditionOrder = "default" | "desc";

export type MuxTokens = {
  /** Signed Mux playback JWT. */
  playback?: string;
  /** FairPlay/Widevine token. Requires a native DRM-capable Viro backend. */
  drm?: string;
  /** Signed thumbnail token for posters and fallback preview frames. */
  thumbnail?: string;
  /** Signed storyboard token for storyboard.vtt + sprite previews. */
  storyboard?: string;
};

export type MuxVideoClipping = {
  assetStartTime?: number;
  assetEndTime?: number;
};

export type MuxVideoMetadata = {
  envKey?: string;
  playerName?: string;
  playerVersion?: string;
  videoTitle?: string;
  videoId?: string;
  videoSeries?: string;
  viewerUserId?: string;
  customData?: Record<string, string | undefined>;
};

export type UrlMediaSource = {
  provider?: "url";
  uri: string;
};

export type MuxMediaSource = {
  provider: "mux";
  playbackId: string;
  assetId?: string;
  tokens?: MuxTokens;
  /** Base custom domain, e.g. media.example.com. */
  customDomain?: string;
  minResolution?: MuxMinResolution;
  maxResolution?: MuxMaxResolution;
  renditionOrder?: MuxRenditionOrder;
  clipping?: MuxVideoClipping;
  metadata?: MuxVideoMetadata;
};

export type MediaSource = string | UrlMediaSource | MuxMediaSource;

export type MediaPlaybackEvents = {
  onBufferStart?: (event: unknown) => void;
  onBufferEnd?: (event: unknown) => void;
  onFinish?: () => void;
  onError?: (event: unknown) => void;
  onUpdateTime?: (currentTime: number, totalTime: number) => void;
};

export type MediaPlaybackProps = MediaPlaybackEvents & {
  source: MediaSource;
  paused?: boolean;
  muted?: boolean;
  loop?: boolean;
  volume?: number;
  stereoMode?: VideoStereoMode;
};

export type SpatialVideoHandle = {
  seekToTime: (timeInSeconds: number) => void;
};

export type SpatialPlaybackStatus =
  | "idle"
  | "loading"
  | "ready"
  | "buffering"
  | "playing"
  | "paused"
  | "ended"
  | "error";

export type SpatialPlayerStatus = {
  status: SpatialPlaybackStatus;
  currentTime: number;
  duration: number;
  muted: boolean;
  volume: number;
  loop: boolean;
  error?: string;
};
