// Mock-host suite for ViroSpecsSceneController. Runs the real Lens-side
// controller (compiled by scripts/build-lens-core.mjs) against a recording
// backend. Evidence label: portable-test-passed. No Lens Studio involved.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { ViroSpecsSceneController, diffViroSpecsScenes } from "../build/lens-core/ViroSpecsSceneController.js";
import { VIRO_SPECS_HOST_DIAGNOSTICS } from "../build/lens-core/ViroSpecsHostDiagnostics.js";
import { readViroSpecsSceneInput } from "../build/lens-core/ViroSpecsSceneDocument.js";
import { ManualScheduler, MockBackend } from "./support/mock-scene-host.mjs";

const setup = (options) => {
  const backend = new MockBackend();
  backend.models.set("models/tutor.glb", { prefab: "tutor" });
  backend.images.set("images/logo.png", { texture: "logo" });
  backend.fonts.add("Inter");
  backend.registeredMaterials.set("registry-gold", { borrowed: "gold" });
  const scheduler = new ManualScheduler();
  const controller = new ViroSpecsSceneController(backend, scheduler, options);
  const diagnostics = [];
  controller.diagnostics.addOnDiagnosticListener((d) => diagnostics.push(d));
  return { backend, scheduler, controller, diagnostics };
};

const codes = (ds) => ds.map((d) => d.code);

const lab = () => ({
  version: 2,
  nodes: [
    { id: "panel", kind: "panel", position: [0, 0, -1.2], extents: { width: 0.6, height: 0.4 } },
    {
      id: "title", kind: "text", parentId: "panel", text: "Platform Lab", position: [0, 0.12, 0.01],
      style: { fontFamily: "Inter", fontSize: 24, fontWeight: "bold", color: "#ffcc00", textAlign: "center" },
      extents: { width: 0.5, height: 0.08 }, opacity: 0.9,
    },
    { id: "list", kind: "group", parentId: "panel", scroll: { width: 0.5, height: 0.2, contentHeight: 0.6 } },
    { id: "row-1", kind: "text", parentId: "list", text: "Row 1" },
    { id: "row-2", kind: "text", parentId: "list", text: "Row 2" },
    { id: "logo", kind: "image", parentId: "panel", source: "images/logo.png", extents: { width: 0.1, height: 0.1 } },
    { id: "model", kind: "model", source: "models/tutor.glb", format: "glb", position: [0.3, 0, -1.2], materialId: "brand" },
  ],
  polylines: [{ id: "route", points: [[0, 0, -1], [0.5, 0, -1]], radiusMeters: 0.01, materialId: "registry-gold" }],
  lights: [{ id: "sun", type: "directional", direction: [0, -1, 0], intensity: 1000, color: "#ffffff" }],
  materials: [{ id: "brand", color: "#3366ff", opacity: 0.8 }],
  interactions: [
    { nodeId: "model", interactable: true, manipulation: true, events: ["select", "drag"] },
    { nodeId: "row-1", interactable: true, manipulation: false, events: ["hover", "select"] },
  ],
  animations: [{
    nodeId: "title", name: "pulse",
    plan: { engine: "AnimationPlayer", durationSeconds: 0.5, delaySeconds: 0, easing: "ease-in-out", playbackMode: "single",
      completionEvent: "viro-animation-complete:title:pulse", tracks: [{ target: "transform.scale.x", from: "current", to: 1.1 }] },
  }],
});

const clone = (v) => JSON.parse(JSON.stringify(v));

