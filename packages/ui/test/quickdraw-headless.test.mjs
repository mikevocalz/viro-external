import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { Store } from "@quickdrawjs/core";
import { createHeadlessBoard } from "../src/quickdraw-headless/createHeadlessBoard.ts";
import { getInkOutline } from "../src/quickdraw-headless/ink-outline.ts";

const measureTextWidth = (text, { fontSizePx }) => text.length * fontSizePx * 0.5;

const setup = (opts = {}) => {
  const store = new Store();
  const board = createHeadlessBoard({ store, measureTextWidth, ...opts });
  return { store, board };
};

let clock = 0;
const sample = (pointerId, x, y, extra = {}) => ({
  pointerId, source: "controller", x, y, timestampMs: (clock += 8), ...extra,
});

const stroke = (board, pointerId, points, extra = {}) => {
  const [first, ...rest] = points;
  board.pointerDown(sample(pointerId, first[0], first[1], extra));
  for (const [x, y] of rest) board.pointerMove(sample(pointerId, x, y, extra));
  const last = points[points.length - 1];
  board.pointerUp(sample(pointerId, last[0], last[1], extra));
};

const line = (x0, y0, x1, y1, n = 8) =>
  Array.from({ length: n + 1 }, (_, i) => [x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n]);

const snapshotJson = (store) => JSON.stringify(store.getSnapshot());

