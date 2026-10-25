// `scaleShape` from @quickdrawjs/core 0.2.0 `src/shapes.js` (MIT): scales a
// shape's local geometry about its local origin; the caller repositions x/y.
import type { ShapeRecord } from "@quickdrawjs/core";

export function scaleShape(shape: ShapeRecord, sx: number, sy: number): ShapeRecord {
  const p = shape.props;
  switch (shape.type) {
    case "draw":
    case "highlight": {
      const pts = (p.pts as number[]).slice();
      for (let i = 0; i < pts.length; i += 3) {
        pts[i] = pts[i]! * sx;
        pts[i + 1] = pts[i + 1]! * sy;
      }
      return { ...shape, props: { ...p, pts } };
    }
    case "geo":
    case "image":
      return { ...shape, props: { ...p, w: Math.max(1, p.w * sx), h: Math.max(1, p.h * sy) } };
    case "arrow":
    case "line":
      return {
        ...shape,
        props: { ...p, dx: p.dx * sx, dy: p.dy * sy, ...(p.bend ? { bend: p.bend * Math.sqrt(Math.abs(sx * sy)) } : {}) },
      };
    case "text": {
      const s = Math.sqrt(Math.abs(sx * sy));
      return {
        ...shape,
        props: { ...p, scale: Math.max(0.2, (p.scale || 1) * s), ...(p.autosize === false && p.w ? { w: p.w * sx } : {}) },
      };
    }
    case "note": {
      const s = Math.sqrt(Math.abs(sx * sy));
      return { ...shape, props: { ...p, scale: Math.max(0.3, (p.scale || 1) * s) } };
    }
    default:
      return shape;
  }
}
