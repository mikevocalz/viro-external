export type Vec3 = [number, number, number];

export type VideoStereoMode =
  | "LeftRight"
  | "RightLeft"
  | "TopBottom"
  | "BottomTop"
  | "None";

export type VideoPresentation = "flat" | "curved" | "360";

export type MuxTokens = {
  /** Signed Mux playback JWT. */
  playback?: string;
  /** Optional DRM token for protected playback. */
  drm?: string;
};

export type UrlMediaSource = {
  provider?: "url";
  uri: string;
};

export type MuxMediaSource = {
  provider: "mux";
  playbackId: string;
  tokens?: MuxTokens;
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
