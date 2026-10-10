import assert from "node:assert/strict";
import { test } from "node:test";
import { createPanelStore } from "../src/panel-store.ts";

test("panel placement, pin and close state remain isolated between instances", () => {
  const first = createPanelStore(true);
  const second = createPanelStore(false);
  const placement = { position: [1, 2, -3], rotation: [0, 28, 0] };
  first.getState().setReleasedPlacement(placement);
  first.setState({ pinned: false, closed: true });
  assert.deepEqual(first.getState().releasedPlacement, placement);
  assert.equal(second.getState().releasedPlacement, null);
  assert.equal(second.getState().closed, false);
  assert.equal(second.getState().pinned, false);
  first.getState().setReleasedPlacement(null);
  assert.equal(first.getState().releasedPlacement, null);
  assert.equal(first.getState().closed, true);
  assert.equal(first.getState().pinned, false);
  assert.equal(createPanelStore(true).getState().closed, false);
});
