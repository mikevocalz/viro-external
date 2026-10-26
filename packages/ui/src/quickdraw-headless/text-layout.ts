// Text and note layout from @quickdrawjs/core 0.2.0 `src/shapes.js` (MIT),
// with the Canvas2D `measureText` call replaced by the host's measurer so it
// runs in Hermes. Line height, wrapping and note box rules match the source.
import { FONT_SIZES, FONTS } from "@quickdrawjs/core";
import type { ShapeRecord } from "@quickdrawjs/core";
import type { MeasureTextWidth } from "./HeadlessBoardOptions";

/** `shapes.js` NOTE_W: the fixed note width in page units. */
export const NOTE_W = 200;
const NOTE_PAD = 20;
const NOTE_FONT_SIZES: Record<string, number> = { s: 16, m: 20, l: 26, xl: 32 };

export type TextLayout = { w: number; h: number };
export type NoteLayout = { boxH: number };

type Line = { text: string; w: number };

export type TextLayoutEngine = {
  textLayout(shape: ShapeRecord): TextLayout;
  noteLayout(shape: ShapeRecord): NoteLayout;
};

export function createTextLayoutEngine(measure: MeasureTextWidth): TextLayoutEngine {
  const cache = new WeakMap<object, TextLayout | NoteLayout>();

  const width = (text: string, fontSizePx: number, fontFamily: string): number => {
    const w = measure(text, { fontSizePx, fontFamily });
    if (!Number.isFinite(w) || w < 0) {
      throw new RangeError(`measureTextWidth returned ${String(w)}; expected a finite width >= 0`);
    }
    return w;
  };

  const wrapLines = (text: unknown, font: string, fontSize: number, maxW: number): Line[] => {
    const out: Line[] = [];
    for (const para of String(text ?? "").split("\n")) {
      if (para === "") {
        out.push({ text: "", w: 0 });
        continue;
      }
      let line = "";
      for (const word of para.split(/(\s+)/)) {
        const test = line + word;
        if (line && maxW && width(test, fontSize, font) > maxW) {
          out.push({ text: line, w: width(line, fontSize, font) });
          line = word.trimStart();
        } else line = test;
      }
      out.push({ text: line, w: width(line, fontSize, font) });
    }
    return out;
  };

  const familyOf = (font: unknown): string =>
    (FONTS as Record<string, string>)[typeof font === "string" ? font : "draw"] ?? FONTS.draw;

  return {
    textLayout(shape) {
      const p = shape.props;
      const hit = cache.get(p) as TextLayout | undefined;
      if (hit) return hit;
      const fontSize = ((FONT_SIZES as Record<string, number>)[p.size] ?? FONT_SIZES.m) * (p.scale || 1);
      const font = familyOf(p.font);
      const lh = fontSize * 1.32;
      const maxW = p.autosize === false && p.w ? (p.w as number) : 0;
      const lines = wrapLines(p.text, font, fontSize, maxW);
      const w = maxW || Math.max(8, ...lines.map((l) => l.w)) + 2;
      const layout = { w, h: Math.max(lh, lines.length * lh) };
      cache.set(p, layout);
      return layout;
    },
    noteLayout(shape) {
      const p = shape.props;
      const hit = cache.get(p) as NoteLayout | undefined;
      if (hit) return hit;
      const fontSize = NOTE_FONT_SIZES[p.size] ?? 20;
      const font = familyOf(p.font);
      const lh = fontSize * 1.35;
      const lines = wrapLines(p.text, font, fontSize, NOTE_W - NOTE_PAD * 2);
      const textH = lines.length * lh;
      const layout = { boxH: Math.max(NOTE_W, textH + NOTE_PAD * 2) };
      cache.set(p, layout);
      return layout;
    },
  };
}
