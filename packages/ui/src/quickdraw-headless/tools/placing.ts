// `text` and `note`, ported from QuickDraw `editor.js` `placing` session,
// `_placeText`, `_placeNote`: placement happens at the lift, opens a history
// batch and a text edit; the board's `commitText` closes both. Editing the
// characters (IME, caret) stays with the host.
import { FONT_SIZES, newId } from "@quickdrawjs/core";
import type { BeginTool } from "../board-context";
import { NOTE_W } from "../text-layout";

export const beginPlacing: BeginTool = (ctx, _sample, _view, page, release) => {
  const kind = ctx.tool() === "note" ? "note" : "text";
  return {
    holdsHistory: false,
    move() {},
    end() {
      release();
      const styles = ctx.styles();
      const id = newId();
      ctx.history.open();
      if (kind === "note") {
        ctx.store.put({
          id,
          typeName: "shape",
          type: "note",
          x: page.x - NOTE_W / 2,
          y: page.y - NOTE_W / 2,
          rot: 0,
          z: ctx.store.maxZ() + 1,
          props: {
            text: "",
            color: styles.color === "black" ? "yellow" : styles.color,
            size: "m",
            font: styles.font,
            scale: 1,
          },
        });
      } else {
        ctx.store.put({
          id,
          typeName: "shape",
          type: "text",
          x: page.x,
          y: page.y - FONT_SIZES[styles.size] * 0.66,
          rot: 0,
          z: ctx.store.maxZ() + 1,
          props: { text: "", color: styles.color, size: styles.size, font: styles.font, autosize: true, scale: 1 },
        });
      }
      ctx.setTool("select");
      ctx.setSelection([id]);
      ctx.startTextEdit(id);
    },
    cancel: release,
    drop: release,
  };
};