test("round trip: protocol 2 document renders every field on the mock host", () => {
  const { backend, scheduler, controller, diagnostics } = setup();
  const result = controller.present(lab());
  assert.equal(result.status, "committed");
  assert.deepEqual(codes(result.diagnostics), []);
  assert.deepEqual(codes(diagnostics), []);
  assert.equal(controller.lifecycle, "ready");

  const byId = new Map(backend.liveNodes().map((h) => [h.id, h]));
  assert.deepEqual([...byId.keys()].sort(), ["list", "logo", "model", "panel", "route", "row-1", "row-2", "sun", "title"]);
  assert.equal(byId.get("title").parent.id, "panel");
  assert.equal(byId.get("row-1").parent.id, "list");
  assert.equal(byId.get("panel").parent.id, "root:" + result.revision);
  assert.deepEqual(byId.get("panel").state.transform.position, [0, 0, -1.2]);
  assert.deepEqual(byId.get("panel").state.transform.rotation, [0, 0, 0, 1]);
  const title = byId.get("title").state.text;
  assert.equal(title.text, "Platform Lab");
  assert.equal(title.style.fontSize, 24);
  assert.equal(title.style.color, "#ffcc00");
  assert.equal(title.fontFamily, "Inter");
  assert.deepEqual(title.extents, { width: 0.5, height: 0.08 });
  assert.equal(byId.get("title").state.opacity, 0.9);
  assert.deepEqual(byId.get("panel").state.extents, { width: 0.6, height: 0.4 });
  assert.deepEqual(byId.get("logo").state.asset, { texture: "logo" });
  assert.deepEqual(byId.get("model").state.asset, { prefab: "tutor" });
  assert.equal(byId.get("model").state.material.owned, true);
  assert.equal(byId.get("model").state.material.definition.color, "#3366ff");
  assert.deepEqual(byId.get("route").state.material, { borrowed: "gold" });
  assert.equal(byId.get("sun").state.light.type, "directional");
  assert.deepEqual(byId.get("list").state.scroll, { width: 0.5, height: 0.2, contentHeight: 0.6 });

  // Interactions bind one frame after commit; the animation started at ready.
  assert.equal(backend.bindings.length, 0);
  scheduler.tick();
  assert.deepEqual(backend.bindings.map((b) => b.handle.id).sort(), ["model", "row-1"]);
  assert.equal(backend.animations.length, 1);
  assert.equal(backend.animations[0].handle.id, "title");
});

test("round trip: protocol 1 snapshot from the existing wire still renders", () => {
  const { backend, controller } = setup();
  const result = controller.present({
    version: 1,
    nodes: [
      { id: "root", kind: "group", position: [0, 0, -1] },
      { id: "label", kind: "text", parentId: "root", text: "Hi", textStyle: { size: 40, color: [1, 0, 0, 1] } },
      { id: "m", kind: "model", parentId: "root", source: "models/tutor.glb" },
    ],
  });
  assert.equal(result.status, "committed");
  const label = backend.liveNodes().find((h) => h.id === "label").state.text;
  assert.equal(label.style.lensSize, 40);
  assert.deepEqual(label.style.rgba, [1, 0, 0, 1]);
});

test("the round trip fixture compiled by viro-specs-compile renders without diagnostics", () => {
  const url = new URL("./fixtures/platform-lab.scene-v2.json", import.meta.url);
  // Regenerate from a viro checkout with:
  //   viro-specs-compile --entry examples/specs-platform-lab/SpecsPlatformLab.tsx \
  //     --out <this dir>/fixtures/platform-lab.scene-v2.json --format scene-json --strict
  assert.ok(existsSync(url), "fixture missing");
  const { backend, scheduler, controller } = setup();
  // Asset IDs are the compiler's cwd-relative paths; register the model as a Lens project would.
  for (const node of JSON.parse(readFileSync(url, "utf8")).nodes) {
    if (node.kind === "model") backend.models.set(node.source, { prefab: node.source });
    if (node.kind === "image") backend.images.set(node.source, { texture: node.source });
  }
  const fixture = JSON.parse(readFileSync(url, "utf8"));
  const result = controller.present(fixture);
  assert.equal(result.status, "committed", JSON.stringify(result.diagnostics));
  assert.deepEqual(result.diagnostics.filter((d) => d.severity === "error"), []);
  assert.equal(controller.lifecycle, "ready");
  const ids = backend.liveNodes().map((h) => h.id).sort();
  const expected = [...fixture.nodes.map((n) => n.id), ...(fixture.polylines ?? []).map((p) => p.id), ...(fixture.lights ?? []).map((l) => l.id)].sort();
  assert.deepEqual(ids, expected);
  scheduler.drain();
  assert.equal(backend.bindings.length, (fixture.interactions ?? []).length);
});

