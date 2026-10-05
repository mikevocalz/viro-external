import React, { useMemo } from "react";
import { ViroGeometry, ViroSphere } from "@reactvision/react-viro";
import type { Vec3 } from "@viro-external/core";
import { buildCurvedPanelGeometry, buildRoundedPanelGeometry } from "./geometry";

export type SpatialMediaPresentation = "flat" | "curved" | "immersive360";

export type SpatialMediaSurfaceProps = {
  materialName: string;
  width?: number;
  height?: number;
  curvature?: number;
  segments?: number;
  presentation?: SpatialMediaPresentation;
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
  position,
  rotation,
  opacity = 1,
  children,
}: SpatialMediaSurfaceProps): React.ReactElement {
  const curved = useMemo(
    () => buildCurvedPanelGeometry(width, height, curvature, segments),
    [curvature, height, segments, width]
  );

  const rounded = useMemo(
    () => buildRoundedPanelGeometry(width, height, Math.min(width, height) * 0.025, 8),
    [height, width]
  );

  if (presentation === "immersive360") {
    return (
      <ViroSphere
        radius={Math.max(width, height) * 1.25}
        widthSegmentCount={segments}
        heightSegmentCount={Math.max(16, Math.floor(segments / 2))}
        materials={[materialName]}
        position={position}
        rotation={rotation}
        opacity={opacity}
      >
        {children}
      </ViroSphere>
    );
  }

  const geometry =
    presentation === "curved" || curvature > 0 ? curved : rounded;

  return (
    <ViroGeometry
      vertices={geometry.vertices}
      normals={geometry.normals}
      texcoords={geometry.texcoords}
      triangleIndices={geometry.triangleIndices}
      materials={[materialName]}
      position={position}
      rotation={rotation}
      opacity={opacity}
    >
      {children}
    </ViroGeometry>
  );
}
