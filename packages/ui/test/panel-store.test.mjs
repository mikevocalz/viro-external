import assert from "node:assert/strict";
import { test } from "node:test";
import { createPanelStore } from "../src/panel-store.ts";

test("panel placement, pin and close state remain isolated between instances", () => {
  const first = createPanelStore({ defaultPinned: true });
  const second = createPanelStore({ defaultPinned: false });
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
  assert.equal(createPanelStore({ defaultPinned: true }).getState().closed, false);
});


test("callback-mirrored release preserves the resolved snap instead of the initial slot", () => {
  const initialPlacement = { position: [-1, 1, -2], rotation: [0, 28, 0] };
  const snapped = { position: [1, 1, -2], rotation: [0, -28, 0] };
  const rawRelease = [1.1, 1, -2];
  const store = createPanelStore({ defaultPinned: true, position: initialPlacement.position });
  store.getState().setReleasedPlacement(snapped, rawRelease);
  store.getState().syncAuthoredPose({ position: [...rawRelease], initialPlacement });
  assert.deepEqual(store.getState().releasedPlacement, snapped);
});

test("deliberate authored position overrides both the last release and initial snap slot", () => {
  const initialPlacement = { position: [-1, 1, -2], rotation: [0, 28, 0] };
  const store = createPanelStore({ defaultPinned: true });
  store.getState().setReleasedPlacement({ position: [1, 1, -2], rotation: [0, -28, 0] }, [1, 1, -2]);
  store.getState().syncAuthoredPose({ position: [0, 2, -3], initialPlacement });
  assert.deepEqual(store.getState().releasedPlacement, {
    position: [0, 2, -3], rotation: [0, -28, 0],
  });
});

test("authored rotation updates retain the released position and repeated values preserve state", () => {
  const store = createPanelStore({ defaultPinned: true });
  store.getState().setReleasedPlacement({ position: [1, 1, -2], rotation: [0, 0, 0] }, [1, 1, -2]);
  store.getState().syncAuthoredPose({ rotation: [0, 45, 0] });
  const placement = store.getState().releasedPlacement;
  assert.deepEqual(placement, { position: [1, 1, -2], rotation: [0, 45, 0] });
  store.getState().syncAuthoredPose({ rotation: [0, 45, 0] });
  assert.equal(store.getState().releasedPlacement, placement);
});
