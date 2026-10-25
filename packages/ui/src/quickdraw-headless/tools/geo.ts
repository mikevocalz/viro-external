// `geo`, ported from QuickDraw `editor.js` `_beginGeo`, `_dragGeo`, `_endGeo`
// (shift-square omitted: samples carry no modifier keys). A click or a drag
// under 4 units drops a ready-made 160 x 160 shape centred on the press.
import { newId } from "@quickdrawjs/core";
import type { BeginTool } from "../board-context";

export const beginGeo: BeginTool = (ctx, _sample, _view, page, release) => {
  const styles = ctx.styles();
  const id = newId();
  const origin = page;
  let dragged = false;
  ctx.history.open();
  ctx.store.put({
    id,
    typeName: "shape",
    type: "geo",
    x: page.x,
    y: page.y,
    rot: 0,
    z: ctx.store.maxZ() + 1,
    props: {
      geo: ctx.geoKind(),
      w: 1,
      h: 1,
      color: styles.color,
      size: styles.size,
      dash: styles.dash,
      fill: styles.fill,
      font: styles.font,
    },
  });
  let isOpen = true;
  const finish = () => {
    if (!isOpen) return;
    isOpen = false;
    ctx.history.close();
    release();
  };
  return {
    get holdsHistory() {
      return isOpen;
    },
    move(_s, _v, p) {
      if (!ctx.store.has(id)) return;
      dragged = true;
      const w = p.x - origin.x;
      const h = p.y - origin.y;
      ctx.history.ensure();
      ctx.store.update(id, {
        x: Math.min(origin.x, origin.x + w),
        y: Math.min(origin.y, origin.y + h),
        props: { w: Math.max(1, Math.abs(w)), h: Math.max(1, Math.abs(h)) },
      });
    },
    end() {
      const s = ctx.store.get(id);
      if (s && s.typeName === "shape" && (!dragged || s.props.w < 4 || s.props.h < 4)) {
        ctx.history.ensure();
        ctx.store.update(id, { x: s.x - 80, y: s.y - 80, props: { w: 160, h: 160 } });
      }
      finish();
      if (s) {
        ctx.setTool("select");
        ctx.setSelection([id]);
      }
    },
    cancel() {
      ctx.history.ensure();
      ctx.store.remove([id]);
      finish();
    },
    drop() {
      isOpen = false;
      release();
    },
  };
};
