import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { worldSlot, nearestWorldSlot } from "../src/world-slot.ts";

const approx = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `expected ${a} ~ ${b}`);

describe("world-anchored panel slots", () => {
  test("left, center, right form a viewer-facing three-slot arc", () => {
    const origin = [0, 1.6, 0];
    const left = worldSlot("left", origin, 0);
    const center = worldSlot("center", origin, 0);
    const right = worldSlot("right", origin, 0);
    assert.ok(left.position[0] < center.position[0]);
    assert.ok(center.position[0] < right.position[0]);
    approx(center.position[2], -2.6);
    approx(left.position[1], 1.6);
    approx(right.position[1], 1.6);
    approx(center.rotation[1], 0);
  });
  test("rotating and translating captured origin rotates slots", () => {
    const placement = worldSlot("center", [2, 1, 3], 90);
    approx(placement.position[0], -0.6);
    approx(placement.position[2], 3);
    assert.deepEqual(worldSlot("center", [2, 1, 3], 90), placement);
  });
  test("release snaps to nearest slot only within threshold", () => {
    for (const slot of ["left", "center", "right"]) {
      const p = worldSlot(slot, [0, 0, 0], 0).position;
      const hit = nearestWorldSlot([p[0] + 0.1, p[1], p[2]], [0, 0, 0], 0);
      assert.equal(hit?.slot, slot);
      approx(hit.distanceM, 0.1);
    }
    assert.equal(nearestWorldSlot([0, 0, 0], [0, 0, 0], 0), null);
    assert.equal(nearestWorldSlot([0, 0, -2.6], [0, 0, 0], 0, {}, 0)?.slot, "center");
    assert.equal(nearestWorldSlot([0.2, 0, -2.6], [0, 0, 0], 0, {}, 0), null);
  });
  test("custom arcs, vertical offsets, and argument validation", () => {
    const opts = { distanceM: 1.5, sideAngleDeg: 45, verticalOffsetM: -0.1 };
    const p = worldSlot("left", [1, 2, 3], 0, opts);
    approx(p.position[1], 1.9);
    assert.equal(nearestWorldSlot(p.position, [1, 2, 3], 0, opts, 0)?.slot, "left");
    assert.throws(() => worldSlot("left", [0, 0, 0], 0, { distanceM: -1 }), RangeError);
    assert.throws(() => nearestWorldSlot([0, 0, 0], [0, 0, 0], 0, {}, -1), RangeError);
  });
});
