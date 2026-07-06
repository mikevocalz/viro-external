import type { Vec3 } from "react-native-viro-mux";

/**
 * Concentric-arc math for curving panel chrome onto the video cylinder.
 *
 * MATCHES buildCurvedMesh (react-native-viro-mux/src/ViroMuxSurface.tsx)
 * exactly — same clamp, same arc/chord relation:
 *
 *   c        = clamp(curvature, 0.001, 1)
 *   arcAngle = c · 2π/3                       // c=1 → ~120° span
 *   radius   = width / (2 · sin(arcAngle/2))  // chord across the arc = width
 *   z(θ)     = −(radius·cosθ − radius·cos(arcAngle/2))
 *            = axisZ − radius·cosθ,  axisZ = radius·cos(arcAngle/2)
 *
 * So in the video mesh's local frame (mesh mounted at the panel origin) the
 * cylinder AXIS sits at [0, y, axisZ] with axisZ > 0 (toward the viewer),
 * the arc's deepest point at z = axisZ − radius < 0, and the chord ends at
 * z = 0. Chrome is placed on a concentric cylinder of radius
 * `videoRadius − proud` — a SMALLER radius is CLOSER to the axis, i.e.
 * radially proud of the video toward the viewer.
 *
 * All chrome poses use arc-length parametrization at the chrome radius:
 * a control whose flat layout coordinate is x (meters along the bar) sits at
 * θ = x / chromeRadius, position [r·sinθ, y, −r·cosθ] (axis-local; mount the
 * cluster's wrapper node at [0, y, axisZ]) and rotation [0, −θ·180/π, 0] so
 * its +z face points down the inward radial (−sinθ, 0, cosθ) — at θ=0 that
 * is (0,0,1), facing the viewer.
 */
export interface ArcFrame {
  /** Full video arc angle, radians. */
  arcAngle: number;
  /** Video cylinder radius (chord = video width). */
  videoRadius: number;
  /** z of the cylinder axis in panel-local space (video mesh at origin). */
  axisZ: number;
  /** Chrome backplate radius = videoRadius − proud (radially toward viewer). */
  chromeRadius: number;
}

export function makeArcFrame(
  width: number,
  curvature: number,
  proud = 0.008
): ArcFrame | null {
  if (!(curvature > 0)) return null;
  const c = Math.min(1, Math.max(0.001, curvature));
  const arcAngle = c * ((2 * Math.PI) / 3);
  const videoRadius = width / 2 / Math.sin(arcAngle / 2);
  return {
    arcAngle,
    videoRadius,
    axisZ: videoRadius * Math.cos(arcAngle / 2),
    chromeRadius: videoRadius - proud,
  };
}

/** Flat layout x (meters along the bar) → arc angle. Always evaluated at the
 * chrome radius so every radial layer of the same control shares one θ. */
export function arcTheta(frame: ArcFrame, x: number): number {
  return x / frame.chromeRadius;
}

export interface ArcPose {
  position: Vec3;
  rotation: Vec3;
}

/**
 * Axis-local pose for a control at flat coordinate x, radial offset dz
 * (dz > 0 = toward the viewer, off the chrome backplate), vertical y.
 * Mount under a wrapper node positioned at [0, rowY, frame.axisZ].
 */
export function polarPose(frame: ArcFrame, x: number, dz: number, y = 0): ArcPose {
  const r = frame.chromeRadius - dz;
  const theta = arcTheta(frame, x);
  return {
    position: [r * Math.sin(theta), y, -r * Math.cos(theta)],
    rotation: [0, (-theta * 180) / Math.PI, 0],
  };
}

export interface ArcPlateBuffers {
  vertices: Vec3[];
  normals: Vec3[];
  texcoords: [number, number][];
  triangleIndices: Vec3[];
}

/**
 * Axis-local arc plate spanning flat [xStart, xEnd] at radial offset dz,
 * vertical center yCenter. Same vertex/normal/winding construction as
 * buildCurvedMesh (θ increasing left→right, top row first, triangles
 * [a,c2,b],[b,c2,d]) so it faces the viewer identically to the video mesh.
 * Column count scales with angular span (baseSegments per full video arc).
 */
export function arcPlateBuffers(
  frame: ArcFrame,
  xStart: number,
  xEnd: number,
  height: number,
  dz = 0,
  yCenter = 0,
  baseSegments = 24
): ArcPlateBuffers {
  const r = frame.chromeRadius - dz;
  const t0 = arcTheta(frame, xStart);
  const t1 = arcTheta(frame, xEnd);
  const span = Math.abs(t1 - t0);
  const cols = Math.max(2, Math.ceil((baseSegments * span) / frame.arcAngle) + 1);
  const halfH = height / 2;

  const vertices: Vec3[] = [];
  const normals: Vec3[] = [];
  const texcoords: [number, number][] = [];
  for (let row = 0; row < 2; row++) {
    const v = row; // 0 = top, 1 = bottom
    const y = yCenter + halfH - v * height;
    for (let i = 0; i < cols; i++) {
      const t = i / (cols - 1);
      const theta = t0 + t * (t1 - t0);
      vertices.push([r * Math.sin(theta), y, -r * Math.cos(theta)]);
      normals.push([Math.sin(theta), 0, -Math.cos(theta)]);
      texcoords.push([t, v]);
    }
  }

  const triangleIndices: Vec3[] = [];
  for (let i = 0; i < cols - 1; i++) {
    const a = i;
    const b = a + 1;
    const c2 = a + cols;
    const d = c2 + 1;
    triangleIndices.push([a, c2, b]);
    triangleIndices.push([b, c2, d]);
  }

  return { vertices, normals, texcoords, triangleIndices };
}
