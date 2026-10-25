// `arrow` and `line`, ported from QuickDraw `editor.js` `_beginLineish`,
// `_dragLineish`, `_endLineish` (shift-angle snapping omitted: samples carry no
// modifier keys). A drag shorter than 2 / zoom leaves nothing behind.
import { newId } from "@quickdrawjs/core";
import type { BeginTool } from "../board-context";

export const beginLineish: BeginTool = (ctx, _sample, _view, page, release) => {
  const type = ctx.tool() === "arrow" ? "arrow" : "line";
  const styles = ctx.styles();
  const id = newId();
  ctx.history.open();
  ctx.store.put({
    id,
    typeName: "shape",
    type,
    x: page.x,
    y: page.y,
    rot: 0,
    z: ctx.store.maxZ() + 1,
    props: {
      dx: 0.01,
      dy: 0.01,
      bend: 0,
      color: styles.color,
      size: styles.size,
      dash: styles.dash === "draw" ? "solid" : styles.dash,
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
      const s = ctx.store.get(id);
      if (!s || s.typeName !== "shape") return;
      ctx.history.ensure();
      ctx.store.update(id, { props: { dx: p.x - s.x, dy: p.y - s.y } });
    },
    end() {
      const s = ctx.store.get(id);
      if (s && s.typeName === "shape" && Math.hypot(s.props.dx, s.props.dy) < 2 / ctx.camera().z) {
        ctx.history.ensure();
        ctx.store.remove([id]);
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
