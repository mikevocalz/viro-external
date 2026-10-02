import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { ViroImage, ViroNode } from "@reactvision/react-viro";
import { SpatialVideo } from "./SpatialVideo";
import {
  buildMuxThumbnailUrl,
  normalizeMuxSource,
} from "./providers/mux";
import type {
  MuxMaxResolution,
  MuxMediaSource,
  SpatialPlayerStatus,
  SpatialVideoHandle,
  Vec3,
  VideoPresentation,
  VideoStereoMode,
} from "./types";

export type MuxPosterSource =
  | boolean
  | string
  | { uri: string };

export type MuxSpatialPlayerProps = {
  source: MuxMediaSource | string;
  presentation?: VideoPresentation;
  width?: number;
  height?: number;
  curvature?: number;
  segments?: number;
  position?: Vec3;
  rotation?: Vec3;
  scale?: Vec3;
  stereoMode?: VideoStereoMode;
  autoPlay?: boolean;
  muted?: boolean;
  loop?: boolean;
  volume?: number;
  poster?: MuxPosterSource;
  posterTime?: number;
  onStatusChange?: (status: SpatialPlayerStatus) => void;
  onPlaybackReady?: () => void;
  onError?: (error: Error) => void;
};

export type MuxSpatialPlayerHandle = {
  play: () => Promise<void>;
  pause: () => Promise<void>;
  replay: () => Promise<void>;
  seekTo: (seconds: number) => Promise<void>;
  seekBy: (seconds: number) => Promise<void>;
  setMuted: (muted: boolean) => Promise<void>;
  setVolume: (volume: number) => Promise<void>;
  setLoop: (loop: boolean) => Promise<void>;
  setMaxResolution: (maxResolution?: MuxMaxResolution) => Promise<void>;
  replace: (source: MuxMediaSource | string) => Promise<void>;
  release: () => Promise<void>;
  getStatus: () => SpatialPlayerStatus;
};

function asMuxSource(source: MuxMediaSource | string): MuxMediaSource {
  return normalizeMuxSource(
    typeof source === "string"
      ? { provider: "mux", playbackId: source }
      : source
  );
}

function errorMessage(value: unknown): string {
  if (value instanceof Error) return value.message;
  if (
    typeof value === "object" &&
    value !== null &&
    "nativeEvent" in value
  ) {
    const nativeEvent = (value as {
      nativeEvent?: { error?: string };
    }).nativeEvent;
    if (nativeEvent?.error) return nativeEvent.error;
  }
  return String(value);
}

export const MuxSpatialPlayer = forwardRef<
  MuxSpatialPlayerHandle,
  MuxSpatialPlayerProps
