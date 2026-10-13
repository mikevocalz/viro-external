import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { compileSpecsPresentation } from "../dist/index.js";

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
  assert.ok(host.indexOf("renderer.validateSources") < host.indexOf("renderer.clear()"));
});

test("asserts Lens quaternion construction uses the shared Viro XYZW order", () => {
  const source = readFileSync(new URL("../lens/ViroSpecsSceneRuntime.ts", import.meta.url), "utf8");
  assert.match(source, /new quat\(\s*command\.rotation\[3\],\s*command\.rotation\[0\],\s*command\.rotation\[1\],\s*command\.rotation\[2\]/);
});
