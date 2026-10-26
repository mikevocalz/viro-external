// `select`, ported from QuickDraw `editor.js` `_beginSelect`, `_hitHandle`,
// the `pressing` and `marquee` sessions, `_beginTranslate`/`_dragTranslate`,
// `_dragResize`, `_dragRotate` and `_dragHandle`. Handle sizes are in board
// units (QuickDraw's screen px). Omitted because samples carry no modifier
// keys: shift-additive selection, shift snapping, alt-drag duplicate.
import type { Bounds, ShapeRecord } from "@quickdrawjs/core";
import type { BeginTool, BoardContext, ToolSession } from "../board-context";
import { bendMidpoint, rotWith, type Point } from "../geometry";
import { scaleShape } from "../scale-shape";

const HANDLE = 8;
const DRAG_THRESHOLD = 4;
const RESIZE_HANDLES = ["tl", "tr", "bl", "br", "t", "b", "l", "r"] as const;
type ResizeHandle = (typeof RESIZE_HANDLES)[number];
type LineHandle = "start" | "end" | "bend";

type HandleHit =
  | { kind: "rotate" }
  | { kind: "handle"; which: LineHandle; id: string }
  | { kind: "resize"; which: ResizeHandle };

type Snapshot = Map<string, ShapeRecord>;

type SelectState =
  | { type: "idle" }
  | { type: "pressing"; hit: ShapeRecord; start: Point; page: Point }
  | { type: "marquee"; origin: Point; rect: Bounds | undefined }
  | { type: "translating"; start: Point; orig: Snapshot }
  | { type: "resizing"; handle: ResizeHandle; init: Bounds; orig: Snapshot }
  | { type: "rotating"; center: Point; start: number; orig: Snapshot }
  | { type: "handle"; which: LineHandle; id: string };

const isShape = (r: unknown): r is ShapeRecord => !!r && (r as ShapeRecord).typeName === "shape";

/** Which selection handle sits at a board-space point. */
export function hitSelectionHandle(ctx: BoardContext, view: Point): HandleHit | undefined {
  const selection = ctx.selection();
  if (ctx.tool() !== "select" || selection.length === 0) return undefined;
  const one = selection.length === 1 ? ctx.store.get(selection[0]!) : undefined;
  if (isShape(one) && (one.type === "arrow" || one.type === "line")) {
    const pr = one.props;
    const bm = bendMidpoint(pr as { dx: number; dy: number; bend?: number });
    const pts: Array<{ which: LineHandle; x: number; y: number }> = [
      { which: "start", x: one.x, y: one.y },
      { which: "end", x: one.x + pr.dx, y: one.y + pr.dy },
      { which: "bend", x: one.x + bm.x, y: one.y + bm.y },
    ];
    for (const h of pts) {
      const s = ctx.toView(h);
      if (Math.hypot(s.x - view.x, s.y - view.y) <= HANDLE + 3) return { kind: "handle", which: h.which, id: one.id };
    }
    return undefined;
  }
  const b = ctx.selectionBounds();
  if (!b) return undefined;
  const tl = ctx.toView({ x: b.x, y: b.y });
  const br = ctx.toView({ x: b.x + b.w, y: b.y + b.h });
  if (Math.hypot((tl.x + br.x) / 2 - view.x, tl.y - 22 - view.y) <= HANDLE + 2) return { kind: "rotate" };
  if (isShape(one) && one.rot) return undefined;
  const xs = { l: tl.x, m: (tl.x + br.x) / 2, r: br.x };
  const ys = { t: tl.y, m: (tl.y + br.y) / 2, b: br.y };
  for (const which of RESIZE_HANDLES) {
    const hx = which.length === 2 ? xs[which[1] as "l" | "r"] : which === "l" || which === "r" ? xs[which] : xs.m;
    const hy = which.length === 2 ? ys[which[0] as "t" | "b"] : which === "t" || which === "b" ? ys[which] : ys.m;
    if (Math.abs(hx - view.x) <= HANDLE && Math.abs(hy - view.y) <= HANDLE) return { kind: "resize", which };
  }
  return undefined;
}

const snapshotSelection = (ctx: BoardContext): Snapshot => {
  const m: Snapshot = new Map();
  for (const id of ctx.selection()) {
    const sh = ctx.store.get(id);
    if (isShape(sh)) m.set(id, sh);
  }
  return m;
};

const holdsHistory = (state: SelectState): boolean =>
  state.type === "translating" || state.type === "resizing" || state.type === "rotating" || state.type === "handle";