>(function MuxSpatialPlayer(
  {
    source,
    presentation = "flat",
    width = 1.6,
    height = 0.9,
    curvature = 0.35,
    segments = 32,
    position,
    rotation,
    scale,
    stereoMode = "None",
    autoPlay = false,
    muted: initialMuted = false,
    loop = false,
    volume: initialVolume = 1,
    poster = true,
    posterTime,
    onStatusChange,
    onPlaybackReady,
    onError,
  },
  ref
) {
  const videoRef = useRef<SpatialVideoHandle | null>(null);
  const [muxSource, setMuxSource] = useState<MuxMediaSource>(
    () => asMuxSource(source)
  );
  const [paused, setPaused] = useState(!autoPlay);
  const [muted, setMuted] = useState(initialMuted);
  const [volume, setVolume] = useState(
    Math.min(1, Math.max(0, initialVolume))
  );
  const [looping, setLooping] = useState(loop);
  const pendingResumeAt = useRef<number | null>(null);
  const [showPoster, setShowPoster] = useState(
    poster !== false && presentation !== "360"
  );
  const [status, setStatus] = useState<SpatialPlayerStatus>({
    status: "loading",
    currentTime: 0,
    duration: 0,
    muted: initialMuted,
    volume: Math.min(1, Math.max(0, initialVolume)),
    loop,
  });

  const statusRef = useRef(status);
  statusRef.current = status;

  const patchStatus = (
    patch: Partial<SpatialPlayerStatus>
  ) => {
    setStatus((current) => {
      const next = { ...current, ...patch };
      statusRef.current = next;
      return next;
    });
  };

  useEffect(() => {
    const normalized = asMuxSource(source);
    setMuxSource(normalized);
    setPaused(!autoPlay);
    setShowPoster(
      poster !== false && presentation !== "360"
    );
    patchStatus({
      status: "loading",
      currentTime: 0,
      duration: 0,
      error: undefined,
    });
  }, [source, autoPlay, poster, presentation]);

  useEffect(() => {
    onStatusChange?.(status);
  }, [onStatusChange, status]);

  const posterSource = useMemo(() => {
    if (
      poster === false ||
      presentation === "360"
    ) {
      return null;
    }
    if (typeof poster === "string") {
      return { uri: poster };
    }
    if (
      typeof poster === "object" &&
      poster !== null
    ) {
      return poster;
    }
    return {
      uri: buildMuxThumbnailUrl(muxSource, {
        time: posterTime,
        width: 1280,
      }),
    };
  }, [muxSource, poster, posterTime, presentation]);

  useImperativeHandle(
    ref,
    () => ({
      async play() {
        setPaused(false);
        patchStatus({ status: "playing" });
      },
      async pause() {
        setPaused(true);
        patchStatus({ status: "paused" });
      },
      async replay() {
        videoRef.current?.seekToTime(0);
        patchStatus({
          status: "playing",
          currentTime: 0,
        });
        setPaused(false);
      },
      async seekTo(seconds: number) {
        const next = Math.max(0, seconds);
        videoRef.current?.seekToTime(next);
        patchStatus({ currentTime: next });
      },
      async seekBy(seconds: number) {
        const next = Math.max(
          0,
          statusRef.current.currentTime + seconds
        );
        videoRef.current?.seekToTime(next);
        patchStatus({ currentTime: next });
      },
      async setMuted(nextMuted: boolean) {
        setMuted(nextMuted);
        patchStatus({ muted: nextMuted });
      },
      async setVolume(nextVolume: number) {
        const next = Math.min(
          1,
          Math.max(0, nextVolume)
        );
        setVolume(next);
        patchStatus({ volume: next });
      },
      async setLoop(nextLoop: boolean) {
        setLooping(nextLoop);
        patchStatus({ loop: nextLoop });
      },
      async setMaxResolution(maxResolution) {
        if (muxSource.tokens?.playback && maxResolution) {
          throw new Error(
            "Signed Mux playback requires max resolution to be encoded in the playback JWT."
          );
        }
        pendingResumeAt.current = statusRef.current.currentTime;
        setMuxSource((current) => ({
          ...current,
          maxResolution,
        }));
        patchStatus({ status: "loading" });
      },
      async replace(nextSource) {
        setMuxSource(asMuxSource(nextSource));
        videoRef.current?.seekToTime(0);
        setShowPoster(
          poster !== false && presentation !== "360"
        );
        patchStatus({
          status: "loading",
          currentTime: 0,
          duration: 0,
          error: undefined,
        });
      },
      async release() {
        setPaused(true);
        videoRef.current?.seekToTime(0);
        setShowPoster(false);
        patchStatus({
          status: "idle",
          currentTime: 0,
          duration: 0,
        });
      },
      getStatus() {
        return statusRef.current;
      },
    }),
    [poster, presentation]
  );

  return (
    <ViroNode
      position={position}
      rotation={rotation}
      scale={scale}
    >
      <SpatialVideo
        ref={videoRef}
        source={muxSource}
        presentation={presentation}
        width={width}
        height={height}
        curvature={curvature}
        segments={segments}
        stereoMode={stereoMode}
        paused={paused}
        muted={muted}
        loop={looping}
        volume={volume}
        onBufferStart={() => {
          patchStatus({ status: "buffering" });
        }}
        onBufferEnd={() => {
          const resumeAt = pendingResumeAt.current;
          if (resumeAt != null && resumeAt > 0.5) {
            pendingResumeAt.current = null;
            videoRef.current?.seekToTime(resumeAt);
          }
          patchStatus({
            status: paused ? "ready" : "playing",
          });
          onPlaybackReady?.();
        }}
        onUpdateTime={(currentTime, duration) => {
          if (showPoster) {
            setShowPoster(false);
          }
          patchStatus({
            status: paused ? "paused" : "playing",
            currentTime,
            duration,
          });
        }}
        onFinish={() => {
          patchStatus({
            status: looping ? "playing" : "ended",
          });
        }}
        onError={(event) => {
          const message = errorMessage(event);
          const error = new Error(message);
          patchStatus({
            status: "error",
            error: message,
          });
          onError?.(error);
        }}
      />

      {showPoster && posterSource ? (
        <ViroImage
          source={posterSource}
          width={width}
          height={height}
          position={[0, 0, 0.012]}
          ignoreEventHandling
        />
      ) : null}
    </ViroNode>
  );
});
