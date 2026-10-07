import React, { useMemo } from "react";
import { Viro360Image } from "@reactvision/react-viro";
import type { Vec3, VideoStereoMode } from "./types";

export type PanoramaSource = string | { uri: string } | number;

export type SpatialPanoramaProps = {
  source: PanoramaSource;
  rotation?: Vec3;
  stereoMode?: VideoStereoMode;
  format?: "RGBA8" | "RGB565";
  isHdr?: boolean;
  skyEffect?: boolean;
  onLoadStart?: (event: unknown) => void;
  onLoadEnd?: (event: unknown) => void;
  onError?: (event: unknown) => void;
};

export function SpatialPanorama({
  source,
  rotation,
  stereoMode = "None",
  format,
  isHdr,
  skyEffect,
  onLoadStart,
  onLoadEnd,
  onError,
}: SpatialPanoramaProps): React.ReactElement {
  const resolvedSource = useMemo(
    () => (typeof source === "string" ? { uri: source } : source),
    [source]
  );

  return (
    <Viro360Image
      source={resolvedSource}
      rotation={rotation}
      steroMode={stereoMode}
      format={format}
      isHdr={isHdr}
      skyEffect={skyEffect}
      onLoadStart={onLoadStart}
      onLoadEnd={onLoadEnd}
      onError={onError}
    />
  );
}