test("validation: unsupported protocol is VS5001 and nothing is built", () => {
  const { backend, controller } = setup();
  const result = controller.present({ version: 3, nodes: [] });
  assert.equal(result.status, "rejected");
  assert.deepEqual(codes(result.diagnostics), ["VS5001"]);
  assert.equal(backend.calls.length, 0);
  assert.equal(controller.lifecycle, "error");
});

test("validation: bad fields are VS5002 with JSON pointers, and the committed scene stays", () => {
  const { backend, controller } = setup();
  controller.present(lab());
  const before = backend.calls.length;
  const bad = lab();
  bad.nodes[0].postion = [0, 0, 0];
  bad.nodes[1].opacity = 2;
  bad.nodes[3].parentId = "nowhere";
  bad.interactions[0].nodeId = "ghost";
  const result = controller.present(bad);
  assert.equal(result.status, "rejected");
  const paths = result.diagnostics.map((d) => d.fieldPath);
  assert.ok(paths.includes("/nodes/0/postion"));
  assert.ok(paths.includes("/nodes/1/opacity"));
  assert.ok(paths.includes("/interactions/0/nodeId"));
  assert.ok(result.diagnostics.every((d) => d.code === "VS5002"));
  assert.equal(backend.calls.length, before, "a rejected scene must not touch the backend");
  assert.equal(controller.lifecycle, "ready");
});

test("validation: parent cycles, duplicate IDs across nodes/polylines/lights, video kinds", () => {
  const read = (doc) => readViroSpecsSceneInput(doc, 1);
  const cycle = read({ version: 2, nodes: [{ id: "a", kind: "group", parentId: "b" }, { id: "b", kind: "group", parentId: "a" }] });
  assert.equal(cycle.ok, false);
  assert.ok(cycle.diagnostics.some((d) => /cycle/.test(d.message)));
  const dup = read({ version: 2, nodes: [{ id: "a", kind: "group" }], lights: [{ id: "a", type: "ambient" }] });
  assert.equal(dup.ok, false);
  const video = read({ version: 2, nodes: [{ id: "v", kind: "video", source: "x" }] });
  assert.equal(video.ok, false);
  const childFirst = read({ version: 2, nodes: [{ id: "c", kind: "group", parentId: "p" }, { id: "p", kind: "group" }] });
  assert.equal(childFirst.ok, true);
  assert.deepEqual(childFirst.scene.nodes.map((n) => n.id), ["p", "c"]);
});

test("the host never throws, whatever arrives", () => {
  const { controller } = setup();
  const junk = [undefined, null, 0, "scene", [], {}, { version: 2 }, { version: 2, nodes: {} },
    { version: 2, nodes: [null, 1, "x", { id: 5 }] }, { version: 2, nodes: [{ id: "a", kind: "text", text: 1 }] },
    { version: 1, nodes: [{ id: "a", kind: "group", scroll: { width: -1 } }] }];
  for (const input of junk) {
    assert.doesNotThrow(() => controller.present(input));
    assert.doesNotThrow(() => controller.update(input));
  }
  assert.doesNotThrow(() => controller.applyPatch([{ op: "remove", id: "nope" }]));
});

test("transactional replacement: a staging failure keeps the committed scene and disposes the staging", () => {
  const { backend, controller } = setup();
  const first = controller.present(lab());
  const firstRoot = backend.liveRoots()[0];
  const next = lab();
  next.nodes.push({ id: "boom", kind: "group", parentId: "panel" });
  backend.failOn = (call, id) => call === "createNode" && id === "boom";
  const result = controller.present(next);
  assert.equal(result.status, "rejected");
  assert.deepEqual(codes(result.diagnostics), ["VS5005"]);
  assert.equal(controller.revision, first.revision);
  assert.deepEqual(backend.liveRoots(), [firstRoot]);
  assert.equal(firstRoot.enabled, true);
  // Every node of the failed staging was destroyed with its root.
  const staged = backend.handles.filter((h) => h.kind !== "root" && h.parent && h.parent.id === "root:" + result.revision);
  assert.ok(staged.length > 0 && staged.every((h) => !h.alive));
});

