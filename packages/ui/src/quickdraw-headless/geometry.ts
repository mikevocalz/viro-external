// Geometry helpers from @quickdrawjs/core 0.2.0 `src/geometry.js` and
// `src/shapes.js` (MIT). The package's exports map exposes only its index, and
// the index does not re-export these, so they are carried here unchanged in
// behavior. Keep them in step with the pinned version.
import type { Bounds } from "@quickdrawjs/core";

export type Point = { x: number; y: number };

export const clamp = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

export const boundsUnion = (a: Bounds | undefined, b: Bounds | undefined): Bounds | undefined => {
  if (!a) return b;
  if (!b) return a;
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
};

export const boundsContain = (b: Bounds, x: number, y: number): boolean =>
  x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;

export const boundsIntersect = (a: Bounds, b: Bounds): boolean =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

export const rotWith = (px: number, py: number, cx: number, cy: number, angle: number): Point => {
  if (!angle) return { x: px, y: py };
  const s = Math.sin(angle);
  const c = Math.cos(angle);
  const dx = px - cx;
  const dy = py - cy;
  return { x: cx + dx * c - dy * s, y: cy + dx * s + dy * c };
};

export const pointInPolygon = (px: number, py: number, pts: readonly number[], stride = 2): boolean => {
  let inside = false;
  const n = Math.floor(pts.length / stride);
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = pts[i * stride]!;
    const yi = pts[i * stride + 1]!;
    const xj = pts[j * stride]!;
    const yj = pts[j * stride + 1]!;
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};

export const segIntersectsBounds = (ax: number, ay: number, bx: number, by: number, r: Bounds): boolean => {
  if (boundsContain(r, ax, ay) || boundsContain(r, bx, by)) return true;
  const edges: Array<[number, number, number, number]> = [
    [r.x, r.y, r.x + r.w, r.y],
    [r.x + r.w, r.y, r.x + r.w, r.y + r.h],
    [r.x + r.w, r.y + r.h, r.x, r.y + r.h],
    [r.x, r.y + r.h, r.x, r.y],
  ];
  for (const [cx, cy, dx, dy] of edges) {
    const d1 = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
    const d2 = (bx - ax) * (dy - ay) - (by - ay) * (dx - ax);
    const d3 = (dx - cx) * (ay - cy) - (dy - cy) * (ax - cx);
    const d4 = (dx - cx) * (by - cy) - (dy - cy) * (bx - cx);
    if (d1 * d2 < 0 && d3 * d4 < 0) return true;
  }
  return false;
};

export const geoPolygon = (geo: string, w: number, h: number): number[] => {
  switch (geo) {
    case "triangle":
      return [w / 2, 0, w, h, 0, h];
    case "diamond":
      return [w / 2, 0, w, h / 2, w / 2, h, 0, h / 2];
    case "hexagon": {
      const ix = w * 0.25;
      return [ix, 0, w - ix, 0, w, h / 2, w - ix, h, ix, h, 0, h / 2];
    }
    case "star": {
      const cx = w / 2;
      const cy = h / 2;
      const pts: number[] = [];
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? 1 : 0.45;
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        pts.push(cx + Math.cos(a) * r * cx, cy + Math.sin(a) * r * cy);
      }
      return pts;
    }
    case "rectangle":
    default:
      return [0, 0, w, 0, w, h, 0, h];
  }
};

type LineProps = { dx: number; dy: number };

export const sampleLinePts = (p: LineProps, bend: number): number[] => {
  if (!bend) return [0, 0, p.dx, p.dy];
  const len = Math.hypot(p.dx, p.dy) || 1;
  const nx = -p.dy / len;
  const ny = p.dx / len;
  const cx = p.dx / 2 + nx * bend * 2;
  const cy = p.dy / 2 + ny * bend * 2;
  const pts: number[] = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    const mt = 1 - t;
    pts.push(2 * mt * t * cx + t * t * p.dx, 2 * mt * t * cy + t * t * p.dy);
  }
  return pts;
};

/** Local position of an arrow or line bend handle, as `editor.js` `bendMidpoint`. */
export const bendMidpoint = (p: LineProps & { bend?: number }): Point => {
  if (!p.bend) return { x: p.dx / 2, y: p.dy / 2 };
  const mid = sampleLinePts(p, p.bend);
  const mi = Math.floor(mid.length / 4) * 2;
  return { x: mid[mi]!, y: mid[mi + 1]! };
};
