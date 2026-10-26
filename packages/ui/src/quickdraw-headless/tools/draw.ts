// `draw` and `highlight`, ported from QuickDraw `editor.js` `_beginDraw`,
// `_extendDraw`, `_endDraw` and the drawing branch of `_abortForPinch`.
// The stroke record is written at down and grown per sample inside one
// history batch, so peers see it live and it undoes as one step.
import { newId } from "@quickdrawjs/core";
import type { BoardPointerSample } from "../BoardPointerSample";
import type { BeginTool } from "../board-context";

/** QuickDraw records `0.5` as "no pressure reading". */
const pressureOf = (sample: BoardPointerSample): number => (sample.pressure === undefined ? 0.5 : sample.pressure);

export const beginDraw: BeginTool = (ctx, sample, _view, page, release) => {
  const type = ctx.tool() === "highlight" ? "highlight" : "draw";
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
      pts: [0, 0, pressureOf(sample)],
      color: styles.color,
      size: styles.size,
      ...(type === "draw" ? { dash: styles.dash } : {}),
      done: false,
      ...(sample.source === "pen" ? { isPen: true } : {}),
    },
  });
  let last = page;
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
    move(s, _v, p) {
      const shape = ctx.store.get(id);
      if (!shape || shape.typeName !== "shape") return finish();
      if (Math.hypot(p.x - last.x, p.y - last.y) < 1.25 / ctx.camera().z) return;
      last = p;
      const pts = (shape.props.pts as number[]).slice();
      pts.push(p.x - shape.x, p.y - shape.y, pressureOf(s));
      ctx.history.ensure();
      ctx.store.update(id, { props: { pts } });
    },
    end() {
      if (ctx.store.get(id)) {
        ctx.history.ensure();
        ctx.store.update(id, { props: { done: true } });
      }
      finish();
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
