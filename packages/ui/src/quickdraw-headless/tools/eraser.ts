// `eraser`, ported from QuickDraw `editor.js` `_beginErase`, `_extendErase`,
// `_eraseAt`, `_endErase`: hits accumulate along the swept path and every hit
// shape is removed in one transaction at the lift, so the erase undoes as one.
import type { BeginTool } from "../board-context";
import type { Point } from "../geometry";

const TRAIL_MAX = 40;

export const beginEraser: BeginTool = (ctx, sample, _view, page, release) => {
  const hits = new Set<string>();
  const trail: number[] = [page.x, page.y];
  let last = page;
  let isOpen = true;
  const eraseAt = (p: Point) => {
    const hit = ctx.hitTest(p);
    if (hit) hits.add(hit.id);
  };
  const close = () => {
    if (!isOpen) return;
    isOpen = false;
    release();
    ctx.overlayChanged();
  };
  eraseAt(page);
  ctx.overlayChanged();
  return {
    holdsHistory: false,
    move(_s, _v, p) {
      const steps = Math.max(1, Math.ceil(Math.hypot(p.x - last.x, p.y - last.y) / (6 / ctx.camera().z)));
      for (let i = 1; i <= steps; i++) {
        eraseAt({ x: last.x + ((p.x - last.x) * i) / steps, y: last.y + ((p.y - last.y) * i) / steps });
      }
      trail.push(p.x, p.y);
      if (trail.length > TRAIL_MAX) trail.splice(0, trail.length - TRAIL_MAX);
      last = p;
      ctx.overlayChanged();
    },
    end() {
      const ids = [...hits];
      close();
      if (ids.length) ctx.store.remove(ids);
    },
    cancel: close,
    drop: close,
    contribute(acc) {
      acc.eraserTrails.push({ pointerId: sample.pointerId, points: trail.slice() });
      for (const id of hits) acc.pendingEraseIds.add(id);
    },
  };
};
