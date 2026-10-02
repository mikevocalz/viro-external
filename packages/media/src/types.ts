export type Vec3 = [number, number, number];

export type VideoStereoMode =
  | "LeftRight"
  | "RightLeft"
  | "TopBottom"
  | "BottomTop"
  | "None";

export type VideoPresentation = "flat" | "curved" | "360";

export type MuxMinResolution =
  | "480p"
  | "540p"
  | "720p"
  | "1080p"
  | "1440p"
  | "2160p";

export type MuxMaxResolution =
  | "720p"
  | "1080p"
  | "1440p"
  | "2160p";

export type MuxRenditionOrder = "default" | "desc";

export type MuxTokens = {
  /** Signed Mux video playback JWT. */
  playback?: string;
  /** FairPlay/Widevine DRM token. The current Viro backend does not consume this yet. */
  drm?: string;
  /** Signed thumbnail JWT. */
  thumbnail?: string;
  /** Signed storyboard JWT. */
  storyboard?: string;
};

export type MuxMediaMetadata = {
  envKey?: string;
  playerName?: string;
  playerVersion?: string;
  videoTitle?: string;
  videoId?: string;
  videoSeries?: string;
  viewerUserId?: string;
  customData?: Record<string, string | undefined>;
};

export type MuxMediaClipping = {
  assetStartTime?: number;
  assetEndTime?: number;
};

export type UrlMediaSource = {
  provider?: "url";
  uri: string;
};

export type MuxMediaSource = {
  provider: "mux";
  playbackId: string;
  assetId?: string;

  /** Preferred explicit token fields. */
  playbackToken?: string;
  drmToken?: string;
  thumbnailToken?: string;
  storyboardToken?: string;

  /** Backward-compatible token bag from @viro-external/media 0.1. */
  tokens?: MuxTokens;

  /**
   * Base custom domain, e.g. "media.example.com".
   * Video resolves through stream.<domain>, images through image.<domain>.
   */
  customDomain?: string;

  minResolution?: MuxMinResolution;
  maxResolution?: MuxMaxResolution;
  renditionOrder?: MuxRenditionOrder;
  clipping?: MuxMediaClipping;
  metadata?: MuxMediaMetadata;
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

export type SpatialVideoPlayerStatus = {
  status: SpatialPlaybackStatus;
  currentTime: number;
  duration: number;
  muted: boolean;
  volume: number;
  loop: boolean;
  error?: string;
};

export type SpatialVideoPlayerSnapshot = {
  source?: MediaSource;
  paused: boolean;
  muted: boolean;
  volume: number;
  loop: boolean;
  status: SpatialVideoPlayerStatus;
};
