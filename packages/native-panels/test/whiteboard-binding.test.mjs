import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { Store } from "@quickdrawjs/core";
import { createHeadlessBoard } from "../../ui/src/quickdraw-headless/createHeadlessBoard.ts";
import { getInkOutline } from "../../ui/src/quickdraw-headless/ink-outline.ts";
import { createInkOutlineEncoder } from "../src/whiteboard/createInkOutlineEncoder.ts";
import { createWhiteboardRendererBinding } from "../src/whiteboard/createWhiteboardRendererBinding.ts";
import { resolveWhiteboardRendererFactory } from "../src/whiteboard/resolveWhiteboardRendererFactory.ts";

// A renderer that behaves like the Kotlin one at the JS boundary: strictly
// increasing revisions, all-or-nothing calls, a document rebuilt from the
// wire JSON.
function createFakeRenderer() {
  const calls = [];
  const doc = new Map();
  const listeners = new Set();
  let lastRevision = -Infinity;
  let failNext = { applyDiff: 0, loadSnapshot: 0 };

  const gate = (method, revision) => {
    if (failNext[method] > 0) {
      failNext[method] -= 1;
      throw new Error(`${method} rejected by test`);
    }
    if (!(revision > lastRevision)) throw new Error(`Revision ${revision} is not newer than ${lastRevision}`);
    lastRevision = revision;
  };

  return {
    calls,
    doc,
    failNext(method, times = 1) {
      failNext[method] = times;
    },
    emitState(state) {
      for (const listener of listeners) listener(state);
    },
    loadSnapshot(revision, json) {
      const parsed = JSON.parse(json);
      gate("loadSnapshot", revision);
      calls.push({ method: "loadSnapshot", revision, payload: parsed });
      doc.clear();
      for (const [id, record] of Object.entries(parsed.document.store)) doc.set(id, record);
    },
    applyDiff(revision, json) {
      const parsed = JSON.parse(json);
      gate("applyDiff", revision);
      calls.push({ method: "applyDiff", revision, payload: parsed });
      for (const [id, record] of Object.entries(parsed.added)) doc.set(id, record);
      for (const [id, pair] of Object.entries(parsed.updated)) doc.set(id, pair[1]);
      for (const id of Object.keys(parsed.removed)) doc.delete(id);
    },
    setCamera(camera) {
      calls.push({ method: "setCamera", camera });
    },
    setOverlay(json) {
      calls.push({ method: "setOverlay", payload: JSON.parse(json) });
    },
    addOnStateChangedListener(listener) {
      listeners.add(listener);
      return { remove: () => listeners.delete(listener) };
    },
  };
}

function createFrames() {
  const queue = new Map();
  let next = 1;
  return {
    requestFrame(callback) {
      const handle = next++;
      queue.set(handle, callback);
      return handle;
    },
    cancelFrame(handle) {
      queue.delete(handle);
    },
    get pending() {
      return queue.size;
    },
    run(timestampMs = 0) {
      const callbacks = [...queue.values()];
      queue.clear();
      for (const callback of callbacks) callback(timestampMs);
    },
  };
}

const measureTextWidth = (text, { fontSizePx }) => text.length * fontSizePx * 0.5;

const drawRecord = (id, z = 1) => ({
  id,
  typeName: "shape",
  type: "draw",
  x: 10,
  y: 20,
  rot: 0,
  z,
  props: { pts: [0, 0, 0.5, 4, 3, 0.5, 9, 7, 0.5], color: "blue", size: "m", dash: "draw", done: true },
});

const geoRecord = (id, z = 2) => ({
  id,
  typeName: "shape",
  type: "geo",
  x: 0,
  y: 0,
  rot: 0,
  z,
  props: { geo: "rectangle", w: 40, h: 30, color: "black", size: "m", dash: "solid", fill: "none" },
});

const setup = (extra = {}) => {
  const store = extra.store ?? new Store();
  const renderer = createFakeRenderer();
  const frames = createFrames();
  const errors = [];
  const binding = createWhiteboardRendererBinding({
    store,
    renderer,
    getInkOutline,
    requestFrame: frames.requestFrame,
    cancelFrame: frames.cancelFrame,
    onError: (error) => errors.push(error),
    ...extra,
  });
  return { store, renderer, frames, errors, binding };
};

const docMatchesStore = (renderer, store) => {
  assert.deepEqual([...renderer.doc.keys()].sort(), store.ids().sort());
  for (const id of store.ids()) {
    const { inkOutline, ...record } = renderer.doc.get(id);
    assert.deepEqual(record, store.get(id));
  }
};