test("transactional replacement: stage invisible, commit, then retire the previous scene", () => {
  const { backend, scheduler, controller } = setup();
  controller.present(lab());
  scheduler.tick();
  const mark = backend.calls.length;
  const result = controller.present(lab());
  const calls = backend.callsSince(mark);
  const newRoot = "root:" + result.revision;
  const disable = calls.findIndex((c) => c.call === "setEnabled" && c.id === newRoot && c.enabled === false);
  const enable = calls.findIndex((c) => c.call === "setEnabled" && c.id === newRoot && c.enabled === true);
  const unbind = calls.findIndex((c) => c.call === "unbind");
  const destroyOld = calls.findIndex((c) => c.call === "destroy" && c.id !== newRoot && c.id.startsWith("root:"));
  assert.ok(disable === 1, "the new root is disabled right after creation");
  assert.ok(enable > disable && enable < destroyOld, "commit before retiring");
  assert.ok(unbind > enable && unbind < destroyOld, "SIK bindings retire before their objects");
  assert.equal(backend.liveRoots().length, 1);
});

test("patch ops: a state change touches only the one node concerned", () => {
  const { backend, scheduler, controller } = setup();
  controller.present(lab());
  scheduler.drain();
  const mark = backend.calls.length;
  const next = lab();
  next.nodes[1].text = "Platform Lab (2)";
  const result = controller.update(next);
  assert.equal(result.status, "patched");
  assert.deepEqual(result.ops, [{ op: "update", node: next.nodes[1] }]);
  const touched = new Set(backend.callsSince(mark).map((c) => c.id));
  assert.deepEqual([...touched], ["title"]);
  assert.deepEqual(backend.callsSince(mark).map((c) => c.call), ["setText"]);
});

test("patch ops: create, update, remove and reparent, explicit and diffed", () => {
  const { backend, scheduler, controller } = setup();
  controller.present(lab());
  scheduler.drain();
  const titleHandle = controller.getNodeHandle("title");
  let result = controller.applyPatch([
    { op: "create", node: { id: "row-3", kind: "text", parentId: "list", text: "Row 3" } },
    { op: "update", node: { id: "row-1", kind: "text", parentId: "list", text: "Row 1!" } },
    { op: "reparent", id: "logo", parentId: "list" },
    { op: "remove", id: "row-2" },
  ]);
  assert.equal(result.status, "patched");
  assert.deepEqual(result.ops.map((o) => o.op).sort(), ["create", "remove", "reparent", "update"]);
  const live = new Map(backend.liveNodes().map((h) => [h.id, h]));
  assert.ok(live.has("row-3") && !live.has("row-2"));
  assert.equal(live.get("logo").parent.id, "list");
  assert.equal(live.get("row-1").state.text.text, "Row 1!");
  assert.equal(controller.getNodeHandle("title"), titleHandle, "untouched nodes keep their SceneObject");

  // Invalid ops are skipped with VS5013; the rest apply.
  result = controller.applyPatch([
    { op: "remove", id: "ghost" },
    { op: "reparent", id: "panel", parentId: "row-1" },
    { op: "update", node: { id: "row-1", kind: "group", parentId: "list" } },
    { op: "create", node: { id: "ok", kind: "group" } },
  ]);
  assert.equal(result.status, "patched");
  assert.deepEqual(codes(result.diagnostics), ["VS5013", "VS5013", "VS5013"]);
  assert.ok(controller.nodeIds.includes("ok"));

  // A kind change is remove + create; a removed parent's surviving child is moved first.
  const doc = lab();
  doc.nodes = doc.nodes.filter((n) => n.id !== "list");
  doc.nodes.find((n) => n.id === "row-1").parentId = "panel";
  doc.nodes = doc.nodes.filter((n) => n.id !== "row-2");
  doc.nodes.find((n) => n.id === "logo").kind = "panel";
  delete doc.nodes.find((n) => n.id === "logo").source;
  result = controller.update(doc);
  assert.equal(result.status, "patched", JSON.stringify(result.diagnostics));
  const after = new Map(backend.liveNodes().map((h) => [h.id, h]));
  assert.equal(after.get("row-1").parent.id, "panel");
  assert.equal(after.get("logo").kind, "panel");
  assert.ok(!after.has("list"));
});

