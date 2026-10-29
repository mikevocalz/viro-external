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

test("rejects empty scenes before anything on screen changes", () => {
  const empty = base();
  empty.scene.nodes = [];
  assert.throws(() => compileSpecsPresentation(empty), /non-empty/);
  // Raw wire pages bypass the portable compiler; the Lens presentation reads
  // them with the controller's reader before anything on screen changes.
  // Behavior is covered on the mock host in presentation-host.test.mjs.
  const core = readFileSync(new URL("../lens/ViroSpecsPresentation.ts", import.meta.url), "utf8");
  assert.match(core, /nodes\.length === 0/);
  assert.ok(core.indexOf("readViroSpecsSceneInput(scene, 0)") < core.indexOf("this.scene.present(document)"));
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
});

const scrollPage = () => ({
  scene: scene([
    { id: "list", kind: "group", position: [0, 0, -1], scroll: { width: 0.3, height: 0.2, contentHeight: 0.6 } },
    { id: "row-0", kind: "panel", parentId: "list", position: [0, -0.05, 0] },
    { id: "row-0-label", kind: "text", parentId: "list", position: [0, -0.05, 0.01], text: "Apollo Theater" },
  ]),
  targets: [{ targetId: "row-0", action: "place:apollo-theater" }],
});

test("carries a validated scroll window to the Lens content command", () => {
  const compiled = compileSpecsPresentation(scrollPage());
  assert.deepEqual(compiled.scene.nodes[0].scroll, { width: 0.3, height: 0.2, contentHeight: 0.6 });
  assert.deepEqual(JSON.parse(JSON.stringify(compiled)), compiled);
  const plan = compileSpecsRenderPlan(compiled.scene.nodes);
  const content = plan.commands.find((c) => c.op === "content" && c.id === "list");
  assert.deepEqual(content.scroll, { width: 0.3, height: 0.2, contentHeight: 0.6 });
  // Content shorter than the window is still valid; it just does not scroll.
  const short = scrollPage();
  short.scene.nodes[0].scroll.contentHeight = 0;
  assert.equal(compileSpecsPresentation(short).scene.nodes[0].scroll.contentHeight, 0);
  // Extra fields on scroll are dropped at the boundary.
  const extra = scrollPage();
  extra.scene.nodes[0].scroll.horizontal = true;
  assert.equal("horizontal" in compileSpecsPresentation(extra).scene.nodes[0].scroll, false);
});

test("rejects scroll on non-groups and non-finite or out-of-range sizes", () => {
  const onPanel = scrollPage();
  onPanel.scene.nodes[1].scroll = { width: 0.3, height: 0.2, contentHeight: 0.6 };
  assert.throws(() => compileSpecsPresentation(onPanel), /scroll is only valid on group nodes/);
  for (const bad of [
    { width: NaN, height: 0.2, contentHeight: 0.6 },
    { width: 0.3, height: Infinity, contentHeight: 0.6 },
    { width: 0, height: 0.2, contentHeight: 0.6 },
    { width: 0.3, height: 10.5, contentHeight: 0.6 },
    { width: 0.3, height: 0.2, contentHeight: -0.1 },
    { width: 0.3, height: 0.2 },
    "tall",
    null,
  ]) {
    const page = scrollPage();
    page.scene.nodes[0].scroll = bad;
    assert.throws(() => compileSpecsPresentation(page), /scroll/, JSON.stringify(bad));
  }
});

test("Lens runtime puts scroll content in a UI Kit ScrollWindow", () => {
  const protocol = readFileSync(new URL("../lens/ViroSpecsProtocol.ts", import.meta.url), "utf8");
  assert.match(protocol, /scroll\?: ViroSpecsScroll/);
  assert.match(protocol, /node\.scroll \? \{ scroll: node\.scroll \}/);

  const runtime = readFileSync(new URL("../lens/ViroSpecsSceneRuntime.ts", import.meta.url), "utf8");
  assert.match(runtime, /import \{ ScrollWindow \} from "\.\/ViroSpecsUIKit"/);
  const seam = readFileSync(new URL("../lens/ViroSpecsUIKit.ts", import.meta.url), "utf8");
  assert.match(seam, /from "SpectaclesUIKit\.lspkg\/Scripts\/Components\/ScrollWindow\/ScrollWindow"/);
  assert.match(runtime, /createComponent\(ScrollWindow\.getTypeName\(\)\)/);
  assert.match(runtime, /\.vertical = true;/);
  assert.match(runtime, /\.horizontal = false;/);
  assert.match(runtime, /windowSize = new vec2\(width, height\)/);
  assert.match(runtime, /Math\.max\(height, scroll\.contentHeight \* 100\)/);
  assert.match(runtime, /scrollPositionNormalized = new vec2\(0, 1\)/);
  // Content goes through addObject, and later children parent to the content anchor.
  assert.match(runtime, /\.addObject\(content\)/);
  assert.match(runtime, /parentRecord\.contentParent \?\? parentRecord\.object/);
  // The ScrollWindow lives under the node's SceneObject, so clearing the page destroys it.
  assert.match(runtime, /scrollObject\.setParent\(record\.object\)/);
});

test("initializes runtime ScrollWindows and declares the UI Kit dependency", () => {
  const runtime = readFileSync(new URL("../lens/ViroSpecsSceneRuntime.ts", import.meta.url), "utf8");
  const created = runtime.indexOf("createComponent(ScrollWindow.getTypeName())");
  const init = runtime.indexOf("scrollWindow.initialize();");
  assert.ok(created > 0 && init > created && init < runtime.indexOf("scrollWindow.addObject(content)"));
  // specs:sync and specs:doctor take the required package list from lens-runtime.json.
  const manifest = JSON.parse(readFileSync(new URL("../lens-runtime.json", import.meta.url), "utf8"));
  assert.deepEqual(manifest.lineSeams["ViroSpecsUIKit.ts"]["2"], { package: "SpectaclesUIKit.lspkg", minVersion: "2.0.0" });
  assert.deepEqual(manifest.lineSeams["ViroSpecsUIKit.ts"]["4"], { package: "UIKit.lspkg", minVersion: "4.0.0" });
});

test("registers runtime textures without mutating Inspector arrays", () => {
  const registry = readFileSync(new URL("../lens/ViroSpecsAssetRegistry.ts", import.meta.url), "utf8");
  assert.match(registry, /registerImage\(id: string, texture: Texture\): void/);
  assert.match(registry, /const ids = this\.imageIds\.slice\(\)/);
  assert.match(registry, /this\.imageIds = ids;\s*this\.imageTextures = textures;/);
  assert.doesNotMatch(registry, /this\.imageIds\.push\(/);
});

test("the protocol 1 runtime host validates like the controller", () => {
  const runtimeHost = readFileSync(new URL("../lens/ViroSpecsRuntimeHost.ts", import.meta.url), "utf8");
  const apply = runtimeHost.slice(runtimeHost.indexOf("applySceneSnapshot(scene"));
  assert.ok(apply.indexOf("readViroSpecsSceneInput(scene, 0)") < apply.indexOf("this.applyRenderPlan"));
  assert.match(apply, /read\.scene\.protocol !== 1/);
});
