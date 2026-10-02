import React, { useState } from "react";
import { ViroNode } from "@reactvision/react-viro";
import {
  SpatialVideoPlayer,
  SpatialVideoPlayerView,
  useMuxSpatialPlayer,
  useSpatialVideoPlayer,
  useSpatialVideoPlayerSnapshot,
  type MediaSource,
  type MuxSpatialPlayerSource,
  type VideoPresentation,
} from "@viro-external/media";
import type { Vec3 } from "@viro-external/core";
import { PanelButton } from "./PanelButton";
import {
  SpatialPanel,
  type SpatialPanelShape,
} from "./SpatialPanel";

export type SpatialVideoPlayerPanelProps = {
  player: SpatialVideoPlayer;
  title?: string;
  width?: number;
  height?: number;
  shape?: SpatialPanelShape;
  presentation?: VideoPresentation;
  curvature?: number;
  position?: Vec3;
  rotation?: Vec3;
  onClose?: () => void;
};

export function SpatialVideoPlayerPanel({
  player,
  title = "Video",
  width = 1.8,
  height = 1.18,
  shape = "rounded",
  presentation = "flat",
  curvature = 0.32,
  position,
  rotation,
  onClose,
}: SpatialVideoPlayerPanelProps): React.ReactElement {
  const snapshot = useSpatialVideoPlayerSnapshot(player);
  const [mode, setMode] =
    useState<VideoPresentation>(presentation);
  const basePresentation: VideoPresentation =
    presentation === "360" ? "flat" : presentation;

  const videoWidth = width * 0.92;
  const videoHeight = height * 0.65;
  const controlsY = -height * 0.4;
  const status = snapshot.status;
  const subtitle =
    status.duration > 0
      ? `${status.status} · ${formatTime(status.currentTime)} / ${formatTime(status.duration)}`
      : status.status;

  return (
    <SpatialPanel
      title={title}
      subtitle={subtitle}
      width={width}
      height={height}
      shape={shape}
      curvature={curvature}
      position={position}
      rotation={rotation}
      onClose={() => {
        player.pause();
        onClose?.();
      }}
      headerActions={[
        {
          id: "mode",
          label: mode === "360" ? "2D" : "360",
          onPress: () =>
            setMode((current) =>
              current === "360"
                ? basePresentation
                : "360"
            ),
        },
      ]}
    >
      <SpatialVideoPlayerView
        player={player}
        presentation={mode}
        width={videoWidth}
        height={videoHeight}
        curvature={curvature}
        position={[0, height * 0.08, 0.02]}
      />

      <ViroNode position={[0, controlsY, 0.03]}>
        <PanelButton
          label={snapshot.paused ? "Play" : "Pause"}
          width={0.22}
          onPress={() => player.togglePlay()}
          position={[-0.39, 0, 0]}
        />
        <PanelButton
          label={snapshot.muted ? "Unmute" : "Mute"}
          width={0.22}
          onPress={() =>
            player.setMuted(!snapshot.muted)
          }
          position={[-0.14, 0, 0]}
        />
        <PanelButton
          label="-10s"
          width={0.18}
          onPress={() => player.seekBy(-10)}
          position={[0.09, 0, 0]}
        />
        <PanelButton
          label="+10s"
          width={0.18}
          onPress={() => player.seekBy(10)}
          position={[0.3, 0, 0]}
        />
        <PanelButton
          label="Replay"
          width={0.2}
          onPress={() => player.replay()}
          position={[0.52, 0, 0]}
        />
      </ViroNode>
    </SpatialPanel>
  );
}

export type VideoPlayerPanelProps = Omit<
  SpatialVideoPlayerPanelProps,
  "player"
> & {
  source: MediaSource;
  defaultPaused?: boolean;
  defaultMuted?: boolean;
  defaultLoop?: boolean;
};

export function VideoPlayerPanel({
  source,
  defaultPaused = false,
  defaultMuted = false,
  defaultLoop = false,
  ...panelProps
}: VideoPlayerPanelProps): React.ReactElement {
  const player = useSpatialVideoPlayer(
    source,
    (instance) => {
      instance.setMuted(defaultMuted);
      instance.setLoop(defaultLoop);
      if (!defaultPaused) instance.play();
    }
  );

  return (
    <SpatialVideoPlayerPanel
      {...panelProps}
      player={player}
    />
  );
}

export type MuxSpatialPlayerPanelProps = Omit<
  SpatialVideoPlayerPanelProps,
  "player"
> & {
  source: MuxSpatialPlayerSource;
  defaultPaused?: boolean;
  defaultMuted?: boolean;
  defaultLoop?: boolean;
};

export function MuxSpatialPlayerPanel({
  source,
  defaultPaused = false,
  defaultMuted = false,
  defaultLoop = false,
  ...panelProps
}: MuxSpatialPlayerPanelProps): React.ReactElement {
  const player = useMuxSpatialPlayer(
    source,
    (instance) => {
      instance.setMuted(defaultMuted);
      instance.setLoop(defaultLoop);
      if (!defaultPaused) instance.play();
    }
  );

  return (
    <SpatialVideoPlayerPanel
      {...panelProps}
      player={player}
    />
  );
}

function formatTime(seconds: number): string {
  const safe = Math.max(
    0,
    Number.isFinite(seconds) ? seconds : 0
  );
  const mins = Math.floor(safe / 60);
  const secs = Math.floor(safe % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
