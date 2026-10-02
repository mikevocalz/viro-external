import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";
import {
  ViroGeometry,
  ViroMaterialVideo,
  ViroMaterials,
  ViroNode,
  ViroQuad,
} from "@reactvision/react-viro";
import { buildCurvedVideoGeometry } from "./buildCurvedVideoGeometry";
import { resolveMediaSource } from "./source";
import type {
  MediaPlaybackProps,
  SpatialVideoHandle,
  Vec3,
} from "./types";

export type VideoSurfaceProps = MediaPlaybackProps & {
  width?: number;
  height?: number;
  /** 0 = flat; values through 1 progressively wrap the surface. */
  curvature?: number;
  segments?: number;
  materialName?: string;
  position?: Vec3;
  rotation?: Vec3;
  scale?: Vec3;
};

let nextMaterialId = 0;

export const VideoSurface = forwardRef<SpatialVideoHandle, VideoSurfaceProps>(
  function VideoSurface(
    {
      source,
      width = 1.6,
      height = 0.9,
      curvature = 0,
      segments = 32,
      materialName,
      position,
      rotation,
      scale,
      paused,
      muted = false,
      loop = false,
      volume = 1,
      onBufferStart,
      onBufferEnd,
      onFinish,
      onError,
      onUpdateTime,
    },
    ref
  ) {
    const playerRef = useRef<ViroMaterialVideo | null>(null);
    const generatedName = useRef<string | null>(null);
    if (generatedName.current === null) {
      nextMaterialId += 1;
      generatedName.current = "vxp_media_" + nextMaterialId;
    }

    const resolvedMaterial =
      materialName ?? generatedName.current ?? "vxp_media_fallback";
    const resolvedSource = useMemo(
      () => resolveMediaSource(source),
      [source]
    );

    useEffect(() => {
      ViroMaterials.createMaterials({
        [resolvedMaterial]: {
          diffuseTexture: resolvedSource,
          lightingModel: "Constant",
        },
      });
    }, [resolvedMaterial, resolvedSource]);

    useImperativeHandle(
      ref,
      () => ({
        seekToTime(timeInSeconds: number) {
          playerRef.current?.seekToTime(timeInSeconds);
        },
      }),
      []
    );

    const mesh = useMemo(
      () =>
        curvature <= 0
          ? null
          : buildCurvedVideoGeometry(width, height, curvature, segments),
      [curvature, height, segments, width]
    );

    return (
      <ViroNode position={position} rotation={rotation} scale={scale}>
        <ViroMaterialVideo
          ref={playerRef}
          material={resolvedMaterial}
          paused={paused}
          muted={muted}
          loop={loop}
          volume={volume}
          onBufferStart={onBufferStart}
          onBufferEnd={onBufferEnd}
          onFinish={onFinish}
          onError={onError}
          onUpdateTime={onUpdateTime}
        />
        {mesh ? (
          <ViroGeometry
            vertices={mesh.vertices}
            normals={mesh.normals}
            texcoords={mesh.texcoords}
            triangleIndices={mesh.triangleIndices}
            materials={[resolvedMaterial]}
          />
        ) : (
          <ViroQuad
            width={width}
            height={height}
            materials={[resolvedMaterial]}
          />
        )}
      </ViroNode>
    );
  }
);
