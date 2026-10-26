import { createStore } from "zustand/vanilla";
import { COLOR_IDS, DASH_IDS, FILL_IDS, FONTS, GEO_IDS, SIZE_IDS, TOOLS } from "@quickdrawjs/core";
import type { Bounds, Camera, GeoId, ShapeRecord, Styles, ToolId } from "@quickdrawjs/core";
import type { BoardEditorState, BoardTextEdit } from "./BoardEditorState";
import type { BoardOverlay, BoardSelectionOverlay } from "./BoardOverlay";
import type { BoardPointerSample } from "./BoardPointerSample";
import type { BeginTool, BoardContext, OverlayContribution, ToolSession } from "./board-context";
import { bendMidpoint, boundsUnion, type Point } from "./geometry";
import type { HeadlessBoard } from "./HeadlessBoard";
import type { HeadlessBoardOptions } from "./HeadlessBoardOptions";
import { createHistoryGroup } from "./history-group";
import { createLaserLayer } from "./laser-layer";
import { assertNotStale, assertPointerId, assertValidSample } from "./sample-validation";
import { createShapeGeometry } from "./shape-geometry";
import { createTextLayoutEngine } from "./text-layout";
import { beginDraw } from "./tools/draw";
import { beginEraser } from "./tools/eraser";
import { beginGeo } from "./tools/geo";
import { beginHand } from "./tools/hand";
import { beginLaser } from "./tools/laser";
import { beginLineish } from "./tools/lineish";
import { beginPlacing } from "./tools/placing";
import { beginSelect } from "./tools/select";

/** QuickDraw `editor.js` DEFAULT_STYLES. */
const DEFAULT_STYLES: Styles = { color: "black", size: "m", dash: "draw", fill: "none", font: "draw" };

/** `editor.js` `setStyle` APPLIES: which shape types take each style. */
const APPLIES: Record<keyof Styles, readonly string[]> = {
  color: ["draw", "highlight", "geo", "arrow", "line", "text", "note"],
  size: ["draw", "highlight", "geo", "arrow", "line", "text", "note"],
  dash: ["draw", "geo", "arrow", "line"],
  fill: ["geo"],
  font: ["text", "note", "geo"],
};

const STYLE_VALUES: Record<keyof Styles, readonly string[]> = {
  color: COLOR_IDS,
  size: SIZE_IDS,
  dash: DASH_IDS,
  fill: FILL_IDS,
  font: Object.keys(FONTS),
};

const BEGIN: Record<ToolId, BeginTool> = {
  draw: beginDraw,
  highlight: beginDraw,
  eraser: beginEraser,
  laser: beginLaser,
  arrow: beginLineish,
  line: beginLineish,
  geo: beginGeo,
  text: beginPlacing,
  note: beginPlacing,
  select: beginSelect,
  hand: beginHand,
};

type ViewState = {
  tool: ToolId;
  geoKind: GeoId;
  styles: Styles;
  camera: Camera;
  selection: readonly string[];
  isPenMode: boolean;
  textEdit: BoardTextEdit | undefined;
  overlayVersion: number;
};

type Capture = { tool: ToolId; session: ToolSession; lastTimestampMs: number };

const assertCamera = (camera: Camera): Camera => {
  if (
    typeof camera !== "object" || camera === null ||
    !Number.isFinite(camera.x) || !Number.isFinite(camera.y) || !Number.isFinite(camera.z) || camera.z <= 0
  ) {
    throw new RangeError("camera must be { x, y, z } with finite numbers and z > 0");
  }
  return { x: camera.x, y: camera.y, z: camera.z };
};

const isShape = (r: unknown): r is ShapeRecord => !!r && (r as ShapeRecord).typeName === "shape";

