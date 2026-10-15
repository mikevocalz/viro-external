import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { compileSpecsPresentation, compileSpecsRenderPlan } from "../dist/index.js";

const scene = (nodes) => ({ version: 1, nodes });
const base = () => ({
  scene: scene([
    { id: "harlem", kind: "group", position: [0, -0.08, -1.1] },
    { id: "place-card", kind: "panel", parentId: "harlem" },
    { id: "place-label", kind: "text", parentId: "harlem", text: "Apollo Theater" },
    { id: "go", kind: "group", parentId: "harlem" },
    { id: "go-label", kind: "text", parentId: "go", text: "Directions" },
  ]),
  targets: [{ targetId: "go", action: "directions:apollo-theater" }],
});

test("keeps a serializable Lens scene and only binds existing interaction nodes", () => {
  const result = compileSpecsPresentation(base());
  assert.equal(result.scene.version, 1);
  assert.equal(result.targets[0].action, "directions:apollo-theater");
  assert.deepEqual(JSON.parse(JSON.stringify(result)), result);
});

test("rejects missing, child-first and cyclic parents before replacing a live scene", () => {
  const missing = base();
  missing.scene.nodes[1].parentId = "absent";
  assert.throws(() => compileSpecsPresentation(missing), /must follow its existing parent/);
  const first = base();
  first.scene.nodes.reverse();
  assert.throws(() => compileSpecsPresentation(first), /must follow its existing parent/);
  const cycle = base();
  cycle.scene.nodes[0].parentId = "go";
  assert.throws(() => compileSpecsPresentation(cycle), /must follow its existing parent/);
});

test("rejects duplicate nodes, action bindings, and non-finite transforms", () => {
  const duplicate = base();
  duplicate.scene.nodes.push({ id: "go", kind: "text", text: "Again" });
  assert.throws(() => compileSpecsPresentation(duplicate), /Duplicate portable/);
  const twice = base();
  twice.targets.push({ targetId: "go", action: "back" });
  assert.throws(() => compileSpecsPresentation(twice), /duplicated/);
  const missingAction = base();
  missingAction.targets[0].targetId = "not-in-scene";
  assert.throws(() => compileSpecsPresentation(missingAction), /does not exist/);
  const nan = base();
  nan.scene.nodes[0].position = [0, NaN, -1];
  assert.throws(() => compileSpecsPresentation(nan), /Invalid position/);
});

test("strips extra properties that would break JSON scene serialization", () => {
  const fixture = base();
  const extra = { circular: null };
  extra.circular = extra;
  fixture.scene.nodes[0].untrusted = extra;
  fixture.scene.nodes[1].onTap = () => undefined;
  const compiled = compileSpecsPresentation(fixture);
  assert.deepEqual(JSON.parse(JSON.stringify(compiled)), compiled);
  assert.equal("untrusted" in compiled.scene.nodes[0], false);
  assert.equal("onTap" in compiled.scene.nodes[1], false);
  const wrong = base();
  wrong.scene.nodes[2].text = 123;
  assert.throws(() => compileSpecsPresentation(wrong), /text is only valid/);
});

test("preflights empty scenes and assets before clearing the Lens frame", () => {
  const empty = base();
  empty.scene.nodes = [];
  assert.throws(() => compileSpecsPresentation(empty), /non-empty/);
  const host = readFileSync(new URL("../lens/ViroSpecsPresentationHost.ts", import.meta.url), "utf8");
  assert.match(host, /nodes.length === 0/);
  const validate = host.indexOf("renderer.validateSources");
  assert.ok(validate < host.indexOf("interactions.resetTargets()"));
  assert.ok(validate < host.indexOf("renderer.clear()"));
  // Raw wire payloads bypass the portable compiler, so the host repeats the
  // checks that would otherwise throw after the page is cleared.
  for (const check of [/text is only valid on text nodes/, /source is only valid on image\/model/,
    /assertVector\(node\.rotation, 4/, /assertVector\(node\.position, 3/]) {
    assert.match(host, check);
  }
  assert.match(host, /emitDeferred\(action\)/);
  // Targets bind a frame later, and a newer page or clear() cancels the bind.
  assert.match(host, /if \(generation !== this\.generation\) return;/);
  assert.match(host, /clear\(\): void \{\s*this\.generation\+\+;/);
  // A failed render must not leave an older page's bind live.
  assert.ok(host.indexOf("++this.generation") < host.indexOf("renderer.clear();\n    this.actions.clear();\n    try"));
  assert.match(host, /value < 0 \|\| value > 1/);
});

test("passes portable [x, y, z, w] rotation through unchanged", () => {
  const fixture = base();
  const half = Math.PI / 8;
  const yaw45 = [0, Math.sin(half), 0, Math.cos(half)];
  fixture.scene.nodes[0].rotation = yaw45;
  assert.deepEqual(compileSpecsPresentation(fixture).scene.nodes[0].rotation, yaw45);
  const short = base();
  short.scene.nodes[0].rotation = [0, 0, 1];
  assert.throws(() => compileSpecsPresentation(short), /rotation/i);
});

test("asserts Lens quaternion construction uses the shared Viro XYZW order", () => {
  const source = readFileSync(new URL("../lens/ViroSpecsSceneRuntime.ts", import.meta.url), "utf8");
  assert.match(source, /new quat\(\s*command\.rotation\[3\],\s*command\.rotation\[0\],\s*command\.rotation\[1\],\s*command\.rotation\[2\]/);
});

test("carries validated text style to the Lens content command", () => {
  const fixture = base();
  fixture.scene.nodes[2].textStyle = { size: 96, color: [0.97, 0.78, 0.15, 1] };
  const compiled = compileSpecsPresentation(fixture);
  assert.deepEqual(compiled.scene.nodes[2].textStyle, { size: 96, color: [0.97, 0.78, 0.15, 1] });
  const plan = compileSpecsRenderPlan(compiled.scene.nodes);
  const content = plan.commands.find((c) => c.op === "content" && c.id === "place-label");
  assert.deepEqual(content.textStyle, { size: 96, color: [0.97, 0.78, 0.15, 1] });

  const onPanel = base();
  onPanel.scene.nodes[1].textStyle = { size: 40 };
  assert.throws(() => compileSpecsPresentation(onPanel), /only valid on text nodes/);
  const badColor = base();
  badColor.scene.nodes[2].textStyle = { color: [1, 1, 2, 1] };
  assert.throws(() => compileSpecsPresentation(badColor), /textStyle.color/);
  const badSize = base();
  badSize.scene.nodes[2].textStyle = { size: -4 };
  assert.throws(() => compileSpecsPresentation(badSize), /textStyle.size/);

  const runtime = readFileSync(new URL("../lens/ViroSpecsSceneRuntime.ts", import.meta.url), "utf8");
  assert.match(runtime, /record\.text\.size = command\.textStyle\.size/);
  const host = readFileSync(new URL("../lens/ViroSpecsPresentationHost.ts", import.meta.url), "utf8");
  assert.match(host, /textStyle is only valid on text nodes/);
  assert.match(host, /createComponent\("Component\.Canvas"\)/);
});
