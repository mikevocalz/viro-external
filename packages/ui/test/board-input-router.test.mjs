import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { composeNodeWorld, transformPoint } from "../src/quickdraw-input/board-geometry.ts";
import { createBoardInputRouter } from "../src/quickdraw-input/createBoardInputRouter.ts";
import { createQuickDrawBoardSession } from "../src/quickdraw-input/createQuickDrawBoardSession.ts";
import { createAdapterHandleSink, toLegacyQuickdrawSpatialPointer } from "../src/quickdraw-input/pointer-sinks.ts";
import { createMoveGesture } from "../../viro-external-core/src/createMoveGesture.ts";

const geometry = { widthM: 1.2, heightM: 0.75, widthPx: 2016, heightPx: 1260, boardWidth: 1008, boardHeight: 630, cornerRadiusM: 0.0381 };
const world = composeNodeWorld({ position: [0, 1.4, -2.6], rotation: [0, 20, 0] });
const at = (lx, ly, lz = 0) => transformPoint(world, [lx, ly, lz]);
const origin = at(0, 0);
const measureTextWidth = (text, { fontSizePx }) => text.length * fontSizePx * 0.5;

const setup = (options = {}) => {
  let clock = 1000;
  const router = createBoardInputRouter({ now: () => (clock += 5), ...options });
  router.setSurface(geometry, world);
  const events = [];
  router.addOnPointerEventListener((e) => events.push(e));
  return { router, events };
};

// Viro drag report for a live hit, given the press: dragTo = origin + hit - pressHit.
const dragTo = (hit, press) => hit.map((v, i) => origin[i] + v - press[i]);

const pen = (phase, local, extra = {}) => ({
  tracked: true, phase, position: local === null ? null : at(...local), headPosition: null,
  tipPressed: phase === "down" || phase === "move", primaryPressed: false, secondaryPressed: false,
  pressure: 0.4, timestamp: Date.now(), ...extra,
});