/**
 * Creates a {@linkcode HeadlessBoard} over a QuickDraw `Store`.
 *
 * @example
 * ```ts
 * const store = new Store()
 * const board = createHeadlessBoard({ store, measureTextWidth })
 * board.pointerDown({ pointerId: 1, source: 'pen', x: 10, y: 10, pressure: 0.4, timestampMs: 0 })
 * board.pointerMove({ pointerId: 1, source: 'pen', x: 40, y: 12, pressure: 0.6, timestampMs: 8 })
 * board.pointerUp({ pointerId: 1, source: 'pen', x: 40, y: 12, pressure: 0.6, timestampMs: 16 })
 * board.dispose()
 * ```
 * @throws TypeError when `store` or `measureTextWidth` is missing.
 */
export function createHeadlessBoard(options: HeadlessBoardOptions): HeadlessBoard {
  const { store } = options;
  if (!store || typeof store.transact !== "function") throw new TypeError("options.store must be a QuickDraw Store");
  if (typeof options.measureTextWidth !== "function") throw new TypeError("options.measureTextWidth must be a function");
  if (options.geoKind !== undefined && !GEO_IDS.includes(options.geoKind)) {
    throw new RangeError(`unknown geoKind ${String(options.geoKind)}`);
  }

  const geometry = createShapeGeometry(store, createTextLayoutEngine(options.measureTextWidth));
  const history = createHistoryGroup(store);
  const laser = createLaserLayer();
  const view = createStore<ViewState>(() => ({
    tool: "draw",
    geoKind: options.geoKind ?? "rectangle",
    styles: { ...DEFAULT_STYLES, ...options.styles },
    camera: assertCamera(options.camera ?? { x: 0, y: 0, z: 1 }),
    selection: [],
    isPenMode: false,
    textEdit: undefined,
    overlayVersion: 0,
  }));
  const captures = new Map<number, Capture>();
  let hasSeenPen = false;
  let isDisposed = false;

  const assertLive = () => {
    if (isDisposed) throw new Error("headless board is disposed");
  };
  const overlayChanged = () => view.setState((s) => ({ overlayVersion: s.overlayVersion + 1 }));

  const setSelection = (ids: readonly string[]) => {
    view.setState({ selection: [...new Set(ids)] });
    overlayChanged();
  };

  const shapesSorted = (): ShapeRecord[] =>
    store.shapes().sort(
      (a, b) =>
        (a.type === "highlight" ? 0 : 1) - (b.type === "highlight" ? 0 : 1) || a.z - b.z || (a.id < b.id ? -1 : 1),
    );

  const selectionBounds = (): Bounds | undefined => {
    let b: Bounds | undefined;
    for (const id of view.getState().selection) {
      const s = store.get(id);
      if (isShape(s)) b = boundsUnion(b, geometry.pageBounds(s));
    }
    return b;
  };

  const commitText = () => {
    const ed = view.getState().textEdit;
    if (!ed) return;
    view.setState({ textEdit: undefined });
    const shape = store.get(ed.id);
    if (isShape(shape) && !String(shape.props.text || "").trim()) {
      history.ensure();
      store.remove([ed.id]);
    }
    history.close();
  };

  const setTool = (tool: ToolId) => {
    if (!TOOLS.includes(tool)) throw new RangeError(`unknown tool ${String(tool)}; expected one of ${TOOLS.join(", ")}`);
    commitText();
    view.setState({ tool });
    if (tool !== "select") setSelection([]);
  };

  const ctx: BoardContext = {
    store,
    history,
    geometry,
    laser,
    camera: () => view.getState().camera,
    setCamera: (camera) => view.setState({ camera: assertCamera(camera) }),
    styles: () => view.getState().styles,
    geoKind: () => view.getState().geoKind,
    tool: () => view.getState().tool,
    setTool,
    selection: () => view.getState().selection,
    setSelection,
    selectionBounds,
    shapesSorted,
    hitTest(page) {
      const tol = 8 / view.getState().camera.z;
      const list = shapesSorted();
      for (let i = list.length - 1; i >= 0; i--) {
        if (geometry.hitShape(list[i]!, page.x, page.y, tol)) return list[i];
      }
      return undefined;
    },
    startTextEdit: (id) => view.setState({ textEdit: { id, field: "text" } }),
    overlayChanged,
    toPage(v) {
      const c = view.getState().camera;
      return { x: v.x / c.z - c.x, y: v.y / c.z - c.y };
    },
    toView(p) {
      const c = view.getState().camera;
      return { x: (p.x + c.x) * c.z, y: (p.y + c.y) * c.z };
    },
  };

  // QuickDraw's Editor prunes the selection on every document change.
  const unlisten = store.listen(() => {
    const { selection } = view.getState();
    if (!selection.length) return;
    const kept = selection.filter((id) => store.has(id));
    if (kept.length !== selection.length) view.setState({ selection: kept });
    overlayChanged();
  });

  const editorState = (s: ViewState): BoardEditorState => ({
    tool: s.tool,
    geoKind: s.geoKind,
    styles: s.styles,
    camera: s.camera,
    selection: s.selection,
    isPenMode: s.isPenMode,
    textEdit: s.textEdit,
  });

  const selectionOverlay = (): BoardSelectionOverlay | undefined => {
    const ids = view.getState().selection.filter((id) => isShape(store.get(id)));
    if (!ids.length) return undefined;
    const one = ids.length === 1 ? (store.get(ids[0]!) as ShapeRecord) : undefined;
    if (one && (one.type === "arrow" || one.type === "line")) {
      const p = one.props;
      const bm = bendMidpoint(p as { dx: number; dy: number; bend?: number });
      return {
        kind: "line",
        id: one.id,
        start: { x: one.x, y: one.y },
        end: { x: one.x + p.dx, y: one.y + p.dy },
        bend: { x: one.x + bm.x, y: one.y + bm.y },
      };
    }
    return { kind: "box", ids, bounds: selectionBounds()!, isResizable: !(one && one.rot), isRotatable: true };
  };

  const getOverlay = (): BoardOverlay => {
    const acc: OverlayContribution = { marquees: [], eraserTrails: [], pendingEraseIds: new Set() };
    for (const { session } of captures.values()) session.contribute?.(acc);
    return {
      selection: selectionOverlay(),
      marquees: acc.marquees,
      laserStrokes: laser.snapshot(),
      eraserTrails: acc.eraserTrails,
      pendingEraseIds: [...acc.pendingEraseIds],
    };
  };

  const toPoints = (sample: BoardPointerSample): [Point, Point] => {
    const v = { x: sample.x, y: sample.y };
    return [v, ctx.toPage(v)];
  };

  const captured = (sample: BoardPointerSample): Capture | undefined => {
    assertLive();
    assertValidSample(sample);
    const capture = captures.get(sample.pointerId);
    if (capture) assertNotStale(sample, capture.lastTimestampMs);
    return capture;
  };

  return {
    pointerDown(sample) {
      assertLive();
      assertValidSample(sample);
      if (captures.has(sample.pointerId)) {
        throw new RangeError(`pointer ${sample.pointerId} is already captured; send pointerUp or pointerCancel first`);
      }
      commitText();
      if (sample.source === "pen" && !hasSeenPen) {
        hasSeenPen = true;
        view.setState({ isPenMode: true });
      }
      const state = view.getState();
      if (state.isPenMode && sample.source === "touch") return false;
      if (state.tool === "select" && [...captures.values()].some((c) => c.tool === "select")) return false;
      const [v, p] = toPoints(sample);
      const pointerId = sample.pointerId;
      let capture: Capture | undefined;
      const release = () => {
        if (capture && captures.get(pointerId) === capture) captures.delete(pointerId);
      };
      const session = BEGIN[state.tool](ctx, sample, v, p, release);
      capture = { tool: state.tool, session, lastTimestampMs: sample.timestampMs };
      captures.set(pointerId, capture);
      return true;
    },
    pointerMove(sample) {
      const capture = captured(sample);
      if (!capture) return;
      capture.lastTimestampMs = sample.timestampMs;
      const [v, p] = toPoints(sample);
      capture.session.move(sample, v, p);
    },
    pointerUp(sample) {
      const capture = captured(sample);
      if (!capture) return;
      captures.delete(sample.pointerId);
      const [v, p] = toPoints(sample);
      capture.session.end(sample, v, p);
    },
    pointerCancel(pointerId) {
      assertLive();
      assertPointerId(pointerId);
      const capture = captures.get(pointerId);
      if (!capture) return;
      captures.delete(pointerId);
      capture.session.cancel();
    },

    setTool(tool) {
      assertLive();
      setTool(tool);
    },
    setGeoKind(kind) {
      assertLive();
      if (!GEO_IDS.includes(kind)) throw new RangeError(`unknown geoKind ${String(kind)}; expected one of ${GEO_IDS.join(", ")}`);
      view.setState({ geoKind: kind });
    },
    setStyle(key, value) {
      assertLive();
      const allowed = STYLE_VALUES[key];
      if (!allowed) throw new RangeError(`unknown style ${String(key)}`);
      if (!allowed.includes(value)) throw new RangeError(`unknown ${key} ${String(value)}; expected one of ${allowed.join(", ")}`);
      view.setState((s) => ({ styles: { ...s.styles, [key]: value } }));
      const selection = view.getState().selection;
      if (selection.length) {
        store.transact(() => {
          for (const id of selection) {
            const s = store.get(id);
            if (isShape(s) && APPLIES[key].includes(s.type)) store.update(id, { props: { [key]: value } });
          }
        });
      }
    },
    setCamera(camera) {
      assertLive();
      view.setState({ camera: assertCamera(camera) });
      overlayChanged();
    },
    setPenMode(isEnabled) {
      assertLive();
      view.setState({ isPenMode: !!isEnabled });
    },
    setSelection(ids) {
      assertLive();
      setSelection(ids.filter((id) => isShape(store.get(id))));
    },
    deleteSelection() {
      assertLive();
      const selection = view.getState().selection;
      if (!selection.length) return;
      store.remove([...selection]);
      setSelection([]);
    },

    setEditingText(value) {
      assertLive();
      const ed = view.getState().textEdit;
      if (!ed) throw new Error("no open text edit; place a text or note shape first");
      if (typeof value !== "string") throw new TypeError("text must be a string");
      history.ensure();
      store.update(ed.id, { props: { text: value } });
    },
    commitText() {
      assertLive();
      commitText();
    },

    undo() {
      assertLive();
      commitText();
      for (const [id, capture] of [...captures]) {
        if (!capture.session.holdsHistory) continue;
        captures.delete(id);
        capture.session.drop();
      }
      history.reset();
      store.undo();
    },
    redo() {
      assertLive();
      commitText();
      store.redo();
    },

    getEditorState: () => editorState(view.getState()),
    addOnEditorStateChangedListener(listener) {
      const unsubscribe = view.subscribe((s, prev) => {
        if (
          s.tool !== prev.tool || s.geoKind !== prev.geoKind || s.styles !== prev.styles || s.camera !== prev.camera ||
          s.selection !== prev.selection || s.isPenMode !== prev.isPenMode || s.textEdit !== prev.textEdit
        ) listener(editorState(s));
      });
      return { remove: unsubscribe };
    },
    getOverlay,
    addOnOverlayChangedListener(listener) {
      const unsubscribe = view.subscribe((s, prev) => {
        if (s.overlayVersion !== prev.overlayVersion) listener(getOverlay());
      });
      return { remove: unsubscribe };
    },
    expireOverlay(nowMs) {
      if (!Number.isFinite(nowMs)) throw new RangeError(`nowMs must be finite, got ${String(nowMs)}`);
      if (laser.expire(nowMs)) overlayChanged();
    },

    dispose() {
      if (isDisposed) return;
      for (const [id, capture] of [...captures]) {
        captures.delete(id);
        capture.session.cancel();
      }
      commitText();
      unlisten();
      isDisposed = true;
    },
  };
}