test("diff: removes before creates, kind changes recreate, unchanged nodes produce no op", () => {
  const before = [{ id: "a", kind: "group" }, { id: "b", kind: "text", parentId: "a", text: "x" }, { id: "c", kind: "group" }];
  const after = [{ id: "a", kind: "panel" }, { id: "b", kind: "text", parentId: "a", text: "x" }, { id: "c", kind: "group" }];
  const ops = diffViroSpecsScenes(before, after);
  assert.deepEqual(ops.map((o) => o.op + ":" + (o.id ?? o.node.id)), ["remove:a", "create:a", "create:b"]);
  assert.deepEqual(diffViroSpecsScenes(after, after), []);
});

test("stable nodes keep scroll, selection and focus across updates and navigation", () => {
  const { backend, scheduler, controller } = setup();
  controller.present(lab());
  scheduler.tick();
  controller.getNodeHandle("list").state.scrollNormalized = [0, 0.25];
  backend.fire("row-1", { phase: "hover-enter", source: "hand-right" });
  backend.fire("row-1", { phase: "select-end", source: "hand-right" });
  assert.deepEqual(controller.getNodeState("row-1"), { focused: true, selected: true });

  const next = lab();
  next.nodes[1].text = "changed";
  controller.update(next);
  assert.deepEqual(controller.getNodeState("list").scrollNormalized, [0, 0.25]);
  assert.equal(controller.getNodeState("row-1").selected, true);

  // Navigation to a scene with the same IDs carries the state over.
  controller.present(lab());
  assert.deepEqual(controller.getNodeState("list").scrollNormalized, [0, 0.25]);
  assert.equal(controller.getNodeState("row-1").focused, true);
  assert.equal(controller.getNodeState("row-1").selected, true);

  // A scene without the node clears it.
  const other = lab();
  other.nodes = other.nodes.filter((n) => n.id !== "row-1");
  other.interactions = other.interactions.filter((i) => i.nodeId !== "row-1");
  controller.present(other);
  assert.equal(controller.getNodeState("row-1"), undefined);
  controller.present(lab());
  assert.equal(controller.getNodeState("row-1").selected, false);
});

test("ownership: navigation invalidates queued actions, deferred binding, delayed animations and async assets", async () => {
  const { backend, scheduler, controller, diagnostics } = setup();
  let resolveModel;
  backend.models.set("models/slow.glb", () => new Promise((r) => { resolveModel = r; }));
  const first = lab();
  first.nodes.push({ id: "slow", kind: "model", source: "models/slow.glb" });
  first.animations[0].plan.delaySeconds = 1;
  controller.present(first);
  assert.equal(controller.lifecycle, "loading");
  let ran = 0;
  controller.queueAction(() => ran++);
  const firstHandles = backend.liveNodes();

  controller.present(lab()); // navigate before the next frame
  scheduler.drain();
  assert.equal(ran, 0, "queued action of a retired scene never runs");
  assert.ok(backend.bindings.every((b) => !firstHandles.includes(b.handle)), "deferred SIK binding of a retired scene never runs");
  assert.ok(backend.animations.every((a) => !firstHandles.includes(a.handle)), "delayed animation of a retired scene never plays");

  resolveModel({ prefab: "slow" });
  await new Promise((r) => setImmediate(r));
  const slow = firstHandles.find((h) => h.id === "slow");
  assert.equal(slow.state.asset, undefined, "late asset completion does not touch the retired node");
  assert.ok(diagnostics.some((d) => d.code === "VS5006"));
  // What remains is owned by the live scene: its bindings and its animation.
  const active = backend.bindings.filter((b) => b.active).length + backend.animations.filter((a) => a.active).length;
  assert.equal(controller.pendingWork, active);
});

