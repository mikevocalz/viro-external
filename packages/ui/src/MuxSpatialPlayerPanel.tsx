import React, { useRef, useState } from "react";
import { ViroNode } from "@reactvision/react-viro";
import type { Vec3 } from "@viro-external/core";
import {
  MuxSpatialPlayer,
  type MuxMaxResolution,
  type MuxMediaSource,
  type MuxPosterSource,
  type MuxSpatialPlayerHandle,
  type SpatialPlayerStatus,
  type VideoPresentation,
} from "@viro-external/media";
import { PanelButton } from "./PanelButton";
import { SpatialPanel, type SpatialPanelShape } from "./SpatialPanel";

export type MuxSpatialPlayerPanelProps = {
  source: MuxMediaSource | string;
  title?: string;
  width?: number;
  height?: number;
  shape?: SpatialPanelShape;
  presentation?: VideoPresentation;
  curvature?: number;
  position?: Vec3;
  rotation?: Vec3;
  autoPlay?: boolean;
  muted?: boolean;
  loop?: boolean;
  poster?: MuxPosterSource;
  posterTime?: number;
  onStatusChange?: (status: SpatialPlayerStatus) => void;
  onClose?: () => void;
};

const QUALITY_CYCLE: Array<MuxMaxResolution | undefined> = [
  undefined,
  "720p",
  "1080p",
  "1440p",
  "2160p",
];

function qualityLabel(value: MuxMaxResolution | undefined): string {
  return value ?? "Auto";
}

export function MuxSpatialPlayerPanel({
  source,
  title = "Video",
  width = 1.85,
  height = 1.2,
  shape = "rounded",
  presentation = "flat",
  curvature = 0.32,
  position,
  rotation,
  autoPlay = false,
  muted = false,
  loop = false,
  poster = true,
  posterTime,
  onStatusChange,
  onClose,
}: MuxSpatialPlayerPanelProps): React.ReactElement {
  const playerRef = useRef<MuxSpatialPlayerHandle | null>(null);
  const [mode, setMode] = useState<VideoPresentation>(presentation);
  const [quality, setQuality] = useState<MuxMaxResolution | undefined>(
    typeof source === "string" ? undefined : source.maxResolution
  );
  const [status, setStatus] = useState<SpatialPlayerStatus>({
    status: "idle",
    currentTime: 0,
    duration: 0,
    muted,
    volume: 1,
    loop,
  });

  const videoWidth = width * 0.92;
  const videoHeight = height * 0.66;
  const controlsY = -height * 0.41;
  const basePresentation: VideoPresentation =
    presentation === "360" ? "flat" : presentation;

  const commitStatus = (next: SpatialPlayerStatus) => {
    setStatus(next);
    onStatusChange?.(next);
  };

  const cycleQuality = async () => {
    const currentIndex = QUALITY_CYCLE.findIndex(
      (entry) => entry === quality
    );
    const next =
      QUALITY_CYCLE[(currentIndex + 1) % QUALITY_CYCLE.length];

    await playerRef.current?.setMaxResolution(next);
    setQuality(next);
  };

  const isPlaying = status.status === "playing";
  const isMuted = status.muted;
  const qualityLocked =
    typeof source !== "string" &&
    Boolean(source.playbackToken ?? source.tokens?.playback);

  return (
    <SpatialPanel
      title={title}
      subtitle={
        status.status === "buffering"
          ? "Buffering…"
          : qualityLabel(quality)
      }
      width={width}
      height={height}
      shape={shape}
      curvature={curvature}
      position={position}
      rotation={rotation}
      onClose={onClose}
      headerActions={[
        {
          id: "mode",
          label: mode === "360" ? "2D" : "360",
          onPress: () =>
            setMode((current) =>
              current === "360" ? basePresentation : "360"
            ),
        },
        {
          id: "quality",
          label: qualityLocked ? "JWT" : qualityLabel(quality),
          disabled: qualityLocked,
          onPress: () => {
            void cycleQuality();
          },
        },
      ]}
    >
      <MuxSpatialPlayer
        ref={playerRef}
        source={source}
        presentation={mode}
        width={videoWidth}
        height={videoHeight}
        curvature={curvature}
        position={[0, height * 0.085, 0.02]}
        autoPlay={autoPlay}
        muted={muted}
        loop={loop}
        poster={poster}
        posterTime={posterTime}
        onStatusChange={commitStatus}
      />

      <ViroNode position={[0, controlsY, 0.03]}>
        <PanelButton
          label={isPlaying ? "Pause" : "Play"}
          width={0.22}
          onPress={() => {
            const command = isPlaying
              ? playerRef.current?.pause()
              : playerRef.current?.play();
            void command;
          }}
          position={[-0.34, 0, 0]}
        />
        <PanelButton
          label="-10s"
          width={0.18}
          onPress={() => {
            void playerRef.current?.seekBy(-10);
          }}
          position={[-0.11, 0, 0]}
        />
        <PanelButton
          label="+10s"
          width={0.18}
          onPress={() => {
            void playerRef.current?.seekBy(10);
          }}
          position={[0.1, 0, 0]}
        />
        <PanelButton
          label={isMuted ? "Unmute" : "Mute"}
          width={0.22}
          onPress={() => {
            void playerRef.current?.setMuted(!isMuted);
          }}
          position={[0.34, 0, 0]}
        />
      </ViroNode>
    </SpatialPanel>
  );
}
