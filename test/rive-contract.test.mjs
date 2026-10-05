/**
 * Rive spatial contract + native-host adapter tests.
 *
 * Runs under Node's type stripping: the contract file has no imports and the
 * adapter's imports are type-only, so both execute dependency-free.
 *   pnpm run test:rive-contract
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  DEFAULT_RIVE_DRAG,
} from "../packages/xr-platform-contract/src/rive.ts";
import {
  ViroCoreRiveSpatialAdapter,
} from "../packages/ui/src/RiveNativeHost.ts";

const CAPS = {
  nativeRenderer: true,
  stateMachines: true,
  dataBinding: true,
  pointerInput: true,
  externalRenderTarget: true,
  depthComposition: true,
};

function makeHost() {
  const calls = [];
  const host = {
    mount: (config) => {
      calls.push(["mount", config]);
      return { surfaceId: "s" + calls.length, capabilities: CAPS };
    },
    unmount: (id) => calls.push(["unmount", id]),
    play: (id) => calls.push(["play", id]),
    pause: (id) => calls.push(["pause", id]),
    reset: (id) => calls.push(["reset", id]),
    setStateMachineInput: (id, name, value) =>
      calls.push(["setStateMachineInput", id, name, value]),
    dispatchPointer: (id, event) => calls.push(["dispatchPointer", id, event]),
    setSurfaceTranslation: (id, t) =>
      calls.push(["setSurfaceTranslation", id, t]),
  };
  return { host, calls };
}

function mount(adapter, overrides = {}) {
  return adapter.mount({
    source: { kind: "url", uri: "file:///panel.riv" },
    width: 1.2,
    height: 0.8,
    interactive: true,
    ...overrides,
  });
}

const at = (x, y, z = 0) => /** @type {const} */ ([x, y, z]);
const ptr = (phase, worldPosition, extra = {}) => ({
  phase,
  source: "controller",
  uv: /** @type {const} */ ([0.5, 0.5]),
  worldPosition,
  timestamp: 1,
  ...extra,
});

test("contract defaults: drag enabled, free axis, 1cm activation", () => {
  assert.equal(DEFAULT_RIVE_DRAG.enabled, true);
  assert.equal(DEFAULT_RIVE_DRAG.axis, "free");
  assert.equal(DEFAULT_RIVE_DRAG.activationDistance, 0.01);
  assert.equal(DEFAULT_RIVE_DRAG.followPointer, true);
});

test("handle forwards runtime methods to the native surface", () => {
  const { host, calls } = makeHost();
  const adapter = new ViroCoreRiveSpatialAdapter(host);
  const handle = mount(adapter);
  handle.play();
  handle.pause();
  handle.reset();
  handle.setStateMachineInput("level", 3);
  assert.deepEqual(calls.slice(1).map((c) => c[0]), [
    "play", "pause", "reset", "setStateMachineInput",
  ]);
  assert.deepEqual(calls.at(-1), ["setStateMachineInput", "s1", "level", 3]);
  assert.equal(handle.getCapabilities(), CAPS);
  adapter.unmount(handle);
  assert.deepEqual(calls.at(-1), ["unmount", "s1"]);
});

test("pointer events pass through to the native surface", () => {
  const { host, calls } = makeHost();
  const adapter = new ViroCoreRiveSpatialAdapter(host);
  const handle = mount(adapter, { interactive: false });
  const event = ptr("down", at(0.1, 0.2, -0.5));
  handle.dispatchPointer(event);
  assert.deepEqual(calls.at(-1), ["dispatchPointer", "s1", event]);
});

test("non-interactive panels never start a drag", () => {
  const { host, calls } = makeHost();
  const adapter = new ViroCoreRiveSpatialAdapter(host);
  const handle = mount(adapter, { interactive: false });
  handle.beginDrag(ptr("down", at(0, 0, 0)));
  handle.updateDrag(ptr("move", at(0.5, 0, 0)));
  handle.endDrag(ptr("up", at(0.5, 0, 0)));
  assert.equal(
    calls.filter((c) => c[0] === "setSurfaceTranslation").length,
    0,
  );
});

test("drag respects activationDistance before the panel moves", () => {
  const { host, calls } = makeHost();
  const adapter = new ViroCoreRiveSpatialAdapter(host);
  const handle = mount(adapter, { drag: { activationDistance: 0.05 } });
  handle.beginDrag(ptr("down", at(0, 0, 0)));
  // Below threshold: no translation yet.
  handle.updateDrag(ptr("move", at(0.04, 0, 0)));
  assert.equal(
    calls.filter((c) => c[0] === "setSurfaceTranslation").length,
    0,
  );
  // Past threshold: activates.
  handle.updateDrag(ptr("move", at(0.06, 0, 0)));
  const moves = calls.filter((c) => c[0] === "setSurfaceTranslation");
  assert.equal(moves.length, 1);
  assert.deepEqual(moves[0][2], [0.06, 0, 0]);
});

