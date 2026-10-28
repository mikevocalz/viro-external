// Cross-repo check: scene documents compiled by viro's runtime compiler from
// examples/specs-platform-lab/SpecsActionsLab.tsx drive the Lens controller.
// Evidence label: portable-test-passed.
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { ViroSpecsSceneController } from "../build/lens-core/ViroSpecsSceneController.js";
import { ManualScheduler, MockBackend } from "./support/mock-scene-host.mjs";

function pinch(backend, scheduler, nodeId, source = "hand-right") {
  backend.fire(nodeId, { phase: "hover-enter", source });
  backend.fire(nodeId, { phase: "select-end", source });
  scheduler.tick();
}

test("fixtures compiled by viro from SpecsActionsLab drive the same flow", () => {
  const dir = new URL("./fixtures/actions/", import.meta.url);
  const read = (name) => JSON.parse(readFileSync(new URL(name, dir), "utf8"));
  // Copied from viro __test__/fixtures/specs/actions (feat/specs-actions 440f93b5).
  // Regenerate there with `npm run fixtures:specs-actions` and copy the three files here.
  for (const name of ["list.scene-v2.json", "details.scene-v2.json", "details-imperial.scene-v2.json"]) {
    assert.ok(existsSync(new URL(name, dir)), name + " missing");
  }
  const backend = new MockBackend();
  const scheduler = new ManualScheduler();
  const controller = new ViroSpecsSceneController(backend, scheduler);
  const actions = [];
  controller.addOnActionListener((a) => actions.push(a));
  assert.equal(controller.present(read("list.scene-v2.json")).status, "committed");
  scheduler.tick();
  const list = read("list.scene-v2.json");
  const scroller = list.nodes.find((n) => n.kind === "group" && n.scroll).id;
  controller.getNodeHandle(scroller).state.scrollNormalized = [0, 0.5];
  const card = list.interactions.find((i) => i.triggers?.some((t) => t.actionId === "exhibit.open"));
  pinch(backend, scheduler, card.nodeId);
  assert.equal(actions[0].actionId, "exhibit.open");
  assert.equal(typeof actions[0].payload.exhibitId, "string");
  assert.equal(controller.update(read("details.scene-v2.json")).status, "committed");
  assert.equal(controller.update(read("details-imperial.scene-v2.json")).status, "patched");
  assert.equal(controller.update(read("list.scene-v2.json")).status, "committed");
  assert.deepEqual(controller.getNodeState(scroller).scrollNormalized, [0, 0.5]);
});
