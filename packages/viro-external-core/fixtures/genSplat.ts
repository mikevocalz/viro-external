/**
 * Deterministic synthetic 4D Gaussian-splat fixture generator.
 *
 * Produces a small procedural scene with known ground-truth position and covariance
 * at every t. Used as test data and as the asserted ground-truth for the temporal
 * kernel (when implemented).
 *
 * Output: a binary `.vsp4` envelope per `doc/Splat-Container.md` with the SPZ base
 * block REPLACED by a simplified self-described block. Until the real SPZ parser
 * lands (see TASKS.md), this fixture writes its own base layout that the temporal
 * kernel can self-test against — clearly tagged so it cannot be confused with a
 * real SPZ payload.
 *
 *   header (32 B) — same layout as doc/Splat-Container.md
 *   base block:
 *     u32 selfBaseMagic = 0x53454C46 ('SELF')
 *     for each Gaussian:
 *       f32 mx, my, mz            // mean
 *       f32 σ                     // isotropic stddev
 *       u8  r, g, b, a            // color
 *   4D block (if tempBasis=1, tempOrder=2):
 *     for each Gaussian:
 *       f32 c1x, c1y, c1z         // linear coeff
 *       f32 c2x, c2y, c2z         // quadratic coeff
 *
 *   Runtime eval at t ∈ [0,1]:
 *     mean(t) = mean₀ + c1·t + c2·t²
 *     covariance(t) = σ² · I    (isotropic — the fixture exercises position kernel only)
 *
 * Run with: `npx tsx fixtures/genSplat.ts <out.vsp4> [--temporal] [--seed N] [--count N]`
 */

