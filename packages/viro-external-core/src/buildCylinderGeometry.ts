/**
 * Pure geometry generator for a parametric cylinder / cone / truncated cone /
 * partial wrap. Exported so @viro-external/gui can reuse it for CylinderPanel.
 */

export interface BuildCylinderOptions {
  height: number;
  radiusTop: number;
  radiusBottom: number;
  radialSegments: number;
  heightSegments: number;
  thetaStart: number;
  thetaLength: number;
  openEnded: boolean;
}

export interface CylinderGeometryBuffers {
  positions: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  indices: Uint32Array;
}

function pushVertex(
  out: { p: number[]; n: number[]; u: number[] },
  px: number, py: number, pz: number,
  nx: number, ny: number, nz: number,
  uu: number, vv: number
): number {
  const idx = out.p.length / 3;
  out.p.push(px, py, pz);
  out.n.push(nx, ny, nz);
  out.u.push(uu, vv);
  return idx;
}

export function buildCylinderGeometry(opts: BuildCylinderOptions): CylinderGeometryBuffers {
  const {
    height, radiusTop, radiusBottom,
    radialSegments, heightSegments,
    thetaStart, thetaLength, openEnded,
  } = opts;

  if (radialSegments < 3) throw new Error("radialSegments must be >= 3");
  if (heightSegments < 1) throw new Error("heightSegments must be >= 1");
  if (height <= 0) throw new Error("height must be > 0");

  const slope = (radiusBottom - radiusTop) / height;
  const halfH = height / 2;

  const out = { p: [] as number[], n: [] as number[], u: [] as number[] };
  const indices: number[] = [];

  // Lateral surface — (radialSegments+1) × (heightSegments+1) grid; duplicate the seam so UVs wrap cleanly.
  const grid: number[][] = [];
  for (let j = 0; j <= heightSegments; j++) {
    const v = j / heightSegments;
    const y = halfH - v * height;
    const radius = radiusTop + v * (radiusBottom - radiusTop);
    const row: number[] = [];
    for (let i = 0; i <= radialSegments; i++) {
      const u = i / radialSegments;
      const theta = thetaStart + u * thetaLength;
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);
      const px = radius * cosT;
      const pz = radius * sinT;
      // Normal — tilted for cones.
      const nLen = Math.hypot(cosT, slope, sinT) || 1;
      const nx = cosT / nLen;
      const ny = slope / nLen;
      const nz = sinT / nLen;
      row.push(pushVertex(out, px, y, pz, nx, ny, nz, u, v));
    }
    grid.push(row);
  }

  for (let j = 0; j < heightSegments; j++) {
    for (let i = 0; i < radialSegments; i++) {
      const a = grid[j]![i]!;
      const b = grid[j]![i + 1]!;
      const c = grid[j + 1]![i]!;
      const d = grid[j + 1]![i + 1]!;
      indices.push(a, c, b);
      indices.push(b, c, d);
    }
  }

  // Caps.
  if (!openEnded) {
    // Top cap (radiusTop > 0) — fan around (0, +halfH, 0).
    if (radiusTop > 0) {
      const centerIdx = pushVertex(out, 0, halfH, 0, 0, 1, 0, 0.5, 0.5);
      const ringStart = out.p.length / 3;
      for (let i = 0; i <= radialSegments; i++) {
        const u = i / radialSegments;
        const theta = thetaStart + u * thetaLength;
        const cosT = Math.cos(theta);
        const sinT = Math.sin(theta);
        pushVertex(
          out,
          radiusTop * cosT, halfH, radiusTop * sinT,
          0, 1, 0,
          0.5 + 0.5 * cosT, 0.5 + 0.5 * sinT
        );
      }
      for (let i = 0; i < radialSegments; i++) {
        indices.push(centerIdx, ringStart + i, ringStart + i + 1);
      }
    }
    // Bottom cap (radiusBottom > 0).
    if (radiusBottom > 0) {
      const centerIdx = pushVertex(out, 0, -halfH, 0, 0, -1, 0, 0.5, 0.5);
      const ringStart = out.p.length / 3;
      for (let i = 0; i <= radialSegments; i++) {
        const u = i / radialSegments;
        const theta = thetaStart + u * thetaLength;
        const cosT = Math.cos(theta);
        const sinT = Math.sin(theta);
        pushVertex(
          out,
          radiusBottom * cosT, -halfH, radiusBottom * sinT,
          0, -1, 0,
          0.5 + 0.5 * cosT, 0.5 - 0.5 * sinT
        );
      }
      for (let i = 0; i < radialSegments; i++) {
        indices.push(centerIdx, ringStart + i + 1, ringStart + i);
      }
    }
  }

  return {
    positions: new Float32Array(out.p),
    normals: new Float32Array(out.n),
    uvs: new Float32Array(out.u),
    indices: new Uint32Array(indices),
  };
}

// Self-check: closed cylinder vertex/index counts match the formula.
const nodeEnv = (
  globalThis as typeof globalThis & {
    process?: { env?: { NODE_ENV?: string } };
  }
).process?.env?.NODE_ENV;

if (nodeEnv === "test") {
  const g = buildCylinderGeometry({
    height: 1, radiusTop: 0.5, radiusBottom: 0.5,
    radialSegments: 8, heightSegments: 1,
    thetaStart: 0, thetaLength: Math.PI * 2,
    openEnded: false,
  });
  const lateralVerts = (8 + 1) * (1 + 1);
  const capVerts = 2 * (1 + (8 + 1)); // 2 caps, each = 1 center + (radialSegments+1) ring
  console.assert(g.positions.length / 3 === lateralVerts + capVerts, "vertex count");
  const lateralTris = 8 * 1 * 2;
  const capTris = 2 * 8;
  console.assert(g.indices.length / 3 === lateralTris + capTris, "triangle count");
}
