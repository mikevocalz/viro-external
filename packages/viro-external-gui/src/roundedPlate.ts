import type { Vec3 } from "react-native-viro-mux";

export interface PlateBuffers {
  vertices: Vec3[];
  normals: Vec3[];
  texcoords: [number, number][];
  triangleIndices: [number, number, number][];
}

/**
 * Perimeter loop of a rounded rectangle in the XY plane, CCW starting at the
 * right edge midpoint. 4 corner arcs × (seg+1) points each.
 */
function perimeter(w: number, h: number, r: number, seg: number): [number, number][] {
  const hw = w / 2, hh = h / 2;
  const cr = Math.min(r, hw, hh);
  const cx = hw - cr, cy = hh - cr;
  const corners: Array<[number, number, number]> = [
    [cx, cy, 0],            // top-right    arc   0° → 90°
    [-cx, cy, Math.PI / 2], // top-left     arc  90° → 180°
    [-cx, -cy, Math.PI],    // bottom-left  arc 180° → 270°
    [cx, -cy, 3 * Math.PI / 2], // bottom-right arc 270° → 360°
  ];
  const pts: [number, number][] = [];
  for (const [ox, oy, a0] of corners) {
    for (let i = 0; i <= seg; i++) {
      const a = a0 + (i / seg) * (Math.PI / 2);
      pts.push([ox + cr * Math.cos(a), oy + cr * Math.sin(a)]);
    }
  }
  return pts;
}

/** Filled rounded-rect plate (triangle fan from the center). */
export function roundedPlateBuffers(w: number, h: number, r: number, seg = 12): PlateBuffers {
  const loop = perimeter(w, h, r, seg);
  const vertices: Vec3[] = [[0, 0, 0]];
  const texcoords: [number, number][] = [[0.5, 0.5]];
  for (const [x, y] of loop) {
    vertices.push([x, y, 0]);
    texcoords.push([x / w + 0.5, y / h + 0.5]);
  }
  const normals: Vec3[] = vertices.map(() => [0, 0, 1]);
  const triangleIndices: [number, number, number][] = [];
  const n = loop.length;
  for (let i = 0; i < n; i++) {
    triangleIndices.push([0, 1 + i, 1 + ((i + 1) % n)]);
  }
  return { vertices, normals, texcoords, triangleIndices };
}

/** Rounded-rect outline ring (border glow) of the given thickness. */
export function roundedBorderBuffers(
  w: number, h: number, r: number, thickness: number, seg = 12
): PlateBuffers {
  const inner = perimeter(w, h, r, seg);
  const outer = perimeter(w + 2 * thickness, h + 2 * thickness, r + thickness, seg);
  const vertices: Vec3[] = [];
  const texcoords: [number, number][] = [];
  const n = inner.length;
  for (let i = 0; i < n; i++) {
    vertices.push([inner[i]![0], inner[i]![1], 0]);
    texcoords.push([i / n, 0]);
    vertices.push([outer[i]![0], outer[i]![1], 0]);
    texcoords.push([i / n, 1]);
  }
  const normals: Vec3[] = vertices.map(() => [0, 0, 1]);
  const triangleIndices: [number, number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = 2 * i, b = 2 * i + 1;
    const c = 2 * ((i + 1) % n), d = 2 * ((i + 1) % n) + 1;
    triangleIndices.push([a, b, d]);
    triangleIndices.push([a, d, c]);
  }
  return { vertices, normals, texcoords, triangleIndices };
}
