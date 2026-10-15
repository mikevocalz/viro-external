// Run with: node --test packages/specs/examples/specs-sample/SpecsSampleLayout.test.ts
// (Node 22.18+ strips the types; the Lens import in the layout is type-only.)
import assert from "node:assert/strict";
import test from "node:test";
import { buildPage, listTopEdgeCm, parseItems, SAMPLE_ITEMS, type SampleState } from "./SpecsSampleLayout.ts";

function state(overrides: Partial<SampleState> = {}): SampleState {
  return {
    tab: "places",
    selected: null,
    items: { places: SAMPLE_ITEMS.places, music: SAMPLE_ITEMS.music },
    status: { places: "sample", music: "sample" },
    ...overrides,
  };
}

test("every target points at a node, and node ids are unique", () => {
  for (const s of [state(), state({ selected: "apollo" }), state({ tab: "music" })]) {
    const { snapshot } = buildPage(s, "sample-logo");
    const ids = snapshot.scene.nodes.map((n) => n.id);
    assert.equal(new Set(ids).size, ids.length);
    for (const t of snapshot.targets) assert.ok(ids.includes(t.targetId), t.targetId);
  }
});

test("parents come before children", () => {
  const { snapshot } = buildPage(state(), null);
  const seen = new Set<string>();
  for (const node of snapshot.scene.nodes) {
    if (node.parentId) assert.ok(seen.has(node.parentId), node.id);
    seen.add(node.id);
  }
});

test("the list scrolls six places in three rows of 13 cm", () => {
  const { snapshot, listContentCm } = buildPage(state(), null);
  const list = snapshot.scene.nodes.find((n) => n.id === "sample-list");
  assert.ok(list?.scroll);
  assert.ok(Math.abs(listContentCm - 39) < 1e-9);
  assert.equal(snapshot.targets.filter((t) => t.action.startsWith("open:")).length, 6);
});

test("the detail page has Back and no list", () => {
  const { snapshot, listContentCm } = buildPage(state({ selected: "apollo" }), null);
  assert.equal(listContentCm, 0);
  assert.ok(snapshot.targets.some((t) => t.action === "back"));
  assert.ok(!snapshot.scene.nodes.some((n) => n.id === "sample-list"));
});

test("scroll top edge matches ScrollWindow's centred content", () => {
  assert.equal(listTopEdgeCm(10), 0);
  assert.equal(listTopEdgeCm(77), -20);
});

test("parseItems drops malformed rows", () => {
  const parsed = parseItems({ places: [{ id: "a", title: "A" }, { id: 2, title: "B" }, null], music: "x" });
  assert.deepEqual(parsed, { places: [{ id: "a", title: "A", sub: "", body: "" }] });
});
