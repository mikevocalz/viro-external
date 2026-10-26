// Bounds, point hit-tests and marquee tests for QuickDraw shapes. Shape types
// whose geometry needs no font metrics go straight to QuickDraw's own
// `localBounds`/`hitShape`; `text` and `note` follow the same `shapes.js`
// rules (MIT) with measurement from the host.
import { SIZES, hitShape as qdHitShape, localBounds as qdLocalBounds } from "@quickdrawjs/core";
import type { Bounds, ShapeRecord, Store } from "@quickdrawjs/core";
import {
  boundsContain,
  boundsIntersect,
  geoPolygon,
  pointInPolygon,
  rotWith,
  sampleLinePts,
  segIntersectsBounds,
  type Point,
} from "./geometry";
import { NOTE_W, type TextLayoutEngine } from "./text-layout";

export type ShapeGeometry = {
  localBounds(shape: ShapeRecord): Bounds;
  pageBounds(shape: ShapeRecord): Bounds;
  toLocal(shape: ShapeRecord, px: number, py: number): Point;
  hitShape(shape: ShapeRecord, px: number, py: number, tol: number): boolean;
  marqueeHits(shape: ShapeRecord, rect: Bounds): boolean;
};

const isMeasured = (shape: ShapeRecord): boolean => shape.type === "text" || shape.type === "note";
const sizeOf = (size: unknown): number => (SIZES as Record<string, number>)[String(size)] ?? SIZES.m;

export function createShapeGeometry(store: Store, text: TextLayoutEngine): ShapeGeometry {
  const localBounds = (shape: ShapeRecord): Bounds => {
    if (shape.type === "text") {
      const l = text.textLayout(shape);
      return { x: 0, y: 0, w: l.w, h: l.h };
    }
    if (shape.type === "note") {
      const scale = shape.props.scale || 1;
      return { x: 0, y: 0, w: NOTE_W * scale, h: text.noteLayout(shape).boxH * scale };
    }
    return qdLocalBounds(shape);
  };

  const pageBounds = (shape: ShapeRecord): Bounds => {
    const lb = localBounds(shape);
    if (!shape.rot) return { x: shape.x + lb.x, y: shape.y + lb.y, w: lb.w, h: lb.h };
    const cx = shape.x + lb.x + lb.w / 2;
    const cy = shape.y + lb.y + lb.h / 2;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    const corners: Array<[number, number]> = [
      [shape.x + lb.x, shape.y + lb.y],
      [shape.x + lb.x + lb.w, shape.y + lb.y],
      [shape.x + lb.x + lb.w, shape.y + lb.y + lb.h],
      [shape.x + lb.x, shape.y + lb.y + lb.h],
    ];
    for (const [px, py] of corners) {
      const r = rotWith(px, py, cx, cy, shape.rot);
      if (r.x < minX) minX = r.x;
      if (r.x > maxX) maxX = r.x;
      if (r.y < minY) minY = r.y;
      if (r.y > maxY) maxY = r.y;
    }
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  };

  const toLocal = (shape: ShapeRecord, px: number, py: number): Point => {
    if (shape.rot) {
      const lb = localBounds(shape);
      const cx = shape.x + lb.x + lb.w / 2;
      const cy = shape.y + lb.y + lb.h / 2;
      const r = rotWith(px, py, cx, cy, -shape.rot);
      return { x: r.x - shape.x, y: r.y - shape.y };
    }
    return { x: px - shape.x, y: py - shape.y };
  };

  const hitShape = (shape: ShapeRecord, px: number, py: number, tol: number): boolean => {
    if (!isMeasured(shape)) return qdHitShape(shape, px, py, tol, store);
    const b = pageBounds(shape);
    const wide = tol + sizeOf(shape.props.size) * 2;
    if (!boundsContain({ x: b.x - wide, y: b.y - wide, w: b.w + wide * 2, h: b.h + wide * 2 }, px, py)) return false;
    const l = toLocal(shape, px, py);
    const lb = localBounds(shape);
    return l.x >= lb.x - tol && l.x <= lb.x + lb.w + tol && l.y >= lb.y - tol && l.y <= lb.y + lb.h + tol;
  };

  const marqueeHits = (shape: ShapeRecord, rect: Bounds): boolean => {
    const b = pageBounds(shape);
    if (!boundsIntersect(b, rect)) return false;
    if (shape.type === "text" || shape.type === "note" || shape.type === "image") return true;
    if (shape.type === "geo" && shape.props.fill !== "none") return true;
    if (shape.rot) return true;
    const p = shape.props;
    const local = { x: rect.x - shape.x, y: rect.y - shape.y, w: rect.w, h: rect.h };
    let pts: readonly number[] | undefined;
    let stride = 2;
    if (shape.type === "draw" || shape.type === "highlight") {
      pts = p.pts;
      stride = 3;
    } else if (shape.type === "arrow" || shape.type === "line") {
      pts = sampleLinePts(p as { dx: number; dy: number }, p.bend || 0);
    } else if (shape.type === "geo") {
      pts = geoPolygon(p.geo, p.w, p.h);
      if (pointInPolygon(local.x + local.w / 2, local.y + local.h / 2, pts)) return true;
    }
    if (!pts) return true;
    const n = Math.floor(pts.length / stride);
    if (n === 1) return boundsContain(local, pts[0]!, pts[1]!);
    for (let i = 0; i < n - 1; i++) {
      if (
        segIntersectsBounds(
          pts[i * stride]!, pts[i * stride + 1]!, pts[(i + 1) * stride]!, pts[(i + 1) * stride + 1]!, local,
        )
      ) return true;
    }
    if (shape.type === "geo" && n > 2) {
      if (segIntersectsBounds(pts[(n - 1) * stride]!, pts[(n - 1) * stride + 1]!, pts[0]!, pts[1]!, local)) return true;
    }
    return false;
  };

  return { localBounds, pageBounds, toLocal, hitShape, marqueeHits };
}