import defaults from "../config/defaults.json";

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function rand(): number {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface SyntheticSplat {
  mean: [number, number, number];
  sigma: number;
  color: [number, number, number, number];
  /** Linear time coefficient. */
  c1?: [number, number, number];
  /** Quadratic time coefficient. */
  c2?: [number, number, number];
}

export interface GenSplatOptions {
  count?: number;
  seed?: number;
  temporal?: boolean;
}

export function generateSplats(opts: GenSplatOptions = {}): SyntheticSplat[] {
  const { count = 4096, seed = 1, temporal = false } = opts;
  const rand = mulberry32(seed);
  const splats: SyntheticSplat[] = new Array(count);
  for (let i = 0; i < count; i++) {
    // Place Gaussians inside a unit cube.
    const mean: [number, number, number] = [
      rand() * 2 - 1,
      rand() * 2 - 1,
      rand() * 2 - 1,
    ];
    const sigma = 0.01 + rand() * 0.02;
    const color: [number, number, number, number] = [
      Math.floor(rand() * 256),
      Math.floor(rand() * 256),
      Math.floor(rand() * 256),
      200 + Math.floor(rand() * 56),
    ];
    if (temporal) {
      const c1: [number, number, number] = [
        (rand() - 0.5) * 0.3,
        (rand() - 0.5) * 0.3,
        (rand() - 0.5) * 0.3,
      ];
      const c2: [number, number, number] = [
        (rand() - 0.5) * 0.2,
        (rand() - 0.5) * 0.2,
        (rand() - 0.5) * 0.2,
      ];
      splats[i] = { mean, sigma, color, c1, c2 };
    } else {
      splats[i] = { mean, sigma, color };
    }
  }
  return splats;
}

export function evaluateGroundTruthMean(s: SyntheticSplat, t: number): [number, number, number] {
  const { mean, c1, c2 } = s;
  const cx1 = c1?.[0] ?? 0;
  const cy1 = c1?.[1] ?? 0;
  const cz1 = c1?.[2] ?? 0;
  const cx2 = c2?.[0] ?? 0;
  const cy2 = c2?.[1] ?? 0;
  const cz2 = c2?.[2] ?? 0;
  return [
    mean[0] + cx1 * t + cx2 * t * t,
    mean[1] + cy1 * t + cy2 * t * t,
    mean[2] + cz1 * t + cz2 * t * t,
  ];
}

const SELF_BASE_MAGIC = 0x53454c46; // 'SELF'

export function encodeFixture(splats: SyntheticSplat[], opts: { durationMs: number; temporal: boolean }): ArrayBuffer {
  const HEADER = 32;
  const baseHeader = 4; // SELF magic
  const basePer = 4 * 4 + 4; // 4 floats + 4 bytes
  const tempPer = opts.temporal ? 4 * 6 : 0;
  const total = HEADER + baseHeader + splats.length * (basePer + tempPer);
  const buf = new ArrayBuffer(total);
  const view = new DataView(buf);
  const LE = true;

  let p = 0;
  view.setUint32(p, defaults.gaussianSplat.container.magic, LE); p += 4;
  view.setUint16(p, defaults.gaussianSplat.container.version, LE); p += 2;
  const flags = opts.temporal ? 1 : 0;
  view.setUint16(p, flags, LE); p += 2;
  view.setUint32(p, splats.length, LE); p += 4;
  view.setUint8(p, defaults.gaussianSplat.shDegree); p += 1;
  view.setUint8(p, opts.temporal ? 1 : 0); p += 1; // tempBasis
  view.setUint8(p, 2); p += 1; // tempOrder
  view.setUint8(p, 0); p += 1; // reserved
  view.setUint32(p, opts.durationMs, LE); p += 4;
  // bounds (computed)
  let xmin = Infinity, ymin = Infinity, zmin = Infinity;
  let xmax = -Infinity, ymax = -Infinity, zmax = -Infinity;
  for (const s of splats) {
    if (s.mean[0] < xmin) xmin = s.mean[0]; if (s.mean[0] > xmax) xmax = s.mean[0];
    if (s.mean[1] < ymin) ymin = s.mean[1]; if (s.mean[1] > ymax) ymax = s.mean[1];
    if (s.mean[2] < zmin) zmin = s.mean[2]; if (s.mean[2] > zmax) zmax = s.mean[2];
  }
  for (const v of [xmin, ymin, zmin, xmax, ymax, zmax]) { view.setFloat32(p, v, LE); p += 4; }

  // Base block (self-described).
  view.setUint32(p, SELF_BASE_MAGIC, LE); p += 4;
  for (const s of splats) {
    view.setFloat32(p, s.mean[0], LE); p += 4;
    view.setFloat32(p, s.mean[1], LE); p += 4;
    view.setFloat32(p, s.mean[2], LE); p += 4;
    view.setFloat32(p, s.sigma, LE); p += 4;
    view.setUint8(p, s.color[0]); p += 1;
    view.setUint8(p, s.color[1]); p += 1;
    view.setUint8(p, s.color[2]); p += 1;
    view.setUint8(p, s.color[3]); p += 1;
  }

  // 4D block.
  if (opts.temporal) {
    for (const s of splats) {
      const c1 = s.c1 ?? [0, 0, 0];
      const c2 = s.c2 ?? [0, 0, 0];
      view.setFloat32(p, c1[0], LE); p += 4;
      view.setFloat32(p, c1[1], LE); p += 4;
      view.setFloat32(p, c1[2], LE); p += 4;
      view.setFloat32(p, c2[0], LE); p += 4;
      view.setFloat32(p, c2[1], LE); p += 4;
      view.setFloat32(p, c2[2], LE); p += 4;
    }
  }

  return buf;
}

// Self-check: encode/round-trip-ish — header magic written at byte 0.
if (typeof process !== "undefined" && process.env?.NODE_ENV === "test") {
  const splats = generateSplats({ count: 16, seed: 42, temporal: true });
  console.assert(splats.length === 16, "splat count");
  const t0 = evaluateGroundTruthMean(splats[0]!, 0);
  console.assert(
    t0[0] === splats[0]!.mean[0] && t0[1] === splats[0]!.mean[1] && t0[2] === splats[0]!.mean[2],
    "ground truth at t=0 equals mean"
  );
  const buf = encodeFixture(splats, { durationMs: 1000, temporal: true });
  const view = new DataView(buf);
  console.assert(view.getUint32(0, true) === defaults.gaussianSplat.container.magic, "header magic at byte 0");
}
