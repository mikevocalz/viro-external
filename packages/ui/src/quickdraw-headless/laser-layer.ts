// Laser trails from QuickDraw's `editor.js` (`_beginLaser` … `_laserTick`):
// at most 220 points per trail, fully opaque until 250 ms after the lift, then
// a linear fade over 850 ms. Trails live only here, never in the Store.
import { newId } from "@quickdrawjs/core";
import type { BoardLaserStroke, BoardPoint } from "./BoardOverlay";

const MAX_POINTS = 220;
const HOLD_MS = 250;
const FADE_MS = 850;

type MutableStroke = { id: string; points: BoardPoint[]; opacity: number; endedAtMs: number | undefined };

/** QuickDraw's laser opacity for a trail at `nowMs`. */
export function laserOpacity(stroke: Pick<BoardLaserStroke, "endedAtMs">, nowMs: number): number {
  if (stroke.endedAtMs === undefined) return 1;
  return Math.max(0, 1 - Math.max(0, nowMs - stroke.endedAtMs - HOLD_MS) / FADE_MS);
}

export type LaserLayer = {
  start(point: BoardPoint): MutableStroke;
  extend(stroke: MutableStroke, point: BoardPoint): void;
  finish(stroke: MutableStroke, atMs: number): void;
  /** Returns true when any trail changed. */
  expire(nowMs: number): boolean;
  snapshot(): BoardLaserStroke[];
};

export function createLaserLayer(): LaserLayer {
  let strokes: MutableStroke[] = [];
  return {
    start(point) {
      const stroke: MutableStroke = { id: newId("scrib"), points: [{ ...point }], opacity: 1, endedAtMs: undefined };
      strokes.push(stroke);
      return stroke;
    },
    extend(stroke, point) {
      stroke.points.push({ ...point });
      if (stroke.points.length > MAX_POINTS) stroke.points.splice(0, stroke.points.length - MAX_POINTS);
    },
    finish(stroke, atMs) {
      stroke.endedAtMs = atMs;
    },
    expire(nowMs) {
      let changed = false;
      strokes = strokes.filter((s) => {
        const o = laserOpacity(s, nowMs);
        if (o !== s.opacity) {
          s.opacity = o;
          changed = true;
        }
        if (o <= 0) changed = true;
        return o > 0;
      });
      return changed;
    },
    snapshot() {
      return strokes.map((s) => ({ id: s.id, points: s.points.slice(), opacity: s.opacity, endedAtMs: s.endedAtMs }));
    },
  };
}