describe("createWhiteboardRendererBinding", () => {
  test("sends a snapshot first, with QuickDraw's ink outline on draw records", () => {
    const { store, renderer, frames } = setup();
    store.put(drawRecord("shape:a"), "remote");
    store.put(geoRecord("shape:b"), "remote");
    frames.run();

    assert.equal(renderer.calls.length, 1);
    const [first] = renderer.calls;
    assert.equal(first.method, "loadSnapshot");
    assert.equal(first.revision, 1);
    assert.deepEqual(first.payload.document.store["shape:a"].inkOutline, getInkOutline(drawRecord("shape:a")));
    assert.equal(first.payload.document.store["shape:b"].inkOutline, undefined);
    docMatchesStore(renderer, store);
  });

  test("coalesces every diff between two frames into one applyDiff", () => {
    const { store, renderer, frames } = setup();
    frames.run();
    renderer.calls.length = 0;

    store.put(drawRecord("shape:a"));
    store.put(geoRecord("shape:b"));
    store.update("shape:b", { x: 99 });
    store.put(geoRecord("shape:c"));
    store.remove(["shape:c"]);
    assert.equal(frames.pending, 1, "one frame is queued for the whole burst");
    frames.run();

    assert.equal(renderer.calls.length, 1);
    const [call] = renderer.calls;
    assert.equal(call.method, "applyDiff");
    assert.equal(call.revision, 2);
    assert.deepEqual(Object.keys(call.payload.added).sort(), ["shape:a", "shape:b"]);
    assert.equal(call.payload.added["shape:b"].x, 99);
    assert.equal(call.payload.added["shape:c"], undefined, "added then removed in one frame cancels out");
    assert.deepEqual(call.payload.removed, {});
    docMatchesStore(renderer, store);
  });

  test("revisions strictly increase across frames", () => {
    const { store, renderer, frames } = setup();
    frames.run();
    for (let i = 0; i < 5; i++) {
      store.put(geoRecord(`shape:${i}`, i));
      frames.run();
    }
    const revisions = renderer.calls.map((c) => c.revision);
    assert.deepEqual(revisions, [1, 2, 3, 4, 5, 6]);
    docMatchesStore(renderer, store);
  });

  test("answers a rejected diff with a snapshot in the same frame", () => {
    const { store, renderer, frames, errors } = setup();
    store.put(geoRecord("shape:a"), "remote");
    frames.run();
    renderer.calls.length = 0;

    renderer.failNext("applyDiff");
    store.put(drawRecord("shape:b"));
    frames.run();

    assert.equal(errors.length, 1);
    assert.match(errors[0].message, /applyDiff rejected/);
    assert.deepEqual(renderer.calls.map((c) => c.method), ["loadSnapshot"]);
    assert.equal(renderer.calls[0].revision, 3, "the rejected revision is never reused");
    docMatchesStore(renderer, store);
  });

  test("a renderer that rejects stale revisions never sees one", () => {
    const { store, renderer, frames, errors } = setup();
    frames.run();
    renderer.failNext("applyDiff", 2);
    store.put(geoRecord("shape:a"));
    frames.run();
    store.put(geoRecord("shape:b"));
    frames.run();
    store.put(geoRecord("shape:c"));
    frames.run();
    assert.ok(errors.every((e) => !/not newer/.test(e.message)), "no stale-revision error was produced");
    docMatchesStore(renderer, store);
  });

  test("a rejected resync waits for the next store change instead of spinning", () => {
    const { store, renderer, frames, errors } = setup();
    renderer.failNext("loadSnapshot");
    frames.run();
    assert.equal(errors.length, 1);
    assert.equal(frames.pending, 0, "no frame is queued after a failed resync");

    store.put(geoRecord("shape:a"));
    assert.equal(frames.pending, 1);
    frames.run();
    assert.deepEqual(renderer.calls.map((c) => c.method), ["loadSnapshot"]);
    docMatchesStore(renderer, store);
  });

  test("reloads a snapshot when the renderer reports lost", () => {
    const { store, renderer, frames } = setup();
    store.put(geoRecord("shape:a"), "remote");
    frames.run();
    renderer.calls.length = 0;

    renderer.emitState("suspended");
    assert.equal(frames.pending, 0, "suspended keeps the renderer's document");
    renderer.emitState("lost");
    frames.run();
    assert.deepEqual(renderer.calls.map((c) => c.method), ["loadSnapshot"]);
    docMatchesStore(renderer, store);
  });

  test("dispose cancels the pending frame and stops listening", () => {
    const { store, renderer, frames, binding } = setup();
    binding.dispose();
    assert.equal(frames.pending, 0);
    store.put(geoRecord("shape:a"));
    renderer.emitState("lost");
    frames.run();
    assert.equal(renderer.calls.length, 0);
    binding.dispose();
  });
});