test("horizontal axis locks movement to X", () => {
  const { host, calls } = makeHost();
  const adapter = new ViroCoreRiveSpatialAdapter(host);
  const handle = mount(adapter, { drag: { axis: "horizontal" } });
  handle.beginDrag(ptr("down", at(0, 0, 0)));
  handle.updateDrag(ptr("move", at(0.2, 0.5, 0.1)));
  const moves = calls.filter((c) => c[0] === "setSurfaceTranslation");
  assert.equal(moves.length, 1);
  assert.deepEqual(moves[0][2], [0.2, 0, 0]);
});

test("vertical axis locks movement to Y", () => {
  const { host, calls } = makeHost();
  const adapter = new ViroCoreRiveSpatialAdapter(host);
  const handle = mount(adapter, { drag: { axis: "vertical" } });
  handle.beginDrag(ptr("down", at(0, 0, 0)));
  handle.updateDrag(ptr("move", at(0.2, 0.5, 0.1)));
  const moves = calls.filter((c) => c[0] === "setSurfaceTranslation");
  assert.equal(moves.length, 1);
  assert.deepEqual(moves[0][2], [0, 0.5, 0]);
});

test("maxDistance clamps total displacement, not per-frame increments", () => {
  const { host, calls } = makeHost();
  const adapter = new ViroCoreRiveSpatialAdapter(host);
  const handle = mount(adapter, { drag: { maxDistance: 0.1 } });
  handle.beginDrag(ptr("down", at(0, 0, 0)));
  // Two moves, each individually under maxDistance, totalling past it.
  handle.updateDrag(ptr("move", at(0.08, 0, 0)));
  handle.updateDrag(ptr("move", at(0.16, 0, 0)));
  const moves = calls.filter((c) => c[0] === "setSurfaceTranslation");
  assert.equal(moves.length, 2);
  assert.deepEqual(moves[1][2], [0.1, 0, 0]);
  // Pulling back inside the radius unclamps.
  handle.updateDrag(ptr("move", at(0.04, 0, 0)));
  const after = calls.filter((c) => c[0] === "setSurfaceTranslation");
  assert.deepEqual(after.at(-1)[2], [0.04, 0, 0]);
});

test("followPointer=false tracks the gesture without moving the surface", () => {
  const { host, calls } = makeHost();
  const adapter = new ViroCoreRiveSpatialAdapter(host);
  const handle = mount(adapter, { drag: { followPointer: false } });
  handle.beginDrag(ptr("down", at(0, 0, 0)));
  handle.updateDrag(ptr("move", at(0.5, 0, 0)));
  handle.endDrag(ptr("up", at(0.5, 0, 0)));
  assert.equal(
    calls.filter((c) => c[0] === "setSurfaceTranslation").length,
    0,
  );
});

test("cancelDrag and pointer cancel both release capture cleanly", () => {
  const { host, calls } = makeHost();
  const adapter = new ViroCoreRiveSpatialAdapter(host);
  const handle = mount(adapter);
  handle.beginDrag(ptr("down", at(0, 0, 0)));
  handle.cancelDrag();
  // After cancel, an update must not move the surface (stale state check).
  handle.updateDrag(ptr("move", at(0.5, 0, 0)));
  assert.equal(
    calls.filter((c) => c[0] === "setSurfaceTranslation").length,
    0,
  );

  // A terminal pointer phase without worldPosition still releases.
  handle.beginDrag(ptr("down", at(0, 0, 0)));
  handle.dispatchPointer(ptr("cancel", undefined));
  handle.updateDrag(ptr("move", at(0.5, 0, 0)));
  assert.equal(
    calls.filter((c) => c[0] === "setSurfaceTranslation").length,
    0,
  );
});

test("dispatchPointer drives drag via down/move/up phases", () => {
  const { host, calls } = makeHost();
  const adapter = new ViroCoreRiveSpatialAdapter(host);
  const handle = mount(adapter);
  handle.dispatchPointer(ptr("down", at(0, 0, 0)));
  handle.dispatchPointer(ptr("move", at(0.1, 0, 0)));
  const moves = calls.filter((c) => c[0] === "setSurfaceTranslation");
  assert.equal(moves.length, 1);
  assert.deepEqual(moves[0][2], [0.1, 0, 0]);
  handle.dispatchPointer(ptr("up", at(0.1, 0, 0)));
  // A second gesture starts from the settled translation, not from zero.
  handle.dispatchPointer(ptr("down", at(0.1, 0, 0)));
  handle.dispatchPointer(ptr("move", at(0.2, 0, 0)));
  const all = calls.filter((c) => c[0] === "setSurfaceTranslation");
  assert.deepEqual(all.at(-1)[2], [0.2, 0, 0]);
});