test("assets: animations start only when every asset has loaded", async () => {
  const { backend, scheduler, controller } = setup();
  let resolve;
  backend.models.set("models/tutor.glb", () => new Promise((r) => { resolve = r; }));
  controller.present(lab());
  scheduler.drain();
  assert.equal(controller.lifecycle, "loading");
  assert.equal(backend.animations.length, 0);
  resolve({ prefab: "tutor" });
  await new Promise((r) => setImmediate(r));
  assert.equal(controller.lifecycle, "ready");
  assert.equal(backend.animations.length, 1);
  assert.deepEqual(controller.getNodeHandle("model").state.asset, { prefab: "tutor" });
});

test("a missing GLB shows a placeholder and a diagnostic, never a dead lens", async () => {
  const { backend, scheduler, controller, diagnostics } = setup();
  backend.models.delete("models/tutor.glb");
  const result = controller.present(lab());
  assert.equal(result.status, "committed");
  const vs5003 = result.diagnostics.find((d) => d.code === "VS5003");
  assert.ok(vs5003, "VS5003 reported");
  assert.equal(vs5003.nodeId, "model");
  assert.match(vs5003.message, /models\/tutor\.glb/);
  assert.deepEqual(controller.getNodeHandle("model").state.placeholder, { width: 0.2, height: 0.2 });
  assert.equal(controller.lifecycle, "degraded");
  scheduler.drain();
  // Everything else still renders and runs.
  assert.equal(controller.getNodeHandle("title").state.text.text, "Platform Lab");
  assert.equal(backend.animations.length, 1);
  assert.equal(backend.bindings.length, 2);
  // A rejected async load also degrades to a placeholder.
  backend.models.set("models/broken.glb", () => Promise.reject(new Error("decode failed")));
  const next = lab();
  next.nodes.push({ id: "broken", kind: "model", source: "models/broken.glb" });
  controller.update(next);
  await new Promise((r) => setImmediate(r));
  assert.ok(diagnostics.some((d) => d.code === "VS5003" && /decode failed/.test(d.message)));
  assert.ok(controller.getNodeHandle("broken").state.placeholder);
  // No placeholder material: VS5011 on top, still committed.
  const bare = setup();
  bare.backend.placeholderAvailable = false;
  bare.backend.models.delete("models/tutor.glb");
  const bareResult = bare.controller.present(lab());
  assert.equal(bareResult.status, "committed");
  assert.deepEqual(codes(bareResult.diagnostics).sort(), ["VS5003", "VS5011"]);
});

test("interaction: all seven phases, four sources, normal and direction pass through", () => {
  const { backend, scheduler, controller } = setup();
  controller.present(lab());
  scheduler.tick();
  const events = [];
  controller.addOnInteractionListener((e) => events.push(e));
  const phases = ["hover-enter", "hover-move", "hover-exit", "select-start", "select-end", "drag", "cancel"];
  const sources = ["hand-left", "hand-right", "gaze", "synthetic"];
  phases.forEach((phase, i) =>
    backend.fire("model", { phase, source: sources[i % 4], position: [0.3, 0, -1.2], normal: [0, 0, 1], direction: [0, 0, -1] })
  );
  controller.dispatchInteraction({ nodeId: "row-1", phase: "select-end", source: "gaze" });
  assert.deepEqual(events.map((e) => e.phase), [...phases, "select-end"]);
  assert.deepEqual(new Set(events.map((e) => e.source)), new Set(sources));
  assert.deepEqual(events[0].normal, [0, 0, 1]);
  assert.deepEqual(events[0].direction, [0, 0, -1]);
  assert.ok(events.every((e) => e.sceneRevision === controller.revision && typeof e.timestampMs === "number"));
});

