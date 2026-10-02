import type { Vec3 } from "./types";

export type CurvedVideoGeometry = {
  vertices: Vec3[];
  normals: Vec3[];
  texcoords: [number, number][];
  triangleIndices: Vec3[];
};

/**
 * Builds a horizontally curved video surface whose chord is exactly width.
 * curvature=0 should use the flat ViroQuad path; (0,1] spans up to 120 degrees.
 */
export function buildCurvedVideoGeometry(
  width: number,
  height: number,
  curvature: number,
  segments = 32
): CurvedVideoGeometry {
  const c = Math.min(1, Math.max(0.001, curvature));
  const arcAngle = c * ((2 * Math.PI) / 3);
  const radius = width / 2 / Math.sin(arcAngle / 2);
  const halfH = height / 2;
  const cols = Math.max(2, Math.floor(segments));

  const vertices: Vec3[] = [];
  const normals: Vec3[] = [];
  const texcoords: [number, number][] = [];

  for (let row = 0; row < 2; row += 1) {
    const v = row;
    const y = halfH - v * height;

    for (let column = 0; column < cols; column += 1) {
      const t = column / (cols - 1);
      const theta = (t - 0.5) * arcAngle;
      const x = radius * Math.sin(theta);
      const z = -(radius * Math.cos(theta) - radius * Math.cos(arcAngle / 2));

      vertices.push([x, y, z]);
      normals.push([Math.sin(theta), 0, -Math.cos(theta)]);
      texcoords.push([t, 1 - v]);
    }
  }

  const triangleIndices: Vec3[] = [];
  for (let column = 0; column < cols - 1; column += 1) {
    const a = column;
    const b = a + 1;
    const c2 = a + cols;
    const d = c2 + 1;
    triangleIndices.push([a, c2, b], [b, c2, d]);
  }

  return { vertices, normals, texcoords, triangleIndices };
}
