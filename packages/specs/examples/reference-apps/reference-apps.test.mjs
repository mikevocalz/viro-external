// Reference apps on the mock host. Loads the three scene documents viro
// compiled from examples/specs-reference-apps (copied to scenes/) through the
// same path scripts/experience.test.mjs uses: the real Lens-side scene
// controller and experience controller (scripts/build-lens-core.mjs builds
// them to build/lens-core) on the recording backend. Then runs each app's
// typed-action loop standalone, the way the LEAF scenarios do in Preview.
// Evidence label: portable-test-passed. No Lens Studio involved.
//
//   node scripts/build-lens-core.mjs && node --test examples/reference-apps/reference-apps.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ViroSpecsSceneController } from "../../build/lens-core/ViroSpecsSceneController.js";
import { readViroSpecsSceneInput } from "../../build/lens-core/ViroSpecsSceneDocument.js";
import { ViroSpecsActionRegistry, ViroSpecsActionRuntime } from "../../build/lens-core/ViroSpecsActionRuntime.js";
import { ViroSpecsExperienceController } from "../../build/lens-core/ViroSpecsExperience.js";
import { VIRO_SPECS_LENS_DEFAULT_THEME, VIRO_SPECS_LENS_SPATIAL_TOKENS } from "../../build/lens-core/ViroSpecsExperienceTokens.js";
import { ViroSpecsPlacementSession } from "../../build/lens-core/ViroSpecsPlacement.js";
import { ManualScheduler, MockBackend } from "../../scripts/support/mock-scene-host.mjs";
import { VIRO_REF_APPS, renderViroRefAppScenes } from "./gen-lens-scenes.mjs";
import {
  VIRO_REF_DASHBOARD_HANDLERS,
  VIRO_REF_DASHBOARD_INITIAL,
  VIRO_REF_DASHBOARD_METRICS,
  VIRO_REF_MODEL_HANDLERS,
  VIRO_REF_MODEL_INITIAL,
  VIRO_REF_NODE_IDS,
  VIRO_REF_PLACEMENT_HANDLERS,
  VIRO_REF_PLACEMENT_INITIAL,
  VIRO_REF_PLACEMENT_PROMPTS,
  viewViroRefDashboard,
  viewViroRefModel,
  viewViroRefPlacement,
  viroRefDashboardStatus,
  viroRefFacingWearer,
  viroRefModelStatus,
  viroRefYawQuaternion,
} from "./leaf/ViroRefAppsLogic.ts";

const scene = (name) => JSON.parse(readFileSync(new URL("./scenes/" + name + ".scene.json", import.meta.url), "utf8"));
const SHIBA = "examples/visionos-sweep/assets/shiba.glb";
const flush = () => new Promise((r) => setImmediate(r));
const codes = (ds) => ds.map((d) => d.code + (d.nodeId ? "@" + d.nodeId : ""));

/**
 * Host diagnostics other than VS5008. This host reports VS5008 ("maxLines is
 * approximated by the text box height", a warning) once when it creates a
 * text node with maxLines, and every PanelText carries maxLines, so each
 * PanelText raises it; the four Platform Lab gallery scenes do the same.
 * `expectMaxLinesNotices` pins that list exactly, so nothing else hides in it.
 */
const findings = (ds) => codes(ds.filter((d) => d.code !== "VS5008"));

function expectMaxLinesNotices(ctx, doc) {
  const expected = doc.nodes.filter((n) => n.kind === "text" && n.maxLines !== undefined).map((n) => "VS5008@" + n.id).sort();
  const seen = codes(ctx.diagnostics.filter((d) => d.code === "VS5008")).sort();
  assert.deepEqual(seen, expected);
  for (const d of ctx.diagnostics.filter((x) => x.code === "VS5008")) assert.equal(d.severity, "warning");
}

/** Placement needs WorldQuery; the other two only need a gaze path. */
const REQUIREMENTS = {
  dashboard: { placement: false, gazeOnly: true },
  "model-viewer": { placement: false, gazeOnly: true },
  "world-placed-info": { placement: true, gazeOnly: true },
};

const APPS = {
  dashboard: { handlers: VIRO_REF_DASHBOARD_HANDLERS, initial: VIRO_REF_DASHBOARD_INITIAL, view: viewViroRefDashboard },
  "model-viewer": { handlers: VIRO_REF_MODEL_HANDLERS, initial: VIRO_REF_MODEL_INITIAL, view: viewViroRefModel },
  "world-placed-info": { handlers: VIRO_REF_PLACEMENT_HANDLERS, initial: VIRO_REF_PLACEMENT_INITIAL, view: viewViroRefPlacement },
};

