// Mock-host suite for typed actions (WS3b). Runs the real Lens-side
// controller, registry, runtime and reference flow (compiled by
// scripts/build-lens-core.mjs) against the recording backend.
// Evidence label: portable-test-passed. No Lens Studio involved.
import test from "node:test";
import assert from "node:assert/strict";
import { ViroSpecsSceneController } from "../build/lens-core/ViroSpecsSceneController.js";
import { ViroSpecsActionRegistry, ViroSpecsActionRuntime } from "../build/lens-core/ViroSpecsActionRuntime.js";
import { checkViroSpecsActionPayload } from "../build/lens-core/ViroSpecsActionContract.js";
import {
  VIRO_SPECS_REFERENCE_ACTIONS,
  VIRO_SPECS_REFERENCE_INITIAL_STATE,
  createViroSpecsReferenceRegistry,
  viewViroSpecsReferenceFlow,
} from "../build/lens-core/ViroSpecsReferenceFlow.js";
import { ManualScheduler, MockBackend } from "./support/mock-scene-host.mjs";

const codes = (ds) => ds.map((d) => d.code);

function setup(controllerOptions = {}, runtimeOptions = {}) {
  const backend = new MockBackend();
  const scheduler = new ManualScheduler();
  const controller = new ViroSpecsSceneController(backend, scheduler, controllerOptions);
  const diagnostics = [];
  controller.diagnostics.addOnDiagnosticListener((d) => diagnostics.push(d));
  const registry = createViroSpecsReferenceRegistry(controller.diagnostics);
  const runtime = new ViroSpecsActionRuntime(controller, {
    initialState: VIRO_SPECS_REFERENCE_INITIAL_STATE,
    view: viewViroSpecsReferenceFlow,
    registry,
    diagnostics: controller.diagnostics,
    nowMs: () => scheduler.nowMs(),
    ...runtimeOptions,
  });
  return { backend, scheduler, controller, diagnostics, registry, runtime };
}

/** Pinch on a node: hover, then select, then the frame that delivers the action. */
function pinch(backend, scheduler, nodeId, source = "hand-right") {
  backend.fire(nodeId, { phase: "hover-enter", source });
  backend.fire(nodeId, { phase: "select-start", source });
  backend.fire(nodeId, { phase: "select-end", source });
  scheduler.tick();
}

const text = (backend, id) => backend.liveNodes().find((h) => h.id === id)?.state.text?.text;

test("reference flow: select card -> details -> change setting -> update -> back with scroll position kept", () => {
  const { backend, scheduler, controller, diagnostics, runtime } = setup();
  const started = runtime.start();
  assert.equal(started.status, "committed");
  assert.equal(controller.route, "list");
  scheduler.tick(); // SIK binds one frame after commit

  // The wearer scrolls the list, then pinches the fourth card.
  controller.getNodeHandle("exhibit-list").state.scrollNormalized = [0, 0.4];
  const actions = [];
  controller.addOnActionListener((a) => actions.push(a));
  pinch(backend, scheduler, "card-planetarium");
  assert.deepEqual(actions.map((a) => [a.actionId, a.payload, a.nodeId, a.on, a.source]), [
    ["exhibit.open", { exhibitId: "planetarium" }, "card-planetarium", "select", "hand-right"],
  ]);
  assert.equal(runtime.state.route, "details");
  assert.equal(runtime.state.selectedId, "planetarium");
  assert.equal(controller.route, "details");
  assert.equal(text(backend, "details-title"), "Planetarium");
  assert.equal(text(backend, "details-distance"), "120 m away");
  assert.equal(controller.getNodeHandle("exhibit-list"), null);
  assert.deepEqual(controller.rememberedRoutes, ["list"]);

  // Change a setting on the details route: a patch, not a navigation.
  scheduler.tick();
  const revisionBefore = controller.revision;
  const mark = backend.calls.length;
  const detailsRoot = backend.liveRoots()[0];
  pinch(backend, scheduler, "units-toggle");
  assert.equal(runtime.state.units, "imperial");
  assert.equal(text(backend, "details-distance"), "394 ft away");
  assert.equal(text(backend, "units-toggle-label"), "Show meters");
  assert.equal(backend.liveRoots()[0], detailsRoot, "same scene root: patched in place");
  assert.ok(controller.revision > revisionBefore);
  const touched = new Set(backend.callsSince(mark).filter((c) => c.call !== "unbind" && c.call !== "bindInteraction").map((c) => c.id));
  assert.deepEqual([...touched].sort(), ["details-distance", "units-toggle-label"]);
  assert.equal(backend.callsSince(mark).filter((c) => c.call === "bindInteraction" || c.call === "unbind").length, 0,
    "a changed trigger payload does not rebind SIK");

  // Back to the list: the scroll position the wearer left is restored, and the card is highlighted.
  scheduler.tick();
  pinch(backend, scheduler, "back-button");
  assert.equal(runtime.state.route, "list");
  assert.equal(controller.route, "list");
  assert.deepEqual(controller.getNodeState("exhibit-list").scrollNormalized, [0, 0.4]);
  assert.equal(controller.getNodeHandle("card-planetarium").state.material.definition.id, "card-selected");
  assert.equal(controller.getNodeHandle("card-orrery").state.material.definition.id, "card");
  assert.deepEqual(diagnostics.filter((d) => d.severity !== "info"), []);
});

