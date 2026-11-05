import type { Vec3 } from "@viro-external/core";

export type PanelGeometry = {
  vertices: Vec3[];
  normals: Vec3[];
  texcoords: [number, number][];
  triangleIndices: [number, number, number][];
};

function roundedPerimeter(
  width: number,
  height: number,
  radius: number,
  segments: number
): [number, number][] {
  const halfW = width / 2;
  const halfH = height / 2;
  const r = Math.min(radius, halfW, halfH);
  const cx = halfW - r;
  const cy = halfH - r;
  const corners: Array<[number, number, number]> = [
    [cx, cy, 0],
    [-cx, cy, Math.PI / 2],
    [-cx, -cy, Math.PI],
    [cx, -cy, (3 * Math.PI) / 2],
  ];

  const points: [number, number][] = [];
  for (const [ox, oy, start] of corners) {
    for (let i = 0; i <= segments; i += 1) {
      const angle = start + (i / segments) * (Math.PI / 2);
      points.push([
        ox + r * Math.cos(angle),
        oy + r * Math.sin(angle),
      ]);
    }
  }
  return points;
}

export function buildRoundedPanelGeometry(
  width: number,
  height: number,
  radius: number,
  segments = 12
): PanelGeometry {
  const perimeter = roundedPerimeter(width, height, radius, segments);
  const vertices: Vec3[] = [[0, 0, 0]];
  const texcoords: [number, number][] = [[0.5, 0.5]];

  for (const [x, y] of perimeter) {
    vertices.push([x, y, 0]);
    texcoords.push([x / width + 0.5, y / height + 0.5]);
  }

  const normals: Vec3[] = vertices.map(() => [0, 0, 1]);
  const triangleIndices: [number, number, number][] = [];
  for (let i = 0; i < perimeter.length; i += 1) {
    triangleIndices.push([
      0,
      1 + i,
      1 + ((i + 1) % perimeter.length),
    ]);
  }

  return { vertices, normals, texcoords, triangleIndices };
}

export function buildCurvedPanelGeometry(
  width: number,
  height: number,
  curvature: number,
  segments = 36
): PanelGeometry {
  const c = Math.min(1, Math.max(0.001, curvature));
  const arc = c * ((2 * Math.PI) / 3);
  const radius = width / 2 / Math.sin(arc / 2);
  const columns = Math.max(2, Math.floor(segments));
  const vertices: Vec3[] = [];
  const normals: Vec3[] = [];
  const texcoords: [number, number][] = [];

  for (let row = 0; row < 2; row += 1) {
    const v = row;
    const y = height / 2 - v * height;
    for (let column = 0; column < columns; column += 1) {
      const t = column / (columns - 1);
      const theta = (t - 0.5) * arc;
      vertices.push([
        radius * Math.sin(theta),
        y,
        -(radius * Math.cos(theta) - radius * Math.cos(arc / 2)),
      ]);
      // Face the viewer (+Z at center), consistent with winding and ViroQuad.
      normals.push([-Math.sin(theta), 0, Math.cos(theta)]);
      texcoords.push([t, 1 - v]);
    }
  }

  const triangleIndices: [number, number, number][] = [];
  for (let column = 0; column < columns - 1; column += 1) {
    const a = column;
    const b = a + 1;
    const c2 = a + columns;
    const d = c2 + 1;
    triangleIndices.push([a, c2, b], [b, c2, d]);
  }

  return { vertices, normals, texcoords, triangleIndices };
}

/**
 * Place interactive chrome tangent to the same cylindrical surface produced
 * by buildCurvedPanelGeometry. Shared formula prevents the title bar and hit
 * targets from drifting off the curved panel when width/curvature change.
 */
export function curvedPanelPoseAtX(
  width: number,
  curvature: number,
  x: number
): { position: Vec3; rotation: Vec3 } {
  if (!Number.isFinite(width) || width <= 0 ||
      !Number.isFinite(curvature) || !Number.isFinite(x) ||
      curvature <= 0 || curvature > 1 || Math.abs(x) > width / 2) {
    throw new RangeError("curvedPanelPoseAtX: expected positive width, curvature (0, 1] and an in-bounds x");
  }
  const halfArc = curvature * Math.PI / 3;
  const radius = width / (2 * Math.sin(halfArc));
  const theta = Math.asin(Math.max(-1, Math.min(1, x / radius)));
  const z = radius * (Math.cos(halfArc) - Math.cos(theta));
  return {
    position: [x, 0, z],
    rotation: [0, -theta * 180 / Math.PI, 0],
  };
}