describe("board input router: Viro rays", () => {
  test("down, drag and up produce one captured stroke in paper UV", () => {
    const { router, events } = setup();
    const press = at(0, 0);
    router.handleViroClickState(1, press, 2);
    router.handleViroDrag(dragTo(at(0.3, 0.1875), press), 2);
    router.handleViroClickState(2, at(0.3, 0.1875), 2);
    router.handleViroClickState(3, at(0.3, 0.1875), 2);
    assert.deepEqual(events.map((e) => e.phase), ["down", "move", "up"]);
    assert.deepEqual(events[0].uv, [0.5, 0.5]);
    assert.ok(Math.abs(events[1].uv[0] - 0.75) < 1e-9 && Math.abs(events[1].uv[1] - 0.25) < 1e-9);
    assert.equal(new Set(events.map((e) => e.pointerId)).size, 1);
    assert.equal(events[0].pressure, undefined, "a trigger reports no pressure");
    assert.ok(events.every((e, i) => i === 0 || e.timestampMs >= events[i - 1].timestampMs));
    assert.equal(router.capturedCount, 0);
  });

  test("a press in a transparent corner, off the plane or on the background never starts a stroke", () => {
    const { router, events } = setup();
    router.handleViroClickState(1, at(-0.5995, 0.3745), 2);
    router.handleViroClickState(1, at(0, 0, 0.05), 2);
    router.handleViroClickState(1, [], 2);
    assert.equal(events.length, 0);
  });

  test("a captured stroke clamps to the paper edge and ends with an empty ClickUp position", () => {
    const { router, events } = setup();
    const press = at(0, 0);
    router.handleViroClickState(1, press, 2);
    router.handleViroDrag(dragTo(at(2, 0), press), 2);
    router.handleViroClickState(2, [], 2);
    assert.deepEqual(events[1].uv, [1, 0.5]);
    assert.deepEqual(events[2], { ...events[2], phase: "up", uv: [1, 0.5] });
  });

  test("eye gaze never draws or hovers", () => {
    const { router, events } = setup();
    router.handleViroHover(true, at(0, 0), 12);
    router.handleViroClickState(1, at(0, 0), 12);
    assert.equal(events.length, 0);
  });

  test("hover enters, moves and leaves; a captured pointer does not hover", () => {
    const { router, events } = setup();
    router.handleViroHover(true, at(0, 0), 3);
    router.handleViroHover(true, at(0.1, 0), 3);
    router.handleViroHover(false, [], 3);
    router.handleViroClickState(1, at(0, 0), 3);
    router.handleViroHover(true, at(0.2, 0), 3);
    assert.deepEqual(events.map((e) => e.phase), ["hover", "hover", "leave", "down"]);
  });

  test("cancelling one source leaves the other source's stroke running", () => {
    const { router, events } = setup();
    router.handleViroClickState(1, at(-0.2, 0), 2);
    router.handleViroClickState(1, at(0.2, 0), 3);
    router.cancelViroSource(2);
    router.handleViroDrag(dragTo(at(0.25, 0), at(0.2, 0)), 3);
    router.handleViroDrag(dragTo(at(-0.25, 0), at(-0.2, 0)), 2);
    router.handleViroClickState(2, at(0.25, 0), 3);
    const byId = Object.groupBy(events, (e) => e.pointerId);
    const ids = Object.keys(byId);
    assert.equal(ids.length, 2);
    assert.deepEqual(byId[ids[0]].map((e) => e.phase), ["down", "cancel"]);
    assert.deepEqual(byId[ids[1]].map((e) => e.phase), ["down", "move", "up"]);
  });

  test("moving the board cancels every stroke and blocks input until it ends", () => {
    const { router, events } = setup();
    router.handleViroClickState(1, at(0, 0), 2);
    router.beginBoardMove();
    router.handleViroClickState(1, at(0.1, 0), 3);
    router.handleViroDrag(at(0.2, 0), 2);
    assert.deepEqual(events.map((e) => e.phase), ["down", "cancel"]);
    const moved = composeNodeWorld({ position: [0.5, 1.4, -2.6], rotation: [0, 20, 0] });
    router.endBoardMove(moved);
    router.handleViroClickState(1, transformPoint(moved, [0, 0, 0]), 2);
    assert.deepEqual(events.at(-1).uv, [0.5, 0.5], "maps through the new pose");
  });

  test("a paper remounted while a grip was in progress takes input again", () => {
    const { router, events } = setup();
    router.beginBoardMove();
    // useBoardPaperInput's unmount cleanup, then the new mount's effects.
    router.cancelAll("unmount");
    router.setEnabled(false);
    router.setSurface(geometry, world);
    router.setEnabled(true);
    router.handleViroClickState(1, at(0, 0), 2);
    assert.deepEqual(events.map((e) => e.phase), ["down"]);
  });

  test("a reset key change or a new surface during a grip ends the move", () => {
    for (const end of [(r) => r.cancelAll("tracking-lost"), (r) => r.setSurface(geometry, world)]) {
      const { router, events } = setup();
      router.beginBoardMove();
      end(router);
      router.handleViroClickState(1, at(0, 0), 2);
      assert.deepEqual(events.map((e) => e.phase), ["down"], end.toString());
    }
  });

  test("an aborted grip gesture starts over: the next drag begins a new move", () => {
    const { router, events } = setup();
    const moves = [];
    const gesture = createMoveGesture();
    const drag = (pos) => {
      const { position, isStart } = gesture.drag(pos, undefined);
      if (isStart) {
        moves.push("start");
        router.beginBoardMove();
      }
      return position;
    };
    drag([0, 1.4, -2.6]);
    drag([0.2, 1.4, -2.6]);
    // MovableNode's position prop was reset, or it unmounted, mid-grip.
    gesture.abort();
    assert.equal(gesture.isActive, false);
    assert.equal(gesture.release(), undefined, "an aborted gesture reports no release");
    router.cancelAll("unmount");
    drag([1, 1.4, -2.6]);
    const released = gesture.release();
    assert.deepEqual(released, [1, 1.4, -2.6]);
    assert.deepEqual(moves, ["start", "start"]);
    router.endBoardMove(composeNodeWorld({ position: released, rotation: [0, 20, 0] }));
    router.handleViroClickState(1, transformPoint(composeNodeWorld({ position: released, rotation: [0, 20, 0] }), [0, 0, 0]), 2);
    assert.deepEqual(events.map((e) => e.phase), ["down"]);
  });

  test("the grip gesture locks axes to the first sample", () => {
    const gesture = createMoveGesture();
    gesture.drag([1, 2, 3], ["y"]);
    assert.deepEqual(gesture.drag([4, 5, 6], ["y"]).position, [4, 2, 6]);
    assert.deepEqual(gesture.release(), [4, 2, 6]);
    assert.equal(gesture.release(), undefined, "release is reported once");
  });

  test("background, unmount, ownership change and disable cancel deterministically and only once", () => {
    for (const reason of ["background", "unmount", "ownership-changed", "tracking-lost", "focus-lost"]) {
      const { router, events } = setup();
      router.handleViroClickState(1, at(0, 0), 2);
      router.cancelAll(reason);
      router.cancelAll(reason);
      router.handleViroClickState(2, at(0, 0), 2);
      assert.deepEqual(events.map((e) => e.phase), ["down", "cancel"], reason);
    }
    const { router, events } = setup();
    router.handleViroClickState(1, at(0, 0), 2);
    router.setEnabled(false);
    router.handleViroClickState(1, at(0, 0), 3);
    assert.deepEqual(events.map((e) => e.phase), ["down", "cancel"]);
  });

  test("a new surface cancels in-flight strokes; dispose stops all output", () => {
    const { router, events } = setup();
    router.handleViroClickState(1, at(0, 0), 2);
    router.setSurface({ ...geometry, widthPx: 1008, heightPx: 630 }, world);
    router.dispose();
    router.dispose();
    router.handleViroClickState(1, at(0, 0), 2);
    assert.deepEqual(events.map((e) => e.phase), ["down", "cancel"]);
  });

  test("invalid geometry and singular poses are rejected", () => {
    const router = createBoardInputRouter();
    assert.throws(() => router.setSurface({ ...geometry, widthM: 0 }, world), RangeError);
    assert.throws(() => router.setSurface(geometry, composeNodeWorld({ scale: [1, 0, 1] })), RangeError);
  });
});