test("lifetimes: an action queued when navigation happens is dropped with VS5018 and never reduced", () => {
  const { backend, scheduler, controller, diagnostics, runtime } = setup();
  runtime.start();
  scheduler.tick();
  const reduced = [];
  runtime.addOnStateListener((s) => reduced.push(s.route));
  // Pinch lands; before the next frame app code navigates to details.
  backend.fire("card-orrery", { phase: "select-end", source: "hand-left" });
  runtime.dispatch("exhibit.open", { exhibitId: "tesla-coil" });
  assert.equal(runtime.state.selectedId, "tesla-coil");
  scheduler.tick();
  assert.equal(runtime.state.selectedId, "tesla-coil", "the orrery pinch belonged to the retired list scene");
  assert.deepEqual(reduced, ["details"]);
  const dropped = diagnostics.filter((d) => d.code === "VS5018");
  assert.equal(dropped.length, 1);
  assert.equal(dropped[0].nodeId, "card-orrery");
  assert.equal(controller.pendingWork, backend.bindings.filter((b) => b.active).length);
});

test("lifetimes: a patch keeps queued actions; only retirement drops them", () => {
  const { backend, scheduler, controller, runtime } = setup();
  runtime.start();
  scheduler.tick();
  backend.fire("card-orrery", { phase: "select-end", source: "hand-right" });
  // Same-route update between pinch and delivery (for example a hover highlight).
  controller.update(viewViroSpecsReferenceFlow({ ...runtime.state, selectedId: "pendulum" }));
  scheduler.tick();
  assert.equal(runtime.state.selectedId, "orrery");
  assert.equal(runtime.state.route, "details");
});

test("hover triggers fire on hover-enter and hover-exit only", () => {
  const backend = new MockBackend();
  const scheduler = new ManualScheduler();
  const controller = new ViroSpecsSceneController(backend, scheduler);
  const actions = [];
  controller.addOnActionListener((a) => actions.push(a.on + ":" + a.actionId));
  const result = controller.present({
    version: 2,
    actions: [{ id: "tip.show" }, { id: "tip.hide" }],
    nodes: [{ id: "b", kind: "panel", extents: { width: 0.1, height: 0.1 } }],
    interactions: [{ nodeId: "b", interactable: true, manipulation: false, events: ["hover"],
      triggers: [{ on: "hover-enter", actionId: "tip.show" }, { on: "hover-exit", actionId: "tip.hide" }] }],
  });
  assert.equal(result.status, "committed");
  scheduler.tick();
  for (const phase of ["hover-enter", "hover-move", "select-start", "select-end", "cancel", "hover-exit"]) backend.fire("b", { phase, source: "gaze" });
  scheduler.tick();
  assert.deepEqual(actions, ["hover-enter:tip.show", "hover-exit:tip.hide"]);
});

