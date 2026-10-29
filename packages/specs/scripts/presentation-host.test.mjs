// ViroSpecsPresentation (the core of ViroSpecsPresentationHost) on the real
// ViroSpecsSceneController and the recording mock backend. Evidence label:
// portable-test-passed. Each test fails against the clear-then-build host
// that destroyed the previous page before building the next one.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ViroSpecsSceneController } from "../build/lens-core/ViroSpecsSceneController.js";
import { ViroSpecsPresentation, toViroSpecsPresentationDocument } from "../build/lens-core/ViroSpecsPresentation.js";
import { ManualScheduler, MockBackend } from "./support/mock-scene-host.mjs";

const setup = () => {
  const backend = new MockBackend();
  backend.images.set("images/header.png", { texture: "header" });
  const scheduler = new ManualScheduler();
  const controller = new ViroSpecsSceneController(backend, scheduler);
  const diagnostics = [];
  controller.diagnostics.addOnDiagnosticListener((d) => diagnostics.push(d));
  const presentation = new ViroSpecsPresentation(controller);
  const actions = [];
  presentation.subscribeAction((action) => actions.push(action));
  return { backend, scheduler, controller, presentation, actions, diagnostics };
};

const page = (tag, extra = []) => ({
  scene: {
    version: 1,
    nodes: [
      { id: `${tag}-root`, kind: "group", position: [0, 0, -1.2] },
      { id: `${tag}-card`, kind: "panel", parentId: `${tag}-root` },
      { id: `${tag}-label`, kind: "text", parentId: `${tag}-root`, text: `page ${tag}` },
      ...extra,
    ],
  },
  targets: [{ targetId: `${tag}-card`, action: `open:${tag}` }],
});

const live = (backend, id) => backend.liveNodes().find((h) => h.id === id);
const enabledRoots = (backend) => backend.liveRoots().filter((r) => r.enabled);
const select = (backend, id) => backend.fire(id, { phase: "select-end", source: "hand-right" });

test("a page that fails to build leaves the previous page on screen with live targets", () => {
  const { backend, scheduler, presentation, actions } = setup();
  presentation.present(page("a"));
  scheduler.tick();
  backend.failOn = (call, id) => call === "createNode" && id === "b-label";

  assert.throws(() => presentation.present(page("b")), /Specs presentation rejected: .*VS5005/);
  assert.ok(live(backend, "a-card"), "page a was destroyed by a failed replacement");
  assert.equal(enabledRoots(backend).length, 1);
  assert.equal(enabledRoots(backend)[0].id.startsWith("root:"), true);
  assert.equal(backend.liveNodes().some((h) => h.id.startsWith("b-")), false, "staged nodes leaked");

  backend.failOn = () => false;
  scheduler.tick();
  select(backend, "a-card");
  scheduler.tick();
  assert.deepEqual(actions, ["open:a"]);
});

test("an invalid page throws before the backend is touched", () => {
  const { backend, scheduler, presentation } = setup();
  presentation.present(page("a"));
  scheduler.tick();
  const before = backend.calls.length;
  const unknownTarget = page("b");
  unknownTarget.targets = [{ targetId: "nowhere", action: "open:b" }];
  assert.throws(() => presentation.present(unknownTarget), /Invalid or duplicate Specs action target: nowhere/);
  const badVector = page("b");
  badVector.scene.nodes[0].position = [0, Number.NaN, -1];
  assert.throws(() => presentation.present(badVector), /Invalid Specs scene: .*position/);
  const empty = page("b");
  empty.scene.nodes = [];
  assert.throws(() => presentation.present(empty), /non-empty version 1 scene/);
  assert.equal(backend.calls.length, before);
  assert.ok(live(backend, "a-card"));
});

test("a slow replacement never leaves zero enabled pages", () => {
  const { backend, scheduler, presentation, controller } = setup();
  let resolve;
  backend.images.set("images/slow.png", () => new Promise((r) => { resolve = r; }));
  presentation.present(page("a"));
  scheduler.tick();

  // Record how many roots are enabled whenever the backend destroys one.
  const destroy = backend.destroy.bind(backend);
  const enabledAtDestroy = [];
  backend.destroy = (handle) => {
    if (handle.kind === "root") enabledAtDestroy.push(enabledRoots(backend).filter((r) => r !== handle).length);
    return destroy(handle);
  };
  presentation.present(page("b", [{ id: "b-image", kind: "image", parentId: "b-root", source: "images/slow.png" }]));

  assert.deepEqual(enabledAtDestroy, [1], "page a was retired before page b was enabled");
  assert.equal(controller.lifecycle, "loading");
  assert.equal(controller.isAssetPending("b-image"), true);
  assert.ok(live(backend, "b-label"), "page b is on screen while its image loads");
  resolve({ texture: "slow" });
  return Promise.resolve().then(() => {
    assert.equal(controller.lifecycle, "ready");
    assert.equal(enabledRoots(backend).length, 1);
  });
});

test("an action selected on a page that is replaced before the next frame is dropped", () => {
  const { backend, scheduler, presentation, actions } = setup();
  presentation.present(page("a"));
  scheduler.tick();
  select(backend, "a-card");
  presentation.present(page("b"));
  scheduler.drain();
  assert.deepEqual(actions, []);

  select(backend, "b-card");
  presentation.clear();
  scheduler.drain();
  assert.deepEqual(actions, []);
  assert.equal(backend.liveNodes().length, 0);
});

test("every listener hears an action, and a throwing listener is reported as VS5009", () => {
  const { backend, scheduler, presentation, actions, diagnostics } = setup();
  presentation.subscribeAction(() => {
    throw new Error("boom");
  });
  const late = [];
  presentation.subscribeAction((action) => {
    late.push(action);
    // Listeners usually present the next page from inside the callback.
    presentation.present(page("b"));
  });
  presentation.present(page("a"));
  scheduler.tick();
  select(backend, "a-card");
  assert.deepEqual(actions, [], "actions must wait for the next frame");
  scheduler.tick();
  assert.deepEqual(actions, ["open:a"]);
  assert.deepEqual(late, ["open:a"]);
  assert.ok(diagnostics.some((d) => d.code === "VS5009" && /boom/.test(d.message)));
  assert.ok(live(backend, "b-card"));
});

test("protocol 1 text style maps to the document style the Lens backend draws", () => {
  const document = toViroSpecsPresentationDocument({
    scene: {
      version: 1,
      nodes: [{ id: "t", kind: "text", text: "Hi", textStyle: { size: 96, color: [0.97, 0.78, 0.15, 1] } }],
    },
    targets: [{ targetId: "t", action: "go" }],
  });
  assert.deepEqual(document.nodes[0].style, { fontSize: 96, color: "#f7c726ff" });
  assert.equal("legacyTextStyle" in document.nodes[0], false);
  assert.deepEqual(document.interactions, [{ nodeId: "t", interactable: true, manipulation: false, events: ["select"] }]);
});

test("the Lens host delegates to the controller instead of clearing and rebuilding", () => {
  const host = readFileSync(new URL("../lens/ViroSpecsPresentationHost.ts", import.meta.url), "utf8");
  assert.doesNotMatch(host, /\.clear\(\);\s*[\s\S]*applyRenderPlan/);
  assert.doesNotMatch(host, /ViroSpecsRuntimeHost|ViroSpecsInteractionHost/);
  assert.match(host, /new ViroSpecsPresentation\(host\)/);
});
