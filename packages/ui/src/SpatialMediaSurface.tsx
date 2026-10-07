import React, { useMemo } from "react";
import { ViroGeometry, ViroQuad, ViroSphere } from "@reactvision/react-viro";
import type { Vec3 } from "@viro-external/core";
import { buildCurvedPanelGeometry } from "./geometry";

export type SpatialMediaPresentation = "flat" | "curved" | "immersive360";

export type SpatialMediaSurfaceProps = {
  materialName: string;
  width?: number;
  height?: number;
  curvature?: number;
  segments?: number;
  presentation?: SpatialMediaPresentation;
  immersiveRadius?: number;
  position?: Vec3;
  rotation?: Vec3;
  opacity?: number;
  children?: React.ReactNode;
};

/**
 * Presentation-only media geometry.
 *
 * The media texture remains owned by the native producer/external-surface
 * bridge. This component only decides how that live texture is presented in
 * the spatial scene, so controls/chrome can be composed independently.
 */
export function SpatialMediaSurface({
  materialName,
  width = 1.2,
  height = 0.675,
  curvature = 0,
  segments = 48,
  presentation = curvature > 0 ? "curved" : "flat",
  immersiveRadius = 9,
  position,
  rotation,
  opacity = 1,
  children,
}: SpatialMediaSurfaceProps): React.ReactElement {
  const curved = useMemo(
    () => buildCurvedPanelGeometry(width, height, curvature, segments),
    [curvature, height, segments, width]
  );

  if (presentation === "immersive360") {
    return (
      <ViroSphere
        radius={immersiveRadius}
        widthSegmentCount={segments}
        heightSegmentCount={Math.max(16, Math.floor(segments / 2))}
        facesOutward={false}
        scale={[1, -1, 1]}
        materials={[materialName]}
        position={position}
        rotation={rotation}
        opacity={opacity}
      >
        {children}
      </ViroSphere>
    );
  }

  if (presentation === "flat" && curvature <= 0) {
    return (
      <ViroQuad
        width={width}
        height={height}
        materials={[materialName]}
        position={position}
        rotation={rotation}
        opacity={opacity}
      >
        {children}
      </ViroQuad>
    );
  }

  return (
    <ViroGeometry
      vertices={curved.vertices}
      normals={curved.normals}
      texcoords={curved.texcoords}
      triangleIndices={curved.triangleIndices}
      materials={[materialName]}
      position={position}
      rotation={rotation}
      opacity={opacity}
    >
      {children}
    </ViroGeometry>
  );
}
