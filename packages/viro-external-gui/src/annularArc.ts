import type { Vec3 } from "react-native-viro-mux";
import type { PlateBuffers } from "./roundedPlate";

/**
 * Annular (ring-sector) geometry in the XY plane, facing +z — the radial-menu
 * primitive: a "donut slice" between innerR/outerR spanning [startDeg, endDeg]
 * (degrees, CCW from +x). Same buffer contract as roundedPlate.ts so the
 * output drops straight into ViroGeometry.
 *
 * UVs are angular/radial: u = fraction along the arc, v = 0 at the inner
 * radius → 1 at the outer (plate) or 0 on the perimeter → 1 on the inset
 * (outline), so a gradient texture could later ride the stroke.
 */

const DEG = Math.PI / 180;

function ring(r: number, a0: number, a1: number, seg: number): [number, number][] {
  const pts: [number, number][] = [];
  for (let i = 0; i <= seg; i++) {
    const a = (a0 + ((a1 - a0) * i) / seg) * DEG;
    pts.push([r * Math.cos(a), r * Math.sin(a)]);
  }
  return pts;
}

/**
 * Filled ring-sector plate: two concentric arcs stitched as an OPEN triangle
 * strip (radial ends are the strip ends). Winding faces +z for endDeg >
 * startDeg. A 360° span closes visually (seam vertices coincide).
 */
export function annularArcBuffers(
  innerR: number,
  outerR: number,
  startDeg: number,
  endDeg: number,
  seg = 16
): PlateBuffers {
  const inner = ring(innerR, startDeg, endDeg, seg);
  const outer = ring(outerR, startDeg, endDeg, seg);
  const vertices: Vec3[] = [];
  const texcoords: [number, number][] = [];
  for (let i = 0; i <= seg; i++) {
    vertices.push([inner[i]![0], inner[i]![1], 0]);
    texcoords.push([i / seg, 0]);
    vertices.push([outer[i]![0], outer[i]![1], 0]);
    texcoords.push([i / seg, 1]);
  }
  const normals: Vec3[] = vertices.map(() => [0, 0, 1]);
  const triangleIndices: [number, number, number][] = [];
  for (let i = 0; i < seg; i++) {
    const a = 2 * i, b = 2 * i + 1, c = 2 * (i + 1), d = 2 * (i + 1) + 1;
    triangleIndices.push([a, b, d]);
    triangleIndices.push([a, d, c]);
  }
  return { vertices, normals, texcoords, triangleIndices };
}

/**
 * Thin outline stroke of the ring sector — the neon border. The stroke band
 * hugs the sector's perimeter (inner arc + outer arc + both radial ends) and
 * extends INWARD by `band` × radial depth (default 15%): outer path = the
 * sector perimeter, inset path = the same loop pulled in radially by t and
 * angularly by t/midR, stitched as a CLOSED strip (roundedBorderBuffers
 * pattern), so corners are covered exactly once — no additive double-draw.
 *
 * Spans ≥ 360° degenerate the radial ends into a seam spoke, so a full
 * circle instead returns a single thin centered ring (the outline of a
 * circle IS a thin ring).
 */
export function annularArcOutlineBuffers(
  innerR: number,
  outerR: number,
  startDeg: number,
  endDeg: number,
  seg = 16,
  band = 0.15
): PlateBuffers {
  const depth = outerR - innerR;
  const t = band * depth;
  const midR = (innerR + outerR) / 2;
  const span = Math.abs(endDeg - startDeg);
  if (span >= 359.99) {
    return annularArcBuffers(midR - t / 2, midR + t / 2, startDeg, endDeg, Math.max(seg, 32));
  }
  const dA = (t / midR) / DEG; // angular inset (degrees) for the radial ends

  // Perimeter loop: inner arc start→end, then outer arc end→start.
  const outerPath = [
    ...ring(innerR, startDeg, endDeg, seg),
    ...ring(outerR, endDeg, startDeg, seg),
  ];
  // Inset loop, index-matched to the perimeter.
  const insetPath = [
    ...ring(innerR + t, startDeg + dA, endDeg - dA, seg),
    ...ring(outerR - t, endDeg - dA, startDeg + dA, seg),
  ];

  const n = outerPath.length;
  const vertices: Vec3[] = [];
  const texcoords: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    vertices.push([outerPath[i]![0], outerPath[i]![1], 0]);
    texcoords.push([i / n, 0]);
    vertices.push([insetPath[i]![0], insetPath[i]![1], 0]);
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