describe("board input router: Muse pen", () => {
  test("pressure passes through, 0 stays 0, and an unusable reading is undefined, never invented", () => {
    const { router, events } = setup();
    router.handlePenSample(pen("down", [0, 0, 0.005], { pressure: 0, timestampMs: 10 }));
    router.handlePenSample(pen("move", [0.1, 0, 0.004], { pressure: 0.7, timestampMs: 18 }));
    router.handlePenSample(pen("move", [0.12, 0, 0.004], { pressure: Number.NaN, timestampMs: 26 }));
    router.handlePenSample(pen("up", [0.12, 0, 0.004], { pressure: 0, timestampMs: 34 }));
    assert.deepEqual(events.map((e) => [e.phase, e.pressure, e.source]), [
      ["down", 0, "pen"], ["move", 0.7, "pen"], ["move", undefined, "pen"], ["up", 0, "pen"],
    ]);
    assert.deepEqual(events.map((e) => e.timestampMs), [10, 18, 26, 34], "uses the stream's monotonic clock");
  });

  test("a press in the air does not draw; tracking loss cancels only the pen", () => {
    const { router, events } = setup();
    router.handlePenSample(pen("down", [0, 0, 0.2]));
    assert.equal(events.length, 0);
    router.handleViroClickState(1, at(0.3, 0), 2);
    router.handlePenSample(pen("down", [0, 0, 0]));
    router.handlePenSample(pen("move", [0, 0, 0], { tracked: false }));
    router.handleViroClickState(2, at(0.3, 0), 2);
    assert.deepEqual(events.map((e) => [e.source, e.phase]), [
      ["controller", "down"], ["pen", "down"], ["pen", "cancel"], ["controller", "up"],
    ]);
  });
});

