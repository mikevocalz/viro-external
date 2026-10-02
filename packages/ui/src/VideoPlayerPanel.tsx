import React, { useRef, useState } from "react";
import { ViroNode } from "@reactvision/react-viro";
import {
  SpatialVideo,
  type MediaSource,
  type SpatialVideoHandle,
  type VideoPresentation,
} from "@viro-external/media";
import type { Vec3 } from "@viro-external/core";
import { PanelButton } from "./PanelButton";
import { SpatialPanel, type SpatialPanelShape } from "./SpatialPanel";

export type VideoPlayerPanelProps = {
  source: MediaSource;
  title?: string;
  width?: number;
  height?: number;
  shape?: SpatialPanelShape;
  presentation?: VideoPresentation;
  curvature?: number;
  position?: Vec3;
  rotation?: Vec3;
  defaultPaused?: boolean;
  defaultMuted?: boolean;
  onClose?: () => void;
};

export function VideoPlayerPanel({
  source,
  title = "Video",
  width = 1.8,
  height = 1.18,
  shape = "rounded",
  presentation = "flat",
  curvature = 0.32,
  position,
  rotation,
  defaultPaused = false,
  defaultMuted = false,
  onClose,
}: VideoPlayerPanelProps): React.ReactElement {
  const videoRef = useRef<SpatialVideoHandle | null>(null);
  const [paused, setPaused] = useState(defaultPaused);
  const [muted, setMuted] = useState(defaultMuted);
  const [mode, setMode] = useState<VideoPresentation>(presentation);
  const [currentTime, setCurrentTime] = useState(0);
  const basePresentation: VideoPresentation =
    presentation === "360" ? "flat" : presentation;

  const videoWidth = width * 0.92;
  const videoHeight = height * 0.65;
  const controlsY = -height * 0.4;

  return (
    <SpatialPanel
      title={title}
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
      ]}
    >
      <SpatialVideo
        ref={videoRef}
        source={source}
        presentation={mode}
        width={videoWidth}
        height={videoHeight}
        curvature={curvature}
        position={[0, height * 0.08, 0.02]}
        paused={paused}
        muted={muted}
        onUpdateTime={(time) => setCurrentTime(time)}
      />

      <ViroNode position={[0, controlsY, 0.03]}>
        <PanelButton
          label={paused ? "Play" : "Pause"}
          width={0.24}
          onPress={() => setPaused((value) => !value)}
          position={[-0.28, 0, 0]}
        />
        <PanelButton
          label={muted ? "Unmute" : "Mute"}
          width={0.24}
          onPress={() => setMuted((value) => !value)}
          position={[0, 0, 0]}
        />
        <PanelButton
          label="-10s"
          width={0.18}
          onPress={() =>
            videoRef.current?.seekToTime(
              Math.max(0, currentTime - 10)
            )
          }
          position={[0.23, 0, 0]}
        />
        <PanelButton
          label="+10s"
          width={0.18}
          onPress={() =>
            videoRef.current?.seekToTime(currentTime + 10)
          }
          position={[0.44, 0, 0]}
        />
      </ViroNode>
    </SpatialPanel>
  );
}
