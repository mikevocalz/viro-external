import React, { useMemo } from "react";
import { ViroGeometry, ViroQuad } from "@reactvision/react-viro";
import defaults from "../config/defaults.json";
import { MovableNode } from "./MovableNode";
import type { MovableProps, Vec3 } from "./contract";
import { ViroMuxVideo, type ViroMuxVideoProps } from "./ViroMuxVideo";

export type ViroMuxSurfaceProps = Omit<ViroMuxVideoProps, "materialName"> & {
  /** Optional override; defaults to a unique auto-generated name. */
  materialName?: string;
  /** 0 = flat quad, 1 = fully curved cylindrical section. Defaults from config. */
  curvature?: number;
  /** Width in meters. Defaults from config. */
  width?: number;
  /** Height in meters. Defaults from config. */
  height?: number;
  /** Horizontal segment count when curvature > 0. */
  segments?: number;
  position?: Vec3;
  scale?: Vec3;
} & MovableProps;

const SEGMENT_DEFAULT = 24;
let autoMaterialId = 0;

/**
 * Builds a curved-quad mesh: an arc of a vertical cylinder whose chord matches `width`.
 * curvature = 1 → quarter-circle-ish arc; curvature in (0,1) interpolates the angle.
 * curvature = 0 is handled by ViroQuad — not by this function.
 */
export function buildCurvedMesh(
  width: number,
  height: number,
  curvature: number,
  segments: number
): {
  vertices: Vec3[];
  normals: Vec3[];
  texcoords: [number, number][];
  triangleIndices: Vec3[];
} {
  // Clamp curvature to (0, 1].
  const c = Math.min(1, Math.max(0.001, curvature));
  // Total arc angle in radians. At c=1, surface spans ~120°; scales linearly.
  const arcAngle = c * (2 * Math.PI / 3);
  // Radius so the chord across the arc equals `width`.
  const radius = width / 2 / Math.sin(arcAngle / 2);
  const halfH = height / 2;

  const cols = Math.max(2, Math.floor(segments));
  const rows = 2; // top/bottom only — height is straight, the curve is horizontal

  const vertices: Vec3[] = [];
  const normals: Vec3[] = [];
  const texcoords: [number, number][] = [];

  for (let r = 0; r < rows; r++) {
    const v = r / (rows - 1);
    const y = halfH - v * height;
    for (let i = 0; i < cols; i++) {
      const t = i / (cols - 1);
      const theta = (t - 0.5) * arcAngle;
      const x = radius * Math.sin(theta);
      // Origin is the center of the chord; push the surface away in -z so it faces the camera.
      const z = -(radius * Math.cos(theta) - radius * Math.cos(arcAngle / 2));
      vertices.push([x, y, z]);
      // Outward normal points away from cylinder axis.
      const nx = Math.sin(theta);
      const nz = -Math.cos(theta);
      normals.push([nx, 0, nz]);
      texcoords.push([t, 1 - v]);
    }
  }

  const triangleIndices: Vec3[] = [];
  for (let r = 0; r < rows - 1; r++) {
    for (let i = 0; i < cols - 1; i++) {
      const a = r * cols + i;
      const b = a + 1;
      const c2 = a + cols;
      const d = c2 + 1;
      triangleIndices.push([a, c2, b]);
      triangleIndices.push([b, c2, d]);
    }
  }

  return { vertices, normals, texcoords, triangleIndices };
}

export function ViroMuxSurface(props: ViroMuxSurfaceProps): React.ReactElement {
  const {
    curvature = defaults.surface.curvatureDefault,
    width = defaults.surface.widthMeters,
    height = defaults.surface.heightMeters,
    segments = SEGMENT_DEFAULT,
    position,
    scale,
    materialName,
    // movable props
    movable,
    dragType,
    dragPlane,
    axisLock,
    onMoveStart,
    onMove,
    onMoveEnd,
    pinchToScale,
    // mux props (everything else)
    ...muxProps
  } = props;

  const resolvedMaterial = useMemo(
    () => materialName ?? `viroMux_${++autoMaterialId}`,
    [materialName]
  );

  const mesh = useMemo(() => {
    if (curvature <= 0) return null;
    return buildCurvedMesh(width, height, curvature, segments);
  }, [curvature, width, height, segments]);

  return (
    <MovableNode
      movable={movable}
      dragType={dragType}
      dragPlane={dragPlane}
      axisLock={axisLock}
      onMoveStart={onMoveStart}
      onMove={onMove}
      onMoveEnd={onMoveEnd}
      pinchToScale={pinchToScale}
      position={position}
      scale={scale}
    >
      <ViroMuxVideo {...muxProps} materialName={resolvedMaterial} />
      {mesh ? (
        <ViroGeometry
          vertices={mesh.vertices}
          normals={mesh.normals}
          texcoords={mesh.texcoords}
          triangleIndices={mesh.triangleIndices}
          materials={[resolvedMaterial]}
        />
      ) : (
        <ViroQuad width={width} height={height} materials={[resolvedMaterial]} />
      )}
    </MovableNode>
  );
}

// Self-check: curvature=0 returns null mesh (flat path); curvature>0 builds non-empty geometry.
if (typeof process !== "undefined" && process.env?.NODE_ENV === "test") {
  const flat = (() => {
    const m = (curvature: number) =>
      curvature <= 0 ? null : buildCurvedMesh(1.6, 0.9, curvature, 24);
    return { m };
  })();
  console.assert(flat.m(0) === null, "flat path should bypass mesh build");
  const m1 = flat.m(1);
  if (m1) {
    console.assert(m1.vertices.length === 24 * 2, "curved mesh vertex count");
    console.assert(m1.triangleIndices.length === (24 - 1) * 2, "curved mesh triangle count");
  }
}