test("interaction: events from retired nodes are dropped; a throwing listener is VS5009 and others still run", () => {
  const { backend, scheduler, controller, diagnostics } = setup();
  controller.present(lab());
  scheduler.tick();
  const binding = backend.bindings.find((b) => b.handle.id === "model");
  const seen = [];
  controller.addOnInteractionListener(() => { throw new Error("app bug"); });
  controller.addOnInteractionListener((e) => seen.push(e.phase));
  backend.fire("model", { phase: "select-start", source: "hand-left" });
  assert.deepEqual(seen, ["select-start"]);
  assert.ok(diagnostics.some((d) => d.code === "VS5009" && /app bug/.test(d.message)));
  controller.present(lab());
  binding.emit({ phase: "select-end", source: "hand-left" }); // stale emit from SIK after retirement
  assert.deepEqual(seen, ["select-start"]);
});

test("interaction: drag listeners get the position the drag constraint returns; a throwing constraint is VS5014", () => {
  const { backend, scheduler, controller, diagnostics } = setup();
  controller.present(lab());
  scheduler.tick();
  const seen = [];
  controller.addOnInteractionListener((e) => seen.push([e.phase, e.position]));
  const asked = [];
  controller.setDragConstraint((nodeId, position) => {
    asked.push([nodeId, position]);
    return [position[0], position[1], -3];
  });
  backend.fire("model", { phase: "drag", source: "hand-right", position: [0.1, 0, -4.5] });
  backend.fire("model", { phase: "select-start", source: "hand-right", position: [0.1, 0, -4.5] });
  assert.deepEqual(asked, [["model", [0.1, 0, -4.5]]], "only drags with a position are constrained");
  assert.deepEqual(seen, [["drag", [0.1, 0, -3]], ["select-start", [0.1, 0, -4.5]]]);
  controller.setDragConstraint(() => { throw new Error("clamp bug"); });
  backend.fire("model", { phase: "drag", source: "hand-right", position: [0, 0, -2] });
  assert.deepEqual(seen.at(-1), ["drag", [0, 0, -2]]);
  assert.ok(diagnostics.some((d) => d.code === "VS5014" && /clamp bug/.test(d.message)));
  controller.setDragConstraint(undefined);
  backend.fire("model", { phase: "drag", source: "hand-right", position: [0, 0, -5] });
  assert.deepEqual(seen.at(-1), ["drag", [0, 0, -5]]);
});

test("resources: owned materials are shared, bounded and disposed once; borrowed ones never", () => {
  const { backend, controller } = setup({ maxCachedMaterials: 1 });
  const doc = (color) => {
    const d = lab();
    d.materials = [{ id: "brand", color }];
    d.nodes.push({ id: "model-2", kind: "model", source: "models/tutor.glb", materialId: "brand" });
    return d;
  };
  controller.present(doc("#000001"));
  assert.equal(backend.createdMaterials.length, 1, "two nodes share one owned material");
  controller.present(doc("#000002"));
  controller.present(doc("#000003"));
  controller.present(doc("#000001"));
  assert.ok(controller.cachedMaterialCount <= 2, "one held plus at most one idle");
  const disposedKeys = backend.disposedMaterials.map((m) => m.key);
  assert.equal(new Set(disposedKeys).size, disposedKeys.length, "nothing disposed twice");
  assert.ok(backend.disposedMaterials.every((m) => m.owned), "borrowed materials are never disposed");
  controller.update(doc("#000009"));
  assert.equal(controller.getNodeHandle("model").state.material.definition.color, "#000009");
  assert.equal(controller.getNodeHandle("model-2").state.material.definition.color, "#000009");
  controller.dispose();
  controller.dispose();
  const all = backend.disposedMaterials.map((m) => m.key);
  assert.equal(new Set(all).size, all.length, "dispose is idempotent");
  assert.equal(new Set(all).size, backend.createdMaterials.length, "every owned material is disposed exactly once");
  assert.equal(backend.liveNodes().length, 0);
  assert.equal(controller.present(lab()).status, "rejected", "a disposed controller rejects without throwing");
});