/** Scene controller + experience controller on the mock backend, with the shiba GLB registered unless `missing`. */
function setup(name, { missing = false } = {}) {
  const backend = new MockBackend();
  const scheduler = new ManualScheduler();
  if (!missing) backend.models.set(SHIBA, { asset: SHIBA });
  const controller = new ViroSpecsSceneController(backend, scheduler);
  const diagnostics = [];
  controller.diagnostics.addOnDiagnosticListener((d) => diagnostics.push(d));
  const experience = new ViroSpecsExperienceController({
    requirements: REQUIREMENTS[name],
    diagnostics: controller.diagnostics,
    nowMs: () => scheduler.nowMs(),
  });
  experience.attach(controller);
  return { backend, scheduler, controller, experience, diagnostics };
}

/** The standalone Lens loop for one app: registry + runtime over the compiled document. */
function startApp(name, ctx) {
  const app = APPS[name];
  const base = scene(name);
  const registry = new ViroSpecsActionRegistry(base.actions, ctx.controller.diagnostics);
  for (const [id, handler] of Object.entries(app.handlers)) registry.on(id, handler);
  const runtime = new ViroSpecsActionRuntime(ctx.controller, {
    initialState: app.initial,
    view: (state) => app.view(base, state),
    registry,
    diagnostics: ctx.controller.diagnostics,
    nowMs: () => ctx.scheduler.nowMs(),
  });
  const actions = [];
  ctx.controller.addOnActionListener((a) => actions.push([a.actionId, a.payload, a.nodeId]));
  return { base, runtime, actions, start: () => runtime.start() };
}

/** Pinch on a node: hover, select, then the frame that delivers the action. */
function pinch(ctx, nodeId) {
  ctx.backend.fire(nodeId, { phase: "hover-enter", source: "hand-right" });
  ctx.backend.fire(nodeId, { phase: "select-start", source: "hand-right" });
  ctx.backend.fire(nodeId, { phase: "select-end", source: "hand-right" });
  ctx.backend.fire(nodeId, { phase: "hover-exit", source: "hand-right" });
  ctx.scheduler.tick();
}

/** Which VIRO_REF_NODE_IDS group belongs to each app. */
const NODE_ID_GROUP = { dashboard: "dashboard", "model-viewer": "model", "world-placed-info": "placement" };

const live = (ctx, id) => ctx.backend.liveNodes().find((h) => h.id === id);
const textOf = (ctx, id) => live(ctx, id)?.state.text?.text;

// --- The documents ---------------------------------------------------------------

test("leaf/ViroRefAppScenes.ts embeds the current scene documents", () => {
  assert.equal(readFileSync(new URL("./leaf/ViroRefAppScenes.ts", import.meta.url), "utf8"), renderViroRefAppScenes());
});

for (const name of VIRO_REF_APPS) {
  test(name + ": passes the host reader, carries this host's theme and labels every interactable", () => {
    const doc = scene(name);
    const read = readViroSpecsSceneInput(doc, 1);
    assert.equal(read.ok, true, JSON.stringify(read.diagnostics));
    assert.deepEqual(doc.theme, VIRO_SPECS_LENS_DEFAULT_THEME);
    const ids = new Set(doc.nodes.map((n) => n.id));
    assert.equal(ids.size, doc.nodes.length, "node IDs are unique");
    for (const interaction of doc.interactions) {
      const node = doc.nodes.find((n) => n.id === interaction.nodeId);
      assert.ok(typeof node?.label === "string" && node.label.length > 0, interaction.nodeId + " has no label");
    }
    for (const id of Object.values(VIRO_REF_NODE_IDS[NODE_ID_GROUP[name]]).flat()) {
      assert.ok(ids.has(id), "VIRO_REF_NODE_IDS names " + id + ", which the document lacks");
    }
  });

  test(name + ": applies on the mock host with no host diagnostics besides the pinned VS5008 notices, and binds every interaction", async () => {
    const ctx = setup(name);
    const doc = scene(name);
    assert.equal(ctx.controller.present(doc).status, "committed");
    ctx.scheduler.tick();
    await flush();
    assert.equal(ctx.controller.lifecycle, "ready");
    ctx.experience.tick();
    const view = ctx.experience.view();
    assert.equal(view.sceneVisible, true);
    assert.equal(view.errorPanel, undefined);
    assert.deepEqual(findings(ctx.diagnostics), []);
    expectMaxLinesNotices(ctx, doc);
    const bound = new Set(ctx.backend.bindings.filter((b) => b.active).map((b) => b.handle.id));
    for (const interaction of doc.interactions) assert.ok(bound.has(interaction.nodeId), interaction.nodeId + " is not bound");
  });

  test(name + ": the view of the initial state is the compiled document, so start() changes nothing", () => {
    const app = APPS[name];
    assert.deepEqual(app.view(scene(name), app.initial), scene(name));
  });
}