describe("sinks and the board session", () => {
  test("router events edit the session board as board units; a cancelled stroke leaves no shape or undo step", () => {
    let clock = 0;
    const session = createQuickDrawBoardSession({ measureTextWidth, input: { now: () => (clock += 8) } });
    session.input.setSurface(geometry, world);
    const press = at(-0.3, 0);
    session.input.handleViroClickState(1, press, 2);
    for (let i = 1; i <= 6; i += 1) session.input.handleViroDrag(dragTo(at(-0.3 + i * 0.1, 0.05 * i), press), 2);
    session.input.handleViroClickState(2, at(0.3, 0.3), 2);
    assert.equal(session.store.shapes().length, 1);
    const shape = session.store.shapes()[0];
    assert.ok(Math.abs(shape.x - 252) < 1, `stroke starts at board x 252, got ${shape.x}`);

    const press2 = at(0, -0.2);
    session.input.handleViroClickState(1, press2, 2);
    session.input.handleViroDrag(dragTo(at(0.2, -0.2), press2), 2);
    session.input.cancelAll("tracking-lost");
    assert.equal(session.store.shapes().length, 1, "cancelled stroke removed");
    session.board.undo();
    assert.equal(session.store.shapes().length, 0, "the one undo step is the completed stroke");
    session.dispose();
    session.dispose();
    assert.equal(session.isDisposed, true);
  });

  test("the session's store and history outlive a surface change", () => {
    const session = createQuickDrawBoardSession({ measureTextWidth, input: { now: (() => { let t = 0; return () => (t += 8); })() } });
    session.input.setSurface(geometry, world);
    const press = at(0, 0);
    session.input.handleViroClickState(1, press, 2);
    session.input.handleViroDrag(dragTo(at(0.1, 0), press), 2);
    session.input.handleViroClickState(2, at(0.1, 0), 2);
    const before = JSON.stringify(session.store.getSnapshot());
    session.input.setSurface({ ...geometry, widthPx: 4032, heightPx: 2520 }, composeNodeWorld({ position: [1, 1, -1] }));
    assert.equal(JSON.stringify(session.store.getSnapshot()), before);
    session.dispose();
  });

  test("adapter sink prefers dispatchPointerEvent and falls back to the deprecated shape", () => {
    const event = { phase: "down", pointerId: 4, source: "controller", uv: [0.1, 0.2], timestampMs: 5 };
    const modern = [];
    createAdapterHandleSink({ dispatchPointer: () => assert.fail("old path used"), dispatchPointerEvent: (e) => modern.push(e) })(event);
    assert.deepEqual(modern, [event]);
    const legacy = [];
    createAdapterHandleSink({ dispatchPointer: (e) => legacy.push(e) })(event);
    assert.deepEqual(legacy, [{ phase: "down", source: "controller", uv: [0.1, 0.2], timestamp: 5 }]);
  });

  test("legacy panel pointer: no-reading pressure is QuickDraw's 0.5, leave has no counterpart", () => {
    const base = { pointerId: 1, source: "pen", uv: [0.5, 0.5], timestampMs: 9 };
    assert.equal(toLegacyQuickdrawSpatialPointer({ ...base, phase: "move" }).pressure, 0.5);
    assert.equal(toLegacyQuickdrawSpatialPointer({ ...base, phase: "move", pressure: 0 }).pressure, 0);
    assert.equal(toLegacyQuickdrawSpatialPointer({ ...base, phase: "leave" }), undefined);
  });
});