test("scene validation: unknown, duplicate and ill-typed actions reject the scene with VS5015, VS5016, VS5017", () => {
  const base = () => ({
    version: 2,
    actions: [{ id: "item.pick", payload: { itemId: { type: "string" }, count: { type: "integer", optional: true } } }],
    nodes: [{ id: "n", kind: "panel", extents: { width: 0.1, height: 0.1 } }],
    interactions: [{ nodeId: "n", interactable: true, manipulation: false, events: ["select"],
      triggers: [{ on: "select", actionId: "item.pick", payload: { itemId: "a" } }] }],
  });
  const run = (mutate) => {
    const doc = base();
    mutate(doc);
    const backend = new MockBackend();
    const controller = new ViroSpecsSceneController(backend, new ManualScheduler());
    const result = controller.present(doc);
    return { result, backend };
  };
  assert.equal(run(() => undefined).result.status, "committed");

  const unknown = run((d) => { d.interactions[0].triggers[0].actionId = "item.drop"; });
  assert.equal(unknown.result.status, "rejected");
  assert.deepEqual(codes(unknown.result.diagnostics), ["VS5015"]);
  assert.equal(unknown.result.diagnostics[0].fieldPath, "/interactions/0/triggers/0/actionId");
  assert.equal(unknown.backend.liveNodes().length, 0);

  const duplicate = run((d) => { d.actions.push({ id: "item.pick" }); });
  assert.deepEqual(codes(duplicate.result.diagnostics), ["VS5016"]);

  const missing = run((d) => { d.interactions[0].triggers[0].payload = {}; });
  assert.deepEqual(missing.result.diagnostics.map((x) => x.code + " " + x.fieldPath), ["VS5017 /interactions/0/triggers/0/payload/itemId"]);
  const wrongType = run((d) => { d.interactions[0].triggers[0].payload = { itemId: 3, count: 1.5, extra: true }; });
  assert.deepEqual(wrongType.result.diagnostics.map((x) => x.code + " " + x.fieldPath).sort(), [
    "VS5017 /interactions/0/triggers/0/payload/count",
    "VS5017 /interactions/0/triggers/0/payload/extra",
    "VS5017 /interactions/0/triggers/0/payload/itemId",
  ]);

  const eventOff = run((d) => { d.interactions[0].triggers[0].on = "hover-enter"; });
  assert.deepEqual(eventOff.result.diagnostics.map((x) => x.code + " " + x.fieldPath), ["VS5002 /interactions/0/triggers/0/on"]);
  const badId = run((d) => { d.actions[0].id = "Item Pick"; });
  assert.ok(codes(badId.result.diagnostics).includes("VS5002"));
  const closure = run((d) => { d.interactions[0].triggers[0].payload = { itemId: "a", onPick: {} }; });
  assert.deepEqual(codes(closure.result.diagnostics), ["VS5017"]);
});

test("payload checks: enum, integer, boolean, optional", () => {
  const decl = { id: "a.b", payload: { mode: { type: "string", enum: ["x", "y"] }, n: { type: "integer" }, on: { type: "boolean", optional: true } } };
  assert.deepEqual(checkViroSpecsActionPayload(decl, { mode: "x", n: 2 }), []);
  assert.deepEqual(checkViroSpecsActionPayload(decl, { mode: "z", n: 2, on: "yes" }).map((p) => p.path), ["/mode", "/on"]);
  assert.deepEqual(checkViroSpecsActionPayload(decl, { mode: "y", n: Number.NaN }).map((p) => p.path), ["/n"]);
  assert.deepEqual(checkViroSpecsActionPayload({ id: "c" }, undefined), []);
  assert.deepEqual(checkViroSpecsActionPayload({ id: "c" }, []).map((p) => p.message), ["Expected a payload object."]);
});

test("registry: undeclared or duplicate handlers, ill-typed dispatch, throwing handler, missing handler", () => {
  const { runtime, registry, diagnostics, controller } = setup();
  runtime.start();
  registry.on("exhibit.close", (s) => s);
  registry.on("nav.back", (s) => s);
  assert.deepEqual(codes(diagnostics), ["VS5015", "VS5016"]);
  diagnostics.length = 0;

  const before = runtime.state;
  assert.equal(runtime.dispatch("exhibit.open", { exhibitId: 7 }), false);
  assert.equal(runtime.dispatch("exhibit.teleport", {}), false);
  assert.equal(runtime.state, before);
  assert.deepEqual(codes(diagnostics), ["VS5017", "VS5015"]);
  diagnostics.length = 0;

  const local = new ViroSpecsActionRegistry([{ id: "boom" }, { id: "quiet" }, { id: "boom" }, { id: "Bad ID" }], controller.diagnostics);
  assert.deepEqual(codes(diagnostics).sort(), ["VS5016", "VS5017"]);
  assert.deepEqual(local.declarations.map((d) => d.id), ["boom", "quiet"]);
  diagnostics.length = 0;
  local.on("boom", () => { throw new Error("kaput"); });
  const other = new ViroSpecsActionRuntime(controller, { initialState: { n: 0 }, view: () => ({ version: 2, nodes: [] }), registry: local, diagnostics: controller.diagnostics });
  assert.equal(other.dispatch("boom"), false);
  assert.equal(other.dispatch("quiet"), true);
  assert.deepEqual(codes(diagnostics), ["VS5009", "VS5019"]);
});