test("diagnostics: text and material approximations each have a code", () => {
  const { controller } = setup();
  const doc = lab();
  doc.nodes[1].style.fontFamily = "Unregistered";
  doc.nodes[1].maxLines = 2;
  doc.materials[0].lightingModel = "phong";
  doc.nodes.push({ id: "m2", kind: "model", source: "models/tutor.glb", materialId: "not-registered" });
  const result = controller.present(doc);
  assert.equal(result.status, "committed");
  assert.deepEqual(codes(result.diagnostics).sort(), ["VS5004", "VS5007", "VS5008", "VS5012"]);
});

test("100 navigation/update cycles leave no leaked nodes, work or listeners", () => {
  const { backend, scheduler, controller, diagnostics } = setup({ maxCachedMaterials: 4 });
  const pages = [0, 1, 2, 3].map((p) => {
    const d = lab();
    d.materials = [{ id: "brand", color: "#00000" + p }];
    d.nodes.push({ id: "page-" + p, kind: "text", text: "Page " + p });
    return d;
  });
  let ran = 0;
  for (let cycle = 0; cycle < 100; cycle++) {
    const page = pages[cycle % 4];
    const action = cycle % 3;
    if (action === 0) assert.equal(controller.present(page).status, "committed");
    else {
      const next = clone(page);
      next.nodes[1].text = "cycle " + cycle;
      next.nodes[3].text = "row " + cycle;
      if (cycle % 2) next.nodes.push({ id: "extra", kind: "group", parentId: "panel" });
      const result = controller.update(next);
      assert.ok(result.status === "patched" || result.status === "committed");
    }
    controller.queueAction(() => ran++);
    if (cycle % 5 === 0 && backend.bindings.some((b) => b.active && b.handle.id === "model")) {
      backend.fire("model", { phase: "drag", source: "hand-right", position: [0, 0, -1] });
    }
    if (cycle % 2 === 0) scheduler.tick();
    const live = backend.liveNodes();
    const expected = controller.nodeIds.length + 2; // + polyline + light
    assert.equal(live.length, expected, "cycle " + cycle + ": live handles match the committed scene");
    assert.equal(backend.liveRoots().length, 1);
    assert.ok(new Set(live.map((h) => h.id)).size === live.length, "no duplicate live nodes");
    assert.ok(backend.bindings.filter((b) => b.active).length <= 2, "at most one binding per interactable");
    assert.ok(controller.cachedMaterialCount <= 5);
  }
  scheduler.drain();
  assert.ok(ran > 0);
  assert.equal(scheduler.queued, 0);
  assert.equal(controller.pendingWork, backend.animations.filter((a) => a.active).length + backend.bindings.filter((b) => b.active).length);
  assert.ok(diagnostics.every((d) => d.severity !== "error"), JSON.stringify(diagnostics.filter((d) => d.severity === "error")));
  controller.dispose();
  assert.equal(backend.liveNodes().length, 0);
  assert.equal(backend.liveRoots().length, 0);
  assert.equal(backend.bindings.filter((b) => b.active).length, 0);
  assert.equal(backend.animations.filter((a) => a.active).length, 0);
  const created = backend.createdMaterials.length;
  assert.equal(new Set(backend.disposedMaterials.map((m) => m.key)).size, created);
});

test("every host diagnostic code is documented, and the doc names no other code", () => {
  const doc = readFileSync(new URL("../doc/LensHostDiagnostics.md", import.meta.url), "utf8");
  const documented = new Set([...doc.matchAll(/^### (VS5\d{3}) · (error|warning|info)$/gm)].map((m) => m[1] + ":" + m[2]));
  const catalog = new Set(Object.entries(VIRO_SPECS_HOST_DIAGNOSTICS).map(([code, d]) => code + ":" + d.severity));
  assert.deepEqual([...documented].sort(), [...catalog].sort());
  const mentioned = new Set([...doc.matchAll(/VS5\d{3}/g)].map((m) => m[0]));
  for (const code of mentioned) assert.ok(code in VIRO_SPECS_HOST_DIAGNOSTICS, code + " is not in the catalog");
});
