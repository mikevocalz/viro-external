// `laser`, ported from QuickDraw `editor.js` `_beginLaser`, `_extendLaser`,
// `_endLaser`. Overlay only; nothing reaches the Store.
import type { BeginTool } from "../board-context";

export const beginLaser: BeginTool = (ctx, sample, _view, page, release) => {
  const stroke = ctx.laser.start(page);
  let lastMs = sample.timestampMs;
  let isOpen = true;
  const close = (atMs: number) => {
    if (!isOpen) return;
    isOpen = false;
    ctx.laser.finish(stroke, atMs);
    release();
    ctx.overlayChanged();
  };
  ctx.overlayChanged();
  return {
    holdsHistory: false,
    move(s, _v, p) {
      lastMs = s.timestampMs;
      ctx.laser.extend(stroke, p);
      ctx.overlayChanged();
    },
    end(s) {
      close(s.timestampMs);
    },
    cancel() {
      close(lastMs);
    },
    drop() {
      close(lastMs);
    },
  };
};