// --- Dashboard: typed actions change the readings --------------------------------

test("dashboard: a range pinch fires dashboard.set-range and patches the readings in place; Refresh marks the status", async () => {
  const ctx = setup("dashboard");
  const app = startApp("dashboard", ctx);
  assert.equal(app.start().status, "committed");
  ctx.scheduler.tick();
  await flush();
  const ids = VIRO_REF_NODE_IDS.dashboard;
  const root = ctx.backend.liveRoots()[0];
  const before = ids.values.map((id) => textOf(ctx, id));
  assert.deepEqual(before, VIRO_REF_DASHBOARD_METRICS.map((m) => m.values["24h"]));

  pinch(ctx, "dash-range-7d");
  assert.deepEqual(app.actions, [["dashboard.set-range", { range: "7d" }, "dash-range-7d"]]);
  assert.equal(app.runtime.state.range, "7d");
  const after = ids.values.map((id) => textOf(ctx, id));
  assert.deepEqual(after, VIRO_REF_DASHBOARD_METRICS.map((m) => m.values["7d"]));
  assert.notDeepEqual(after, before);
  assert.equal(textOf(ctx, ids.status), "Averages over the last 7 days");
  assert.equal(ctx.backend.liveRoots()[0], root, "same scene root: patched, not navigated");

  const refreshes = app.runtime.state.refreshes;
  pinch(ctx, ids.refresh);
  assert.equal(app.runtime.state.refreshes - refreshes, 1);
  assert.equal(textOf(ctx, ids.status), viroRefDashboardStatus(app.runtime.state));
  assert.ok(textOf(ctx, ids.status).endsWith(", refreshed"));
  assert.deepEqual(findings(ctx.diagnostics), []);
});

// --- Model viewer: turn, resize, reset, drag, missing asset -----------------------

test("model viewer: turn and resize patch the model transform by the expected delta; reset restores it", async () => {
  const ctx = setup("model-viewer");
  const app = startApp("model-viewer", ctx);
  app.start();
  ctx.scheduler.tick();
  await flush();
  assert.equal(ctx.controller.lifecycle, "ready");
  const model = () => live(ctx, "mv-model").state.transform;
  const initial = structuredClone(model());

  pinch(ctx, "mv-turn-right");
  assert.deepEqual(app.actions.at(-1), ["model.turn", { degrees: 45 }, "mv-turn-right"]);
  const turned = model().rotation;
  const expected = viroRefYawQuaternion(45);
  for (let i = 0; i < 4; i++) assert.ok(Math.abs(turned[i] - expected[i]) < 1e-9, "rotation " + JSON.stringify(turned));

  const scaleBefore = model().scale[0];
  pinch(ctx, "mv-larger");
  assert.ok(Math.abs(model().scale[0] / scaleBefore - 1.2) < 1e-9, "one step is 20 %");
  assert.equal(textOf(ctx, "mv-status"), "Turned 45°, size 120 %");

  pinch(ctx, "mv-reset");
  assert.deepEqual(model(), initial);
  assert.equal(textOf(ctx, "mv-status"), viroRefModelStatus(VIRO_REF_MODEL_INITIAL));
  assert.deepEqual(findings(ctx.diagnostics), []);
});

test("model viewer: a drag on the model reaches the app as drag phases with a position", async () => {
  const ctx = setup("model-viewer");
  ctx.controller.present(scene("model-viewer"));
  ctx.scheduler.tick();
  await flush();
  const events = [];
  ctx.controller.addOnInteractionListener((e) => events.push(e));
  ctx.backend.fire("mv-model", { phase: "drag", source: "hand-right", position: [0.1, -0.05, -1.3] });
  ctx.scheduler.tick();
  const drag = events.find((e) => e.nodeId === "mv-model" && e.phase === "drag");
  assert.ok(drag, JSON.stringify(events));
  assert.deepEqual(drag.position, [0.1, -0.05, -1.3]);
  // The experience layer holds a drag inside the 0.6-3.0 m band.
  const far = ctx.experience.clampToComfortBand("mv-model", [0, -0.05, -4]);
  assert.ok(Math.abs(Math.hypot(...far) - 3) < 1e-9);
  assert.deepEqual(findings(ctx.diagnostics), ["VS5023@mv-model"]);
});