test("forward is optional: accepted actions reach it, missing handlers are not reported when it is set", () => {
  const forwarded = [];
  const backend = new MockBackend();
  const scheduler = new ManualScheduler();
  const controller = new ViroSpecsSceneController(backend, scheduler);
  const diagnostics = [];
  controller.diagnostics.addOnDiagnosticListener((d) => diagnostics.push(d));
  // Phone mode: declarations only, no local handlers.
  const registry = new ViroSpecsActionRegistry(VIRO_SPECS_REFERENCE_ACTIONS, controller.diagnostics);
  const runtime = new ViroSpecsActionRuntime(controller, {
    initialState: VIRO_SPECS_REFERENCE_INITIAL_STATE,
    view: viewViroSpecsReferenceFlow,
    registry,
    diagnostics: controller.diagnostics,
    forward: (a) => forwarded.push(a.actionId + " " + JSON.stringify(a.payload)),
  });
  runtime.start();
  scheduler.tick();
  pinch(backend, scheduler, "card-seismograph");
  assert.deepEqual(forwarded, ['exhibit.open {"exhibitId":"seismograph"}']);
  assert.equal(runtime.state.route, "list", "no local handler: the phone owns state");
  assert.deepEqual(diagnostics, []);
});

test("a view the controller rejects rolls state back to what is on screen", () => {
  const { scheduler, controller, diagnostics, runtime } = setup({}, {
    view: (state) => (state.units === "imperial" ? { version: 2, route: "details", nodes: [{ id: "x", kind: "nope" }] } : viewViroSpecsReferenceFlow(state)),
  });
  runtime.start();
  runtime.dispatch("exhibit.open", { exhibitId: "orrery" });
  scheduler.tick();
  const revision = controller.revision;
  assert.equal(runtime.dispatch("settings.set-units", { units: "imperial" }), false);
  assert.equal(runtime.state.units, "metric");
  assert.equal(controller.route, "details");
  assert.ok(codes(diagnostics).includes("VS5002"));
  assert.ok(controller.revision >= revision);
});

test("route memory is bounded: the least recently left route is forgotten with VS5020", () => {
  const backend = new MockBackend();
  const scheduler = new ManualScheduler();
  const controller = new ViroSpecsSceneController(backend, scheduler, { maxRememberedRoutes: 2 });
  const diagnostics = [];
  controller.diagnostics.addOnDiagnosticListener((d) => diagnostics.push(d));
  const scene = (route) => ({ version: 2, route, nodes: [{ id: route + "-list", kind: "group", scroll: { width: 0.4, height: 0.2, contentHeight: 1 } }] });
  controller.present(scene("a"));
  controller.getNodeHandle("a-list").state.scrollNormalized = [0, 0.3];
  controller.update(scene("b"));
  controller.getNodeHandle("b-list").state.scrollNormalized = [0, 0.6];
  controller.update(scene("c"));
  assert.deepEqual(controller.rememberedRoutes, ["a", "b"]);
  controller.update(scene("d"));
  assert.deepEqual(codes(diagnostics), ["VS5020"]);
  assert.deepEqual(controller.rememberedRoutes, ["b", "c"]);
  controller.update(scene("b"));
  assert.deepEqual(controller.getNodeState("b-list").scrollNormalized, [0, 0.6]);
  controller.update(scene("a"));
  assert.deepEqual(controller.getNodeState("a-list").scrollNormalized, [0, 1], "forgotten route starts at the top");
});

test("100 list -> details -> setting -> back cycles keep scroll, leak nothing and report no warnings", () => {
  const { backend, scheduler, controller, diagnostics, runtime } = setup();
  runtime.start();
  scheduler.tick();
  const cards = VIRO_SPECS_REFERENCE_INITIAL_STATE.exhibits.map((e) => "card-" + e.id);
  for (let i = 0; i < 100; i++) {
    const scroll = [0, (i % 10) / 10];
    controller.getNodeHandle("exhibit-list").state.scrollNormalized = scroll.slice();
    pinch(backend, scheduler, cards[i % cards.length]);
    scheduler.tick();
    pinch(backend, scheduler, "units-toggle");
    scheduler.tick();
    pinch(backend, scheduler, "back-button");
    scheduler.tick();
    assert.equal(controller.route, "list");
    assert.deepEqual(controller.getNodeState("exhibit-list").scrollNormalized, scroll, "cycle " + i);
  }
  assert.equal(runtime.state.units, "metric", "100 toggles end where they started");
  assert.equal(backend.liveRoots().length, 1);
  assert.equal(scheduler.queued, 0);
  assert.equal(controller.pendingWork, backend.bindings.filter((b) => b.active).length);
  assert.deepEqual(diagnostics.filter((d) => d.severity !== "info"), []);
  runtime.dispose();
  controller.dispose();
  assert.equal(backend.liveNodes().length, 0);
  assert.equal(backend.bindings.filter((b) => b.active).length, 0);
});
