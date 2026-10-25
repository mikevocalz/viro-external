import { strokeOutline } from "@quickdrawjs/core";
import type { ShapeRecord } from "@quickdrawjs/core";

// `palette.js` INK_SIZES in @quickdrawjs/core 0.2.0; not re-exported by the index.
const INK_SIZES: Record<string, number> = { s: 3.4, m: 5.2, l: 6.5, xl: 10 };

/**
 * The filled freehand outline QuickDraw draws for a pressure-ink `draw`
 * shape, as flat `[x, y, ...]` local coordinates. Calls `strokeOutline` with
 * the arguments `shapes.js` `drawPath` uses, so native renderers match the
 * web board.
 *
 * @returns `undefined` for shapes QuickDraw does not fill as ink: any type
 * other than `draw`, and `draw` shapes whose `dash` is `solid`, `dashed` or
 * `dotted` (those render as an even-width centerline).
 */
export function getInkOutline(shape: ShapeRecord): number[] | undefined {
  if (shape.type !== "draw") return undefined;
  const p = shape.props;
  if (p.dash && p.dash !== "draw") return undefined;
  return strokeOutline(p.pts, { size: INK_SIZES[p.size] ?? INK_SIZES.m, simulate: !p.isPen });
}