test("model viewer: a missing GLB shows a placeholder and one error panel with Retry; the controls still work", async () => {
  const ctx = setup("model-viewer", { missing: true });
  const app = startApp("model-viewer", ctx);
  app.start();
  ctx.scheduler.tick();
  await flush();
  assert.ok(codes(ctx.diagnostics).includes("VS5003@mv-model"), JSON.stringify(codes(ctx.diagnostics)));
  assert.ok(live(ctx, "mv-model").state.placeholder, "placeholder drawn at the model");
  const panel = ctx.experience.view().errorPanel;
  assert.equal(panel.kind, "asset");
  assert.equal(panel.title, "Model didn't load");
  assert.equal(panel.actionLabel, "Retry");
  assert.deepEqual(panel.nodeIds, ["mv-model"]);
  assert.equal(ctx.experience.view().sceneVisible, true, "never a dead lens");
  // The rest of the scene works.
  pinch(ctx, "mv-turn-left");
  assert.equal(app.runtime.state.yawDegrees, 315);
  assert.deepEqual(ctx.experience.activateErrorAction(), { action: "retry", nodeIds: ["mv-model"] });
});

// --- World-placed info: placement confirm and cancel ------------------------------

const tableHit = { position: [0.1, -0.45, -1.1], normal: [0, 1, 0] };

test("world-placed info: Place card, a WorldQuery hit on a table, pinch confirms, and the card shows at the hit facing the wearer", async () => {
  const ctx = setup("world-placed-info");
  const app = startApp("world-placed-info", ctx);
  app.start();
  ctx.scheduler.tick();
  await flush();
  const ids = VIRO_REF_NODE_IDS.placement;
  assert.equal(live(ctx, ids.card).visible, false, "the card starts hidden");
  assert.equal(live(ctx, ids.cancel).visible, false);

  pinch(ctx, ids.place);
  assert.equal(app.runtime.state.phase, "placing");
  assert.equal(textOf(ctx, ids.prompt), VIRO_REF_PLACEMENT_PROMPTS.placing);
  assert.equal(live(ctx, ids.cancel).visible, true);

  // What ViroSpecsExperienceHost does on the Lens: a placement session fed by WorldQuery hits.
  const session = new ViroSpecsPlacementSession({ tokens: VIRO_SPECS_LENS_SPATIAL_TOKENS });
  session.update(tableHit, 0);
  assert.equal(session.view().label, "Table. Pinch to place.");
  const result = session.pinch();
  assert.equal(result.placed, true);
  const [x, y, z] = ctx.experience.clampToComfortBand("placement", result.position);
  assert.equal(app.runtime.dispatch("placement.confirm", { x, y, z }), true);

  assert.equal(app.runtime.state.phase, "placed");
  const card = live(ctx, ids.card);
  assert.equal(card.visible, true);
  assert.deepEqual(card.state.transform.position, tableHit.position);
  assert.deepEqual(card.state.transform.rotation, viroRefFacingWearer(tableHit.position));
  assert.equal(textOf(ctx, ids.prompt), VIRO_REF_PLACEMENT_PROMPTS.placed);
  assert.equal(textOf(ctx, ids.place), "Move card");
  assert.equal(live(ctx, ids.cancel).visible, false);
  assert.deepEqual(findings(ctx.diagnostics), []);
});

test("world-placed info: looking away cancels the session, Cancel returns to idle, and a placed card stays where it was", async () => {
  const ctx = setup("world-placed-info");
  const app = startApp("world-placed-info", ctx);
  app.start();
  ctx.scheduler.tick();
  await flush();
  const ids = VIRO_REF_NODE_IDS.placement;

  pinch(ctx, ids.place);
  const session = new ViroSpecsPlacementSession({ tokens: VIRO_SPECS_LENS_SPATIAL_TOKENS });
  session.update(tableHit, 0);
  session.update(null, 100);
  session.update(null, 1600);
  assert.equal(session.currentPhase, "cancelled");
  assert.deepEqual(session.pinch(), { placed: false });
  assert.equal(live(ctx, ids.card).visible, false, "nothing placed");
  pinch(ctx, ids.cancel);
  assert.deepEqual(app.actions.at(-1), ["placement.cancel", {}, ids.cancel]);
  assert.deepEqual(app.runtime.state, { phase: "idle" });
  assert.equal(textOf(ctx, ids.prompt), VIRO_REF_PLACEMENT_PROMPTS.idle);

  // Place once, start a move, cancel it: the card keeps its pose.
  pinch(ctx, ids.place);
  app.runtime.dispatch("placement.confirm", { x: tableHit.position[0], y: tableHit.position[1], z: tableHit.position[2] });
  const placed = structuredClone(live(ctx, ids.card).state.transform);
  pinch(ctx, ids.place);
  pinch(ctx, ids.cancel);
  assert.equal(app.runtime.state.phase, "placed");
  assert.equal(live(ctx, ids.card).visible, true);
  assert.deepEqual(live(ctx, ids.card).state.transform, placed);
  assert.deepEqual(findings(ctx.diagnostics), []);
});