describe("createWhiteboardRendererBinding with a headless board", () => {
  const boardSetup = () => {
    const store = new Store();
    const board = createHeadlessBoard({ store, measureTextWidth });
    return { board, ...setup({ store, board }) };
  };

  test("sends the camera once per change", () => {
    const { board, renderer, frames } = boardSetup();
    frames.run();
    assert.deepEqual(renderer.calls.filter((c) => c.method === "setCamera").map((c) => c.camera), [{ x: 0, y: 0, z: 1 }]);
    board.setCamera({ x: -5, y: 3, z: 2 });
    board.setCamera({ x: -5, y: 3, z: 2 });
    frames.run();
    assert.deepEqual(renderer.calls.filter((c) => c.method === "setCamera").map((c) => c.camera), [
      { x: 0, y: 0, z: 1 },
      { x: -5, y: 3, z: 2 },
    ]);
  });

  test("strokes reach the renderer as one diff per frame and laser trails fade out", () => {
    const { board, store, renderer, frames } = boardSetup();
    frames.run();
    renderer.calls.length = 0;

    const sample = (x, y, t) => ({ pointerId: 1, source: "controller", x, y, timestampMs: t });
    board.pointerDown(sample(0, 0, 0));
    board.pointerMove(sample(10, 4, 8));
    board.pointerMove(sample(20, 9, 16));
    board.pointerUp(sample(30, 12, 24));
    frames.run(30);
    assert.equal(renderer.calls.filter((c) => c.method === "applyDiff").length, 1);
    docMatchesStore(renderer, store);
    const [id] = store.ids();
    assert.deepEqual(renderer.doc.get(id).inkOutline, getInkOutline(store.get(id)));

    renderer.calls.length = 0;
    board.setTool("laser");
    board.pointerDown(sample(0, 0, 100));
    board.pointerMove(sample(50, 50, 116));
    board.pointerUp(sample(60, 60, 132));
    frames.run(140);
    const overlays = () => renderer.calls.filter((c) => c.method === "setOverlay").map((c) => c.payload);
    assert.equal(overlays().at(-1).laserStrokes.length, 1);
    assert.equal(frames.pending, 1, "a fading trail keeps frames coming");

    frames.run(132 + 250 + 425);
    const midFade = overlays().at(-1).laserStrokes[0].opacity;
    assert.ok(midFade > 0 && midFade < 1, `opacity mid-fade was ${midFade}`);
    frames.run(132 + 250 + 850 + 1);
    assert.equal(overlays().at(-1).laserStrokes.length, 0);
    assert.equal(frames.pending, 0, "frames stop once every trail has faded");
    assert.equal(renderer.calls.filter((c) => c.method === "applyDiff").length, 0, "the laser never writes the store");
  });
});

describe("createInkOutlineEncoder", () => {
  test("sends updated 'from' records and removed values as null", () => {
    const encoder = createInkOutlineEncoder(getInkOutline);
    const a = drawRecord("shape:a");
    const moved = { ...a, x: 50 };
    const diff = JSON.parse(
      encoder.encodeDiff({ added: {}, updated: { "shape:a": [a, moved] }, removed: { "shape:b": geoRecord("shape:b") } }),
    );
    assert.equal(diff.updated["shape:a"][0], null);
    assert.equal(diff.updated["shape:a"][1].x, 50);
    assert.deepEqual(diff.updated["shape:a"][1].inkOutline, getInkOutline(moved));
    assert.deepEqual(diff.removed, { "shape:b": null });
  });

  test("computes each outline once per props object", () => {
    let calls = 0;
    const encoder = createInkOutlineEncoder((shape) => {
      calls += 1;
      return getInkOutline(shape);
    });
    const a = drawRecord("shape:a");
    encoder.encodeSnapshot({ document: { store: { [a.id]: a } } });
    encoder.encodeDiff({ added: {}, updated: { [a.id]: [a, { ...a, x: 1 }] }, removed: {} });
    assert.equal(calls, 1, "a move keeps props, so the outline is reused");
    encoder.encodeDiff({ added: {}, updated: { [a.id]: [a, { ...a, props: { ...a.props, color: "red" } }] }, removed: {} });
    assert.equal(calls, 2);
  });

  test("leaves non-ink draw dashes without an outline", () => {
    const encoder = createInkOutlineEncoder(getInkOutline);
    const dashed = { ...drawRecord("shape:a"), props: { ...drawRecord("shape:a").props, dash: "dashed" } };
    const snap = JSON.parse(encoder.encodeSnapshot({ document: { store: { [dashed.id]: dashed } } }));
    assert.equal(snap.document.store[dashed.id].inkOutline, undefined);
  });
});

describe("resolveWhiteboardRendererFactory", () => {
  const NAME = "nativepanels.WhiteboardRendererFactory";
  // The generated runtime caches the class after the first read, as it does
  // in the app, so the tests flip availability on one object.
  const factory = { isAvailable: false };

  test("is undefined when no native class is registered (iOS today)", () => {
    globalThis.__fakeNitro.classes.clear();
    assert.equal(resolveWhiteboardRendererFactory(), undefined);
  });

  test("is undefined when the device reports the renderer unavailable", () => {
    globalThis.__fakeNitro.classes.set(NAME, factory);
    factory.isAvailable = false;
    assert.equal(resolveWhiteboardRendererFactory(), undefined);
  });

  test("returns the factory when it is available", () => {
    globalThis.__fakeNitro.classes.set(NAME, factory);
    factory.isAvailable = true;
    assert.equal(resolveWhiteboardRendererFactory(), factory);
    globalThis.__fakeNitro.classes.clear();
  });
});
