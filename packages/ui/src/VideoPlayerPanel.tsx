import React, { useState } from "react";
import { ViroNode } from "@reactvision/react-viro";
import {
  SpatialVideoPlayer,
  SpatialVideoPlayerView,
  useSpatialVideoPlayer,
  useSpatialVideoPlayerSnapshot,
  type MediaSource,
  type SpatialVideoPlayerSnapshot,
  type VideoPresentation,
} from "@viro-external/media";
import type { Vec3 } from "@viro-external/core";
import { PanelButton } from "./PanelButton";
import { PANEL_GAP, panelBody, rowLayout } from "./layout";
import {
  SpatialPanel,
  type SpatialPanelShape,
} from "./SpatialPanel";

export type SpatialVideoPlayerPanelProps = {
  player: SpatialVideoPlayer;
  /** Stable id for this panel in the Specs scene. */
  tag?: string;
  title?: string;
  width?: number;
  height?: number;
  shape?: SpatialPanelShape;
  presentation?: VideoPresentation;
  curvature?: number;
  position?: Vec3;
  rotation?: Vec3;
  onStatusChange?: (
    snapshot: SpatialVideoPlayerSnapshot
  ) => void;
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
  onStatusChange,
  onClose,
}: SpatialVideoPlayerPanelProps): React.ReactElement {
  const snapshot = useSpatialVideoPlayerSnapshot(player);
  const [mode, setMode] =
    useState<VideoPresentation>(presentation);
  const basePresentation: VideoPresentation =
    presentation === "360" ? "flat" : presentation;

  // The video fills the body under the header and the controls sit along its
  // bottom edge, all derived from the panel size so nothing leaves the panel.
  const body = panelBody(width, height, true);
  const controlsHeight = 0.06;
  const videoWidth = body.width;
  const videoHeight = Math.max(0.05, body.height - controlsHeight - PANEL_GAP);
  const bodyTop = body.centerY + body.height / 2;
  const videoY = bodyTop - videoHeight / 2;
  const controlsY = body.centerY - body.height / 2 + controlsHeight / 2;
  const controls = [
    { label: snapshot.paused ? "Play" : "Pause", onPress: () => player.togglePlay() },
    { label: snapshot.muted ? "Unmute" : "Mute", onPress: () => player.setMuted(!snapshot.muted) },
    { label: "-10s", onPress: () => player.seekBy(-10) },
    { label: "+10s", onPress: () => player.seekBy(10) },
    { label: "Replay", onPress: () => player.replay() },
  ];
  const buttonGap = 0.012;
  const buttonWidth = (body.width - buttonGap * (controls.length - 1)) / controls.length;
  const buttonXs = rowLayout(controls.map(() => buttonWidth), body.width, buttonGap);
  const status = snapshot.status;
  const subtitle =
    status.duration > 0
      ? `${status.status} · ${formatTime(status.currentTime)} / ${formatTime(status.duration)}`
      : status.status;

  React.useEffect(() => {
    onStatusChange?.(snapshot);
  }, [onStatusChange, snapshot]);

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
        player.release();
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
        position={[0, videoY, 0.002]}
      />

      <ViroNode position={[0, controlsY, 0.004]}>
        {controls.map((control, index) => (
          <PanelButton
            key={index}
            label={control.label}
            width={buttonWidth}
            height={controlsHeight}
            onPress={control.onPress}
            position={[buttonXs[index] ?? 0, 0, 0]}
          />
        ))}
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

function formatTime(seconds: number): string {
  const safe = Math.max(
    0,
    Number.isFinite(seconds) ? seconds : 0
  );
  const mins = Math.floor(safe / 60);
  const secs = Math.floor(safe % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