export const beginSelect: BeginTool = (ctx, _sample, view, page, release) => {
  let state: SelectState = { type: "idle" };
  const h = hitSelectionHandle(ctx, view);
  if (h) {
    ctx.history.open();
    if (h.kind === "rotate") {
      const b = ctx.selectionBounds()!;
      const center = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
      state = { type: "rotating", center, start: Math.atan2(page.y - center.y, page.x - center.x), orig: snapshotSelection(ctx) };
    } else if (h.kind === "handle") {
      state = { type: "handle", which: h.which, id: h.id };
    } else {
      state = { type: "resizing", handle: h.which, init: ctx.selectionBounds()!, orig: snapshotSelection(ctx) };
    }
  } else {
    const hit = ctx.hitTest(page);
    if (hit) {
      if (!ctx.selection().includes(hit.id)) ctx.setSelection([hit.id]);
      state = { type: "pressing", hit, start: view, page };
    } else {
      state = { type: "marquee", origin: page, rect: undefined };
      ctx.setSelection([]);
    }
  }

  const translate = (s: Extract<SelectState, { type: "translating" }>, p: Point) => {
    const dx = p.x - s.start.x;
    const dy = p.y - s.start.y;
    ctx.history.ensure();
    ctx.store.transact(() => {
      for (const [id, orig] of s.orig) if (ctx.store.has(id)) ctx.store.update(id, { x: orig.x + dx, y: orig.y + dy });
    });
  };

  const resize = (s: Extract<SelectState, { type: "resizing" }>, p: Point) => {
    const { handle, init } = s;
    const ax = handle.includes("l") ? init.x + init.w : init.x;
    const ay = handle.includes("t") ? init.y + init.h : init.y;
    let sx = handle.includes("l") || handle.includes("r")
      ? (p.x - ax) / ((handle.includes("l") ? init.x : init.x + init.w) - ax)
      : 1;
    let sy = handle.includes("t") || handle.includes("b")
      ? (p.y - ay) / ((handle.includes("t") ? init.y : init.y + init.h) - ay)
      : 1;
    sx = Number.isFinite(sx) ? Math.max(0.02, sx) : 1;
    sy = Number.isFinite(sy) ? Math.max(0.02, sy) : 1;
    const uniform = handle.length === 2 && [...s.orig.values()].every((sh) => ["image", "note", "text"].includes(sh.type));
    if (uniform) sx = sy = Math.max(sx, sy);
    ctx.history.ensure();
    ctx.store.transact(() => {
      for (const [id, orig] of s.orig) {
        if (!ctx.store.has(id)) continue;
        const scaled = scaleShape(orig, sx, sy);
        ctx.store.put({ ...scaled, x: ax + (orig.x - ax) * sx, y: ay + (orig.y - ay) * sy });
      }
    });
  };

  const rotate = (s: Extract<SelectState, { type: "rotating" }>, p: Point) => {
    const delta = Math.atan2(p.y - s.center.y, p.x - s.center.x) - s.start;
    ctx.history.ensure();
    ctx.store.transact(() => {
      for (const [id, orig] of s.orig) {
        if (!ctx.store.has(id)) continue;
        const lb = ctx.geometry.localBounds(orig);
        const cx = orig.x + lb.x + lb.w / 2;
        const cy = orig.y + lb.y + lb.h / 2;
        const nc = rotWith(cx, cy, s.center.x, s.center.y, delta);
        ctx.store.update(id, { x: orig.x + nc.x - cx, y: orig.y + nc.y - cy, rot: ((orig.rot || 0) + delta) % (Math.PI * 2) });
      }
    });
  };

  const dragHandle = (s: Extract<SelectState, { type: "handle" }>, p: Point) => {
    const shape = ctx.store.get(s.id);
    if (!isShape(shape)) return;
    const pr = shape.props;
    ctx.history.ensure();
    if (s.which === "start") {
      const ex = shape.x + pr.dx;
      const ey = shape.y + pr.dy;
      ctx.store.update(s.id, { x: p.x, y: p.y, props: { dx: ex - p.x, dy: ey - p.y } });
    } else if (s.which === "end") {
      ctx.store.update(s.id, { props: { dx: p.x - shape.x, dy: p.y - shape.y } });
    } else {
      const len = Math.hypot(pr.dx, pr.dy) || 1;
      const nx = -pr.dy / len;
      const ny = pr.dx / len;
      const bend = (p.x - (shape.x + pr.dx / 2)) * nx + (p.y - (shape.y + pr.dy / 2)) * ny;
      ctx.store.update(s.id, { props: { bend: Math.abs(bend) < 4 / ctx.camera().z ? 0 : bend } });
    }
  };

  const session: ToolSession = {
    get holdsHistory() {
      return holdsHistory(state);
    },
    move(_s, v, p) {
      switch (state.type) {
        case "pressing": {
          if (Math.hypot(v.x - state.start.x, v.y - state.start.y) <= DRAG_THRESHOLD) return;
          if (ctx.selection().length === 0) {
            state = { type: "idle" };
            return;
          }
          ctx.history.open();
          const next = { type: "translating" as const, start: state.page, orig: snapshotSelection(ctx) };
          state = next;
          translate(next, p);
          return;
        }
        case "marquee": {
          const o = state.origin;
          const rect = { x: Math.min(o.x, p.x), y: Math.min(o.y, p.y), w: Math.abs(p.x - o.x), h: Math.abs(p.y - o.y) };
          state.rect = rect;
          ctx.setSelection(ctx.shapesSorted().filter((sh) => ctx.geometry.marqueeHits(sh, rect)).map((sh) => sh.id));
          ctx.overlayChanged();
          return;
        }
        case "translating":
          return translate(state, p);
        case "resizing":
          return resize(state, p);
        case "rotating":
          return rotate(state, p);
        case "handle":
          return dragHandle(state, p);
        case "idle":
          return;
      }
    },
    end() {
      const s = state;
      state = { type: "idle" };
      release();
      if (s.type === "pressing") ctx.setSelection([s.hit.id]);
      else if (s.type === "marquee") ctx.overlayChanged();
      else if (holdsHistory(s)) ctx.history.close();
    },
    cancel() {
      const s = state;
      state = { type: "idle" };
      release();
      if (holdsHistory(s)) ctx.history.close();
      ctx.overlayChanged();
    },
    drop() {
      state = { type: "idle" };
      release();
      ctx.overlayChanged();
    },
    contribute(acc) {
      if (state.type === "marquee" && state.rect) acc.marquees.push({ ...state.rect });
    },
  };
  return session;
};
