import React, {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";
import {
  Viro360Video,
  ViroNode,
  ViroVideo,
} from "@reactvision/react-viro";
import { resolveMediaSource } from "./source";
import { VideoSurface } from "./VideoSurface";
import type {
  MediaPlaybackProps,
  SpatialVideoHandle,
  Vec3,
  VideoPresentation,
} from "./types";

export type SpatialVideoProps = MediaPlaybackProps & {
  presentation?: VideoPresentation;
  width?: number;
  height?: number;
  curvature?: number;
  segments?: number;
  position?: Vec3;
  rotation?: Vec3;
  scale?: Vec3;
};

export const SpatialVideo = forwardRef<SpatialVideoHandle, SpatialVideoProps>(
  function SpatialVideo(
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
      paused,
      muted = false,
      loop = false,
      volume = 1,
      stereoMode = "None",
      onBufferStart,
      onBufferEnd,
      onFinish,
      onError,
      onUpdateTime,
    },
    ref
  ) {
    const flatRef = useRef<ViroVideo | null>(null);
    const sphereRef = useRef<Viro360Video | null>(null);
    const curvedRef = useRef<SpatialVideoHandle | null>(null);
    const resolvedSource = useMemo(
      () => resolveMediaSource(source),
      [source]
    );

    useImperativeHandle(
      ref,
      () => ({
        seekToTime(timeInSeconds: number) {
          if (presentation === "360") {
            sphereRef.current?.seekToTime(timeInSeconds);
          } else if (presentation === "curved") {
            curvedRef.current?.seekToTime(timeInSeconds);
          } else {
            flatRef.current?.seekToTime(timeInSeconds);
          }
        },
      }),
      [presentation]
    );

    if (presentation === "360") {
      return (
        <Viro360Video
          ref={sphereRef}
          source={resolvedSource}
          paused={paused}
          muted={muted}
          loop={loop}
          volume={volume}
          stereoMode={stereoMode}
          rotation={rotation}
          onBufferStart={onBufferStart}
          onBufferEnd={onBufferEnd}
          onFinish={onFinish}
          onError={onError}
          onUpdateTime={onUpdateTime}
        />
      );
    }

    if (presentation === "curved") {
      return (
        <VideoSurface
          ref={curvedRef}
          source={source}
          width={width}
          height={height}
          curvature={curvature}
          segments={segments}
          position={position}
          rotation={rotation}
          scale={scale}
          paused={paused}
          muted={muted}
          loop={loop}
          volume={volume}
          stereoMode={stereoMode}
          onBufferStart={onBufferStart}
          onBufferEnd={onBufferEnd}
          onFinish={onFinish}
          onError={onError}
          onUpdateTime={onUpdateTime}
        />
      );
    }

    return (
      <ViroNode position={position} rotation={rotation} scale={scale}>
        <ViroVideo
          ref={flatRef}
          source={resolvedSource}
          width={width}
          height={height}
          paused={paused}
          muted={muted}
          loop={loop}
          volume={volume}
          stereoMode={stereoMode}
          onBufferStart={onBufferStart}
          onBufferEnd={onBufferEnd}
          onFinish={onFinish}
          onError={onError}
          onUpdateTime={onUpdateTime}
        />
      </ViroNode>
    );
  }
);
