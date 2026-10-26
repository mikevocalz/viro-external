// `hand`, ported from QuickDraw `editor.js` `panning` session and `pan`:
// board-space deltas move the camera by delta / zoom.
import type { BeginTool } from "../board-context";

export const beginHand: BeginTool = (ctx, _sample, view, _page, release) => {
  let last = view;
  const pan = (v: { x: number; y: number }) => {
    const c = ctx.camera();
    ctx.setCamera({ ...c, x: c.x + (v.x - last.x) / c.z, y: c.y + (v.y - last.y) / c.z });
    last = v;
  };
  return {
    holdsHistory: false,
    move(_s, v) {
      pan(v);
    },
    end(_s, v) {
      pan(v);
      release();
    },
    cancel: release,
    drop: release,
  };
};
