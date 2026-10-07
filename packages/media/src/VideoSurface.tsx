import React, {
  forwardRef,
  useImperativeHandle,
  useMemo,
  useRef,
} from "react";
import { Platform } from "react-native";
import {
  ViroGeometry,
  ViroMaterialVideo,
  ViroMaterials,
  ViroNode,
  ViroQuad,
  ViroVideo,
  isQuest,
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

type AndroidBuildInfo = {
  Manufacturer?: string;
  Brand?: string;
  Model?: string;
};

function isAndroidXRHeadset(): boolean {
  if (Platform.OS !== "android") return false;
  if (isQuest) return true;

  const constants = (Platform.constants ?? {}) as AndroidBuildInfo;
  const signature = [
    constants.Manufacturer,
    constants.Brand,
    constants.Model,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return /\bpico\b|\bquest\b|\boculus\b/.test(signature);
}

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
      stereoMode = "None",
      onBufferStart,
      onBufferEnd,
      onFinish,
      onError,
      onUpdateTime,
    },
    ref
  ) {
    const playerRef = useRef<ViroMaterialVideo | null>(null);
    const safePlayerRef = useRef<ViroVideo | null>(null);
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

    const useSafeXRPath = isAndroidXRHeadset();

    // Viro native geometry must never mount with an unknown material name.
    // Register synchronously before the first native commit; source changes
    // also synchronously replace the material's video source.
    useMemo(() => {
      if (useSafeXRPath) return null;
      ViroMaterials.createMaterials({
        [resolvedMaterial]: {
          diffuseTexture: resolvedSource,
          lightingModel: "Constant",
        },
      });
      return resolvedMaterial;
    }, [resolvedMaterial, resolvedSource, useSafeXRPath]);

    useImperativeHandle(
      ref,
      () => ({
        seekToTime(timeInSeconds: number) {
          if (useSafeXRPath) {
            safePlayerRef.current?.seekToTime(timeInSeconds);
          } else {
            playerRef.current?.seekToTime(timeInSeconds);
          }
        },
      }),
      [useSafeXRPath]
    );

    const mesh = useMemo(
      () =>
        curvature <= 0
          ? null
          : buildCurvedVideoGeometry(width, height, curvature, segments),
      [curvature, height, segments, width]
    );

    // The legacy ViroMaterialVideo path is known to deadlock OpenXR scene
    // creation on Quest/PICO. Until ViroCore/Eskiu exposes a safe external
    // video-texture surface, XR headsets intentionally degrade curved video
    // to ViroVideo's verified flat native path instead of risking an ANR.
    if (useSafeXRPath) {
      return (
        <ViroNode position={position} rotation={rotation} scale={scale}>
          <ViroVideo
            ref={safePlayerRef}
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