describe("headless QuickDraw board", () => {
  test("a completed stroke is one undo step and streams live user diffs", () => {
    const { store, board } = setup();
    const diffs = [];
    store.listen((_d, source) => diffs.push(source));
    stroke(board, 1, line(0, 0, 100, 0));
    const shapes = store.shapes();
    assert.equal(shapes.length, 1);
    const [shape] = shapes;
    assert.equal(shape.type, "draw");
    assert.equal(shape.typeName, "shape");
    assert.match(shape.id, /^shape:/);
    assert.equal(shape.props.done, true);
    assert.equal(shape.props.color, "black");
    assert.equal(shape.props.dash, "draw");
    assert.equal(shape.props.pts.length, 9 * 3);
    assert.ok(diffs.length > 2 && diffs.every((s) => s === "user"));
    assert.equal(store.undos.length, 1);
    board.undo();
    assert.equal(store.shapes().length, 0);
    board.redo();
    assert.deepEqual(store.get(shape.id), shape);
    assert.ok(getInkOutline(shape).length > 0);
  });

  test("cancel removes the in-progress stroke and leaves no history", () => {
    const { store, board } = setup();
    stroke(board, 1, line(0, 0, 50, 50));
    assert.equal(store.undos.length, 1);
    board.pointerDown(sample(2, 0, 100));
    board.pointerMove(sample(2, 30, 100));
    board.pointerMove(sample(2, 60, 100));
    assert.equal(store.shapes().length, 2);
    board.pointerCancel(2);
    assert.equal(store.shapes().length, 1);
    assert.equal(store.undos.length, 1);
    board.pointerMove(sample(2, 90, 100));
    assert.equal(store.shapes().length, 1);
    board.undo();
    assert.equal(store.shapes().length, 0);
    assert.equal(store.canUndo, false);
  });

  test("two pointers draw concurrently and one pointer's cancel never ends the other's stroke", () => {
    const { store, board } = setup();
    board.pointerDown(sample(1, 0, 0, { source: "pen", pressure: 0.4 }));
    board.pointerDown(sample(2, 0, 200, { source: "controller" }));
    for (let i = 1; i <= 5; i++) {
      board.pointerMove(sample(1, i * 20, 0, { source: "pen", pressure: 0.4 }));
      board.pointerMove(sample(2, i * 20, 200, { source: "controller" }));
    }
    board.pointerCancel(2);
    board.pointerMove(sample(1, 140, 0, { source: "pen", pressure: 0.5 }));
    board.pointerUp(sample(1, 140, 0, { source: "pen", pressure: 0.5 }));
    const shapes = store.shapes();
    assert.equal(shapes.length, 1);
    assert.equal(shapes[0].props.done, true);
    assert.equal(shapes[0].props.isPen, true);
    assert.equal(shapes[0].props.pts.length, 7 * 3);
    assert.equal(store.undos.length, 1);
    board.undo();
    assert.equal(store.shapes().length, 0);
  });

  test("sequential strokes are separate undo steps; overlapping strokes share one", () => {
    const { store, board } = setup();
    stroke(board, 1, line(0, 0, 50, 0));
    stroke(board, 1, line(0, 50, 50, 50));
    assert.equal(store.undos.length, 2);
    board.pointerDown(sample(3, 0, 100));
    board.pointerDown(sample(4, 0, 150));
    board.pointerMove(sample(3, 40, 100));
    board.pointerMove(sample(4, 40, 150));
    board.pointerUp(sample(3, 40, 100));
    board.pointerMove(sample(4, 80, 150));
    board.pointerUp(sample(4, 80, 150));
    assert.equal(store.shapes().length, 4);
    assert.equal(store.undos.length, 3);
    board.undo();
    assert.equal(store.shapes().length, 2);
  });

  test("pressure: undefined records QuickDraw's no-reading 0.5, an explicit 0 stays 0", () => {
    const { store, board } = setup();
    board.pointerDown(sample(1, 0, 0, { source: "pen" }));
    board.pointerMove(sample(1, 10, 0, { source: "pen", pressure: 0 }));
    board.pointerMove(sample(1, 20, 0, { source: "pen", pressure: 0.7 }));
    board.pointerUp(sample(1, 20, 0, { source: "pen", pressure: 0.7 }));
    const pts = store.shapes()[0].props.pts;
    assert.deepEqual([pts[2], pts[5], pts[8]], [0.5, 0, 0.7]);
    stroke(board, 2, line(0, 50, 30, 50), { source: "hand" });
    const hand = store.shapes().find((s) => s.y === 50);
    assert.equal(hand.props.isPen, undefined);
  });

  test("the eraser removes every hit shape in one transaction", () => {
    const { store, board } = setup();
    stroke(board, 1, line(0, 0, 0, 100));
    stroke(board, 1, line(50, 0, 50, 100));
    stroke(board, 1, line(100, 0, 100, 100));
    const undosBefore = store.undos.length;
    const removals = [];
    store.listen((d) => removals.push(Object.keys(d.removed).length));
    board.setTool("eraser");
    board.pointerDown(sample(5, -10, 50));
    board.pointerMove(sample(5, 60, 50));
    board.pointerMove(sample(5, 120, 50));
    assert.equal(store.shapes().length, 3);
    assert.equal(board.getOverlay().pendingEraseIds.length, 3);
    assert.ok(board.getOverlay().eraserTrails[0].points.length >= 4);
    board.pointerUp(sample(5, 120, 50));
    assert.equal(store.shapes().length, 0);
    assert.deepEqual(removals, [3]);
    assert.equal(store.undos.length, undosBefore + 1);
    assert.deepEqual(board.getOverlay().eraserTrails, []);
    board.undo();
    assert.equal(store.shapes().length, 3);
  });

  test("an eraser cancel deletes nothing", () => {
    const { store, board } = setup();
    stroke(board, 1, line(0, 0, 0, 100));
    board.setTool("eraser");
    board.pointerDown(sample(2, -10, 50));
    board.pointerMove(sample(2, 20, 50));
    board.pointerCancel(2);
    assert.equal(store.shapes().length, 1);
  });

  test("remote applyDiff during a local stroke keeps both edits intact", () => {
    const { store, board } = setup();
    const peer = new Store();
    const remoteDiffs = [];
    peer.listen((d) => remoteDiffs.push(d), { source: "user" });
    peer.put({ id: "shape:remote", typeName: "shape", type: "geo", x: 300, y: 300, rot: 0, z: 1,
      props: { geo: "rectangle", w: 40, h: 40, color: "red", size: "m", dash: "draw", fill: "none", font: "draw" } });

    board.pointerDown(sample(1, 0, 0));
    board.pointerMove(sample(1, 20, 0));
    store.applyDiff(remoteDiffs[0]);
    board.pointerMove(sample(1, 40, 0));
    board.pointerUp(sample(1, 40, 0));

    assert.equal(store.shapes().length, 2);
    assert.equal(store.undos.length, 1);
    board.undo();
    assert.deepEqual(store.shapes().map((s) => s.id), ["shape:remote"]);
  });

  test("a remote removal of the stroke being drawn ends that stroke cleanly", () => {
    const { store, board } = setup();
    board.pointerDown(sample(1, 0, 0));
    board.pointerMove(sample(1, 20, 0));
    const [live] = store.shapes();
    store.applyDiff({ added: {}, updated: {}, removed: { [live.id]: live } });
    board.pointerMove(sample(1, 40, 0));
    board.pointerUp(sample(1, 40, 0));
    assert.equal(store.shapes().length, 0);
    stroke(board, 1, line(0, 50, 50, 50));
    stroke(board, 1, line(0, 80, 50, 80));
    assert.equal(store.shapes().length, 2);
    board.undo();
    assert.equal(store.shapes().length, 1);
  });

  test("snapshot round-trip preserves every record and stays editable", () => {
    const { store, board } = setup();
    stroke(board, 1, line(0, 0, 100, 20), { source: "pen", pressure: 0.6 });
    board.setTool("highlight");
    stroke(board, 1, line(0, 40, 100, 40));
    board.setTool("geo");
    stroke(board, 1, line(200, 0, 260, 50));
    board.setTool("arrow");
    stroke(board, 1, line(0, 200, 120, 220));
    const json = snapshotJson(store);

    const restored = new Store();
    restored.loadSnapshot(JSON.parse(json));
    assert.equal(snapshotJson(restored), json);
    assert.equal(restored.canUndo, false);

    const next = createHeadlessBoard({ store: restored, measureTextWidth });
    next.setTool("eraser");
    stroke(next, 9, line(-10, 10, 110, 10));
    assert.equal(restored.shapes().length, 3);
    next.undo();
    // Undo re-inserts the erased records, so Map order changes; content must not.
    assert.deepEqual(restored.getSnapshot(), JSON.parse(json));
  });

  test("NaN, Infinity, bad pressure, bad ids and stale samples are rejected without touching the Store", () => {
    const { store, board } = setup();
    board.pointerDown(sample(1, 0, 0));
    board.pointerMove(sample(1, 20, 0));
    const before = snapshotJson(store);
    const lastTs = clock;
    const bad = [
      () => board.pointerMove(sample(1, Number.NaN, 0)),
      () => board.pointerMove(sample(1, 30, Number.POSITIVE_INFINITY)),
      () => board.pointerMove(sample(1, 30, 0, { pressure: 2 })),
      () => board.pointerMove(sample(1, 30, 0, { pressure: Number.NaN })),
      () => board.pointerMove(sample(1, 30, 0, { source: "mouse" })),
      () => board.pointerMove({ pointerId: 1, source: "controller", x: 30, y: 0, timestampMs: lastTs - 100 }),
      () => board.pointerMove(sample(1, 30, 0, { timestampMs: Number.NaN })),
      () => board.pointerDown(sample(1.5, 0, 0)),
      () => board.pointerDown(sample(1, 0, 0)),
      () => board.pointerDown(sample(2, Number.NEGATIVE_INFINITY, 0)),
      () => board.pointerCancel(Number.NaN),
      () => board.setCamera({ x: 0, y: 0, z: 0 }),
      () => board.setTool("lasso"),
      () => board.setStyle("color", "magenta"),
    ];
    for (const call of bad) {
      assert.throws(call, (e) => e instanceof RangeError || e instanceof TypeError);
      assert.equal(snapshotJson(store), before);
    }
    board.pointerMove(sample(1, 40, 0));
    board.pointerUp(sample(1, 40, 0));
    const [shape] = store.shapes();
    assert.equal(shape.props.pts.length, 3 * 3);
    assert.ok(shape.props.pts.every(Number.isFinite));
    assert.equal(store.undos.length, 1);
  });

  test("pen mode: after a pen touches down, touch pointers do not draw", () => {
    const { store, board } = setup();
    stroke(board, 1, line(0, 0, 40, 0), { source: "pen" });
    assert.equal(board.getEditorState().isPenMode, true);
    assert.equal(board.pointerDown(sample(2, 0, 50, { source: "touch" })), false);
    board.pointerMove(sample(2, 40, 50, { source: "touch" }));
    board.pointerUp(sample(2, 40, 50, { source: "touch" }));
    assert.equal(store.shapes().length, 1);
  });

  test("geo click drops a 160 square and switches to select, as QuickDraw does", () => {
    const { store, board } = setup();
    board.setTool("geo");
    board.pointerDown(sample(1, 100, 100));
    board.pointerUp(sample(1, 100, 100));
    const [geo] = store.shapes();
    assert.deepEqual([geo.x, geo.y, geo.props.w, geo.props.h], [20, 20, 160, 160]);
    assert.equal(board.getEditorState().tool, "select");
    assert.deepEqual(board.getEditorState().selection, [geo.id]);
    assert.equal(board.getOverlay().selection.kind, "box");
    assert.equal(store.undos.length, 1);
  });

  test("a too-short line leaves nothing and no history", () => {
    const { store, board } = setup();
    board.setTool("line");
    board.pointerDown(sample(1, 10, 10));
    board.pointerMove(sample(1, 10.5, 10));
    board.pointerUp(sample(1, 10.5, 10));
    assert.equal(store.shapes().length, 0);
    assert.equal(store.undos.length, 0);
  });

  test("select: press-drag translates the shape as one undo step; delete removes it", () => {
    const { store, board } = setup();
    stroke(board, 1, line(0, 0, 100, 0));
    const [shape] = store.shapes();
    board.setTool("select");
    board.pointerDown(sample(2, 50, 0));
    board.pointerMove(sample(2, 60, 10));
    board.pointerMove(sample(2, 70, 30));
    board.pointerUp(sample(2, 70, 30));
    const moved = store.get(shape.id);
    assert.deepEqual([moved.x - shape.x, moved.y - shape.y], [20, 30]);
    assert.equal(store.undos.length, 2);
    board.undo();
    assert.deepEqual([store.get(shape.id).x, store.get(shape.id).y], [shape.x, shape.y]);
    board.setSelection([shape.id]);
    board.deleteSelection();
    assert.equal(store.shapes().length, 0);
  });

  test("select: marquee selects shapes it grazes and shows in the overlay", () => {
    const { store, board } = setup();
    stroke(board, 1, line(0, 0, 100, 0));
    stroke(board, 1, line(0, 300, 100, 300));
    board.setTool("select");
    board.pointerDown(sample(2, -20, -20));
    board.pointerMove(sample(2, 50, 20));
    assert.equal(board.getOverlay().marquees.length, 1);
    board.pointerUp(sample(2, 50, 20));
    assert.deepEqual(board.getEditorState().selection, [store.shapes().find((s) => s.y === 0).id]);
    assert.deepEqual(board.getOverlay().marquees, []);
  });

  test("text: placement opens an edit; an empty commit evaporates without history", () => {
    const { store, board } = setup();
    board.setTool("text");
    board.pointerDown(sample(1, 100, 100));
    board.pointerUp(sample(1, 100, 100));
    const edit = board.getEditorState().textEdit;
    assert.ok(edit);
    assert.equal(store.get(edit.id).type, "text");
    board.commitText();
    assert.equal(store.shapes().length, 0);
    assert.equal(store.undos.length, 0);

    board.setTool("note");
    board.pointerDown(sample(1, 100, 100));
    board.pointerUp(sample(1, 100, 100));
    const noteEdit = board.getEditorState().textEdit;
    board.setEditingText("h");
    board.setEditingText("hello");
    board.commitText();
    const note = store.get(noteEdit.id);
    assert.equal(note.props.text, "hello");
    assert.equal(note.props.color, "yellow");
    assert.equal(store.undos.length, 1);
    assert.throws(() => board.setEditingText("x"), Error);
  });

  test("laser stays in the overlay, never in the Store, and fades on QuickDraw's curve", () => {
    const { store, board } = setup();
    const overlays = [];
    board.addOnOverlayChangedListener((o) => overlays.push(o));
    board.setTool("laser");
    board.pointerDown({ pointerId: 1, source: "hand", x: 0, y: 0, timestampMs: 1000 });
    board.pointerMove({ pointerId: 1, source: "hand", x: 20, y: 0, timestampMs: 1010 });
    board.pointerUp({ pointerId: 1, source: "hand", x: 20, y: 0, timestampMs: 1020 });
    assert.equal(store.size, 0);
    assert.ok(overlays.length >= 3);
    board.expireOverlay(1020 + 250 + 425);
    assert.ok(Math.abs(board.getOverlay().laserStrokes[0].opacity - 0.5) < 1e-9);
    board.expireOverlay(1020 + 250 + 850);
    assert.deepEqual(board.getOverlay().laserStrokes, []);
  });

  test("hand pans the camera by board-space delta over zoom", () => {
    const { store, board } = setup({ camera: { x: 0, y: 0, z: 2 } });
    const cams = [];
    const sub = board.addOnEditorStateChangedListener((s) => cams.push(s.camera));
    board.setTool("hand");
    board.pointerDown(sample(1, 100, 100));
    board.pointerMove(sample(1, 140, 120));
    board.pointerUp(sample(1, 140, 120));
    assert.deepEqual(board.getEditorState().camera, { x: 20, y: 10, z: 2 });
    assert.ok(cams.length >= 1);
    sub.remove();
    sub.remove();
    assert.equal(store.size, 0);
  });

  test("undo mid-stroke undoes the in-progress stroke, as QuickDraw's Store.undo does", () => {
    const { store, board } = setup();
    stroke(board, 1, line(0, 0, 50, 0));
    board.pointerDown(sample(2, 0, 50));
    board.pointerMove(sample(2, 30, 50));
    board.undo();
    assert.equal(store.shapes().length, 1);
    board.pointerMove(sample(2, 60, 50));
    board.pointerUp(sample(2, 60, 50));
    assert.equal(store.shapes().length, 1);
    stroke(board, 3, line(0, 100, 50, 100));
    assert.equal(store.undos.length, 2);
  });

  test("dispose cancels open gestures and rejects further input", () => {
    const { store, board } = setup();
    board.pointerDown(sample(1, 0, 0));
    board.pointerMove(sample(1, 30, 0));
    board.dispose();
    assert.equal(store.shapes().length, 0);
    assert.equal(store.undos.length, 0);
    assert.throws(() => board.pointerDown(sample(2, 0, 0)), /disposed/);
  });
});
