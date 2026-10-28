// Experience layer suite (WS4). Runs the real Lens-side experience code
// (compiled by scripts/build-lens-core.mjs) with the scene controller and the
// mock backend, on the four Platform Lab gallery documents viro compiled
// (scripts/fixtures/gallery, copied from viro
// __test__/fixtures/specs/gallery). Evidence label: portable-test-passed.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ViroSpecsSceneController } from "../build/lens-core/ViroSpecsSceneController.js";
import { readViroSpecsSceneInput } from "../build/lens-core/ViroSpecsSceneDocument.js";
import {
  ViroSpecsButtonTracker,
  ViroSpecsExperienceController,
  ViroSpecsGazeDwell,
  resolveViroSpecsButtonVisual,
  stepViroSpecsMove,
  stepViroSpecsScroll,
  unrenderedViroSpecsComponentFeatures,
} from "../build/lens-core/ViroSpecsExperience.js";
import { VIRO_SPECS_LENS_COPY, formatViroSpecsCopy } from "../build/lens-core/ViroSpecsExperienceCopy.js";
import {
  VIRO_SPECS_LENS_DEFAULT_THEME,
  VIRO_SPECS_LENS_SPATIAL_TOKENS,
  VIRO_SPECS_LENS_TEXT_EM_METERS_PER_SIZE,
  resolveViroSpecsTokens,
  viroSpecsMetersToAngle,
} from "../build/lens-core/ViroSpecsExperienceTokens.js";
import { ViroSpecsPlacementSession, classifyViroSpecsSurface } from "../build/lens-core/ViroSpecsPlacement.js";
import { ManualScheduler, MockBackend } from "./support/mock-scene-host.mjs";

const fixture = (name) => JSON.parse(readFileSync(new URL("./fixtures/gallery/" + name + ".scene.json", import.meta.url), "utf8"));
const GALLERY = ["hello", "placement", "interaction", "navigation"];
const SHIBA = "examples/visionos-sweep/assets/shiba.glb";
const CARD_IMAGE = "examples/visionos-sweep/assets/button.png";

/** What each gallery scene needs, from viro docs/ux/handoff. */
const REQUIREMENTS = {
  hello: { placement: false, gazeOnly: true },
  placement: { placement: true, gazeOnly: true },
  interaction: { placement: false, gazeOnly: true },
  navigation: { placement: false, gazeOnly: true },
};

const tokens = VIRO_SPECS_LENS_SPATIAL_TOKENS;

function deferred() {
  let resolve;
  const promise = new Promise((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

const flush = () => new Promise((r) => setImmediate(r));

/**
 * Scene controller + experience controller on the mock backend.
 * `assets`: "ok" resolves immediately, "slow" returns a deferred promise,
 * "missing" leaves the asset unregistered.
 */
function setup(name, { assets = "ok", builderMode = false, requirements } = {}) {
  const backend = new MockBackend();
  const scheduler = new ManualScheduler();
  const pending = [];
  for (const [table, source] of [[backend.models, SHIBA], [backend.images, CARD_IMAGE]]) {
    if (assets === "ok") table.set(source, { asset: source });
    if (assets === "slow") {
      table.set(source, () => {
        const d = deferred();
        pending.push(d);
        return d.promise;
      });
    }
  }
  const controller = new ViroSpecsSceneController(backend, scheduler);
  const diagnostics = [];
  controller.diagnostics.addOnDiagnosticListener((d) => diagnostics.push(d));
  const experience = new ViroSpecsExperienceController({
    requirements: requirements ?? REQUIREMENTS[name],
    diagnostics: controller.diagnostics,
    nowMs: () => scheduler.nowMs(),
    builderMode,
  });
  experience.attach(controller);
  return { backend, scheduler, controller, experience, diagnostics, pending };
}

// --- Contract with viro ------------------------------------------------------

test("gallery documents pass the host reader and carry the theme this host defaults to", () => {
  for (const name of GALLERY) {
    const doc = fixture(name);
    const read = readViroSpecsSceneInput(doc, 1);
    assert.equal(read.ok, true, name + ": " + JSON.stringify(read.diagnostics));
    // viro's tokens.ts and ViroSpecsExperienceTokens.ts must agree; the
    // compiled theme is viro's copy.
    assert.deepEqual(doc.theme, VIRO_SPECS_LENS_DEFAULT_THEME, name);
    for (const interaction of doc.interactions) {
      const node = doc.nodes.find((n) => n.id === interaction.nodeId);
      assert.ok(typeof node.label === "string" && node.label.length > 0, name + ": " + interaction.nodeId + " has no label");
    }
  }
});

test("the copy table matches the copy viro exported from docs/ux/copy.md", () => {
  const exported = JSON.parse(readFileSync(new URL("./fixtures/copy.json", import.meta.url), "utf8"));
  assert.deepEqual({ ...VIRO_SPECS_LENS_COPY }, exported);
  assert.equal(formatViroSpecsCopy("loading.progress", { done: 1, total: 3 }), "Loading 1 of 3");
});

test("the host reader rejects bad components and themes with VS5002, keeping the previous scene", () => {
  const bad = [
    [{ id: "t", kind: "image", source: "x", component: { type: "panel-button", state: "idle" } }, "/nodes/0/component/type"],
    [{ id: "b", kind: "panel", component: { type: "panel-button", state: "hover" } }, "/nodes/0/component/state"],
    [{ id: "b", kind: "panel", label: "" }, "/nodes/0/label"],
  ];
  for (const [node, path] of bad) {
    const read = readViroSpecsSceneInput({ version: 2, nodes: [node] }, 3);
    assert.equal(read.ok, false);
    assert.ok(read.diagnostics.some((d) => d.code === "VS5002" && d.fieldPath === path), path + " " + JSON.stringify(read.diagnostics));
  }
  const theme = structuredClone(VIRO_SPECS_LENS_DEFAULT_THEME);
  theme.tokens.color.focus = "amber";
  delete theme.tokens.input.gazeDwellMs;
  const read = readViroSpecsSceneInput({ version: 2, nodes: [], theme }, 1);
  assert.equal(read.ok, false);
  assert.deepEqual(read.diagnostics.map((d) => d.fieldPath).sort(), ["/theme/tokens/color/focus", "/theme/tokens/input/gazeDwellMs"]);
});

// --- Lifecycle per gallery scene --------------------------------------------

for (const name of GALLERY) {
  test(name + ": loading shows a progress ring after 120 ms, then the scene appears with no interactables before ready", async () => {
    const { controller, experience, scheduler, pending } = setup(name, { assets: "slow" });
    const views = [];
    experience.addOnViewListener((v) => views.push(v));
    controller.present(fixture(name));
    assert.equal(controller.lifecycle, "loading");
    let view = experience.view();
    assert.equal(view.loading.visible, false, "no flash in the first motion.fast");
    assert.equal(view.sceneVisible, false);
    scheduler.tick(130);
    experience.tick();
    view = experience.view();
    assert.equal(view.loading.visible, true);
    assert.equal(view.loading.title, "Loading scene");
    const total = controller.assetProgress.total;
    assert.ok(total >= 1);
    assert.equal(view.loading.line, "Loading 0 of " + total);
    assert.equal(view.loading.progress, 0);
    assert.equal(view.loading.indicator, "ring-arc");
    assert.equal(view.loading.accessibilityLabel, "Loading scene, 0 percent");
    assert.equal(view.sceneVisible, false, "nothing pinchable mid-load (A-check L4)");

    scheduler.tick(2000);
    experience.tick();
    assert.equal(experience.view().loading.line, "Still loading. Large models can take a moment.");

    for (const d of pending) d.resolve({ asset: "late" });
    await flush();
    assert.equal(controller.lifecycle, "ready");
    view = experience.view();
    assert.equal(view.loading.visible, false);
    assert.equal(view.sceneVisible, true);
    assert.equal(view.errorPanel, undefined);
  });

  test(name + ": a scene that is ready within motion.fast never shows the loading panel", async () => {
    const { controller, experience, scheduler } = setup(name);
    const shown = [];
    experience.addOnViewListener((v) => shown.push(v.loading.visible));
    controller.present(fixture(name));
    scheduler.tick(16);
    await flush();
    assert.equal(controller.lifecycle, "ready");
    assert.equal(shown.includes(true), false);
  });

  test(name + ": degraded hides what depends on the missing capability and shows one line", () => {
    const { controller, experience, diagnostics } = setup(name);
    controller.present(fixture(name));
    if (name === "placement") {
      experience.setCapabilities({ "world-query": "unsupported", "surface-placement": "unsupported", "hand-tracking": "supported" });
      const view = experience.view();
      assert.equal(view.hidden.placement, true);
      assert.equal(view.placeInFront, true);
      assert.equal(view.notice.message, "Placement isn't available on this device. Content stays in front of you.");
      assert.equal(view.gazeControls.placeHere, false);
    } else {
      experience.setCapabilities({ "hand-tracking": "permission-required", pinch: "permission-required" });
      const view = experience.view();
      assert.equal(view.inputMode, "gaze");
      assert.deepEqual(view.hidden, { placement: false, drag: true, pinchHints: true });
      assert.equal(view.notice.message, "Hand tracking is off. Look at a button and hold your gaze to select.");
      assert.equal(view.notice.dismissLabel, "Got it");
      assert.equal(view.gazeControls.moveButtons, true);
      assert.equal(view.gazeControls.scrollButtons, true);
      assert.ok(diagnostics.some((d) => d.code === "VS5024" && d.phase === "experience"));
    }
    assert.ok(diagnostics.some((d) => d.code === "VS5021" && d.phase === "experience"));
    assert.equal(experience.view().sceneVisible, true, "degraded never hides the scene");
  });

  test(name + ": a missing asset shows a placeholder and an error panel with Retry, never a dead lens", async () => {
    const { controller, experience, backend, diagnostics } = setup(name, { assets: "missing" });
    controller.present(fixture(name));
    await flush();
    assert.ok(diagnostics.some((d) => d.code === "VS5003"));
    const view = experience.view();
    assert.equal(view.sceneVisible, true);
    const panel = view.errorPanel;
    assert.ok(panel, "error panel shown");
    assert.equal(panel.kind, "asset");
    assert.equal(panel.action, "retry");
    assert.equal(panel.actionLabel, "Retry");
    assert.equal(panel.message, "The rest of the scene works. Retry to load it again.");
    assert.ok(panel.diagnosticLines.every((line) => /^VS5003 \(.+\)$/.test(line)), JSON.stringify(panel.diagnosticLines));
    assert.ok(backend.calls.some((c) => c.call === "showPlaceholder"), "placeholder drawn");
    const missing = panel.nodeIds.length;
    assert.equal(panel.title, missing === 1 ? "Model didn't load" : missing + " models didn't load");
    const retry = experience.activateErrorAction();
    assert.deepEqual(retry, { action: "retry", nodeIds: panel.nodeIds });
    assert.equal(experience.view().errorPanel, undefined);
  });
}

test("navigation: eight card images fail as one panel with eight de-duplicated codes", async () => {
  const { controller, experience } = setup("navigation", { assets: "missing" });
  controller.present(fixture("navigation"));
  await flush();
  const panel = experience.view().errorPanel;
  assert.equal(panel.title, panel.nodeIds.length + " models didn't load");
  assert.equal(new Set(panel.diagnosticLines).size, panel.diagnosticLines.length);
  assert.ok(panel.nodeIds.includes("nav-card-1-image"));
});

test("a rejected update keeps the last scene and shows Close; a rejected first scene keeps the panel up", async () => {
  const live = setup("hello");
  live.controller.present(fixture("hello"));
  await flush();
  live.controller.update({ version: 2, nodes: [{ id: "x", kind: "nope" }] });
  let panel = live.experience.view().errorPanel;
  assert.equal(panel.kind, "scene");
  assert.equal(panel.title, "Scene couldn't open");
  assert.equal(panel.message, "The last working scene is still here.");
  assert.equal(panel.actionLabel, "Close");
  assert.match(panel.diagnosticLines[0], /^VS5002/);
  assert.equal(live.experience.view().sceneVisible, true);
  live.experience.activateErrorAction();
  assert.equal(live.experience.view().errorPanel, undefined);

  const fresh = setup("hello");
  fresh.controller.present({ version: 2, nodes: [{ id: "x", kind: "nope" }] });
  panel = fresh.experience.view().errorPanel;
  assert.equal(panel.kind, "scene-no-fallback");
  assert.equal(panel.message, "Close this lens and open it again. If it keeps happening, the code below helps the developer.");
  fresh.experience.activateErrorAction();
  assert.equal(fresh.experience.view().errorPanel.kind, "scene-no-fallback", "never a blank view");
});

test("errors during loading wait until the scene is visible", async () => {
  const { controller, experience, scheduler, pending, backend } = setup("hello", { assets: "slow" });
  controller.present(fixture("hello"));
  scheduler.tick(200);
  backend.models.delete(SHIBA);
  pending[0].resolve(null);
  await flush();
  // The asset settled as missing: placeholder, lifecycle degraded, scene visible, panel up.
  assert.equal(controller.lifecycle, "degraded");
  assert.equal(experience.view().errorPanel.kind, "asset");
});

test("transport loss keeps the scene and offers Got it", async () => {
  const { controller, experience } = setup("interaction");
  controller.present(fixture("interaction"));
  await flush();
  experience.setTransportConnected(false);
  const panel = experience.view().errorPanel;
  assert.equal(panel.title, "Lost connection to the app");
  assert.equal(panel.actionLabel, "Got it");
  assert.equal(experience.view().sceneVisible, true);
  experience.activateErrorAction();
  assert.equal(experience.view().errorPanel, undefined);
});

// --- Degraded rules ----------------------------------------------------------

test("notices: placement beats hand tracking, dismissed notices stay gone, flicker does not re-show", () => {
  const { controller, experience, diagnostics } = setup("placement");
  controller.present(fixture("placement"));
  experience.setCapabilities({ "world-query": "temporarily-unavailable", "hand-tracking": "temporarily-unavailable" });
  assert.equal(experience.view().notice.capability, "world-query");
  assert.equal(experience.view().notice.message, "Can't find surfaces right now. Try a brighter spot or look at a table or floor.");
  assert.equal(experience.view().hidden.placement, false, "searching stays while temporarily unavailable");
  experience.dismissNotice();
  assert.equal(experience.view().notice.capability, "hand-tracking");
  experience.dismissNotice();
  assert.equal(experience.view().notice, undefined);

  const before = diagnostics.filter((d) => d.code === "VS5021").length;
  experience.setCapabilities({ "world-query": "supported", "hand-tracking": "supported" });
  assert.equal(experience.view().inputMode, "hands", "returns to hands automatically");
  experience.setCapabilities({ "world-query": "temporarily-unavailable", "hand-tracking": "temporarily-unavailable" });
  assert.equal(experience.view().notice, undefined, "dismissed capability does not come back this session");
  assert.equal(diagnostics.filter((d) => d.code === "VS5021").length, before + 2, "each change is still reported once");
  experience.setCapabilities({ "world-query": "temporarily-unavailable", "hand-tracking": "temporarily-unavailable" });
  assert.equal(diagnostics.filter((d) => d.code === "VS5021").length, before + 2, "a repeated state is not reported again");
});

test("unverified capabilities show only in builder mode, with the capability line", () => {
  const wearer = setup("hello");
  wearer.experience.setCapabilities({ "eye-gaze": "unverified" });
  assert.equal(wearer.experience.view().notice, undefined);
  const builder = setup("hello", { builderMode: true });
  builder.experience.setCapabilities({ "eye-gaze": "unverified" });
  assert.equal(builder.experience.view().notice.message, "Some features haven't been checked on this device.");
  assert.equal(builder.experience.view().notice.builderLine, "eye-gaze: unverified");
});

test("a scene without a gaze path shows the permission panel with Close instead of a notice", () => {
  const { experience } = setup("hello", { requirements: { placement: false, gazeOnly: false } });
  experience.setCapabilities({ "hand-tracking": "permission-required" });
  const view = experience.view();
  assert.equal(view.notice, undefined);
  assert.deepEqual(view.permissionPanel, {
    title: "Hand tracking is off",
    body: "Turn it on in Spectacles settings to use this scene.",
    actionLabel: "Close",
  });
  experience.closePermissionPanel();
  assert.equal(experience.view().permissionPanel, undefined);
});

test("drag-manipulation unsupported hides drag and adds Move buttons without a notice", () => {
  const { experience } = setup("interaction");
  experience.setCapabilities({ "drag-manipulation": "unsupported", "hand-tracking": "supported" });
  const view = experience.view();
  assert.equal(view.hidden.drag, true);
  assert.equal(view.gazeControls.moveButtons, true);
  assert.equal(view.inputMode, "hands");
  assert.equal(view.notice, undefined);
});

// --- Preferences -------------------------------------------------------------

test("high contrast and reduced motion apply at runtime without a restart", () => {
  const { experience, controller, scheduler } = setup("hello", { assets: "slow" });
  controller.present(fixture("hello"));
  experience.setPreferences({ highContrast: true, reducedMotion: true });
  scheduler.tick(200);
  experience.tick();
  const view = experience.view();
  assert.equal(view.tokens.color.surface, "#000000");
  assert.equal(view.tokens.color.text, "#ffffff");
  assert.equal(view.tokens.opacity.surface, 1);
  assert.equal(view.tokens.motion.hoverScale, 1);
  assert.equal(view.tokens.motion.appearScaleFrom, 1);
  assert.equal(view.loading.indicator, "arc-static", "reduced motion: no rotation");
});

// --- PanelButton --------------------------------------------------------------

test("PanelButton resolves seven distinct visual states from tokens, with shape cues and announced state", () => {
  const states = [
    ["idle", { hovered: false, pressed: false }],
    ["idle", { hovered: true, pressed: false }],
    ["idle", { hovered: true, pressed: true }],
    ["selected", { hovered: false, pressed: false }],
    ["disabled", { hovered: true, pressed: true }],
    ["loading", { hovered: true, pressed: false }],
    ["error", { hovered: false, pressed: false }],
  ];
  const visuals = states.map(([authored, interaction]) => resolveViroSpecsButtonVisual("Option A", authored, interaction, tokens));
  assert.deepEqual(visuals.map((v) => v.state), ["idle", "hover", "pressed", "selected", "disabled", "loading", "error"]);
  assert.equal(new Set(visuals.map((v) => JSON.stringify([v.fill, v.border, v.ring, v.depthMeters, v.labelColor, v.labelText, v.glyph]))).size, 7);
  const [idle, hover, pressed, selected, disabled, loading, error] = visuals;
  assert.equal(idle.fill, tokens.color.surfaceRaised);
  assert.equal(hover.scale, 1.04);
  assert.equal(hover.depthMeters, tokens.depth.hoverMeters);
  assert.equal(pressed.fill, tokens.color.surfacePressed);
  assert.equal(selected.glyph, "check");
  assert.equal(selected.accessibleName, "Option A, selected");
  assert.equal(disabled.accessibleName, "Option A, unavailable");
  assert.equal(disabled.accepts, false);
  assert.equal(disabled.labelColor, tokens.color.textDisabled);
  assert.equal(loading.labelText, "Working");
  assert.equal(loading.accepts, false);
  assert.equal(error.glyph, "error");
  assert.equal(error.border, tokens.color.error);
  for (const v of visuals) assert.ok(v.transitionMs <= tokens.motion.maxMs);

  const reduced = resolveViroSpecsTokens(VIRO_SPECS_LENS_DEFAULT_THEME, { highContrast: false, reducedMotion: true });
  assert.equal(resolveViroSpecsButtonVisual("A", "idle", { hovered: true, pressed: false }, reduced).scale, 1);
  const hc = resolveViroSpecsTokens(VIRO_SPECS_LENS_DEFAULT_THEME, { highContrast: true, reducedMotion: false });
  assert.equal(resolveViroSpecsButtonVisual("A", "idle", { hovered: true, pressed: false }, hc).borderWidthDeg, 0.6);
});

test("PanelButton press commits on release inside and cancels outside; disabled and loading ignore input", () => {
  const authored = { a: "idle", b: "selected", c: "disabled", r: "loading" };
  const feedback = [];
  const tracker = new ViroSpecsButtonTracker((id) => authored[id], (id) => feedback.push(id));
  const e = (nodeId, phase, source = "hand-right") => tracker.handle({ nodeId, phase, source });

  e("a", "hover-enter");
  e("a", "hover-enter");
  assert.deepEqual(feedback, ["a"], "hook fires once per hover");
  e("a", "select-start");
  assert.deepEqual(tracker.interactionOf("a"), { hovered: true, pressed: true });
  e("a", "hover-exit");
  e("b", "hover-enter");
  assert.equal(tracker.interactionOf("a").pressed, true, "press stays on the original target");
  assert.deepEqual(e("a", "select-end"), { nodeId: "a", source: "hand-right" });

  e("a", "select-start");
  assert.equal(e("b", "select-end"), undefined, "release outside cancels");
  assert.equal(tracker.interactionOf("a").pressed, false);

  e("a", "select-start", "hand-left");
  e("b", "select-start", "hand-right");
  assert.equal(tracker.interactionOf("a").pressed, false, "last select-start wins");
  assert.deepEqual(e("b", "select-end", "hand-right"), { nodeId: "b", source: "hand-right" });

  e("a", "select-start");
  e("a", "cancel");
  assert.equal(e("a", "select-end"), undefined, "cancel drops the press");

  for (const id of ["c", "r"]) {
    e(id, "hover-enter");
    e(id, "select-start");
    assert.equal(e(id, "select-end"), undefined);
    assert.deepEqual(tracker.interactionOf(id), { hovered: false, pressed: false });
  }
  assert.deepEqual(feedback, ["a", "b"], "no haptic on disabled or loading");

  tracker.setFeedbackEnabled(false);
  e("b", "hover-exit");
  e("b", "hover-enter");
  assert.deepEqual(feedback, ["a", "b"], "the app can turn the hook off");
});

// --- Gaze dwell -----------------------------------------------------------------

test("gaze dwell selects after 1000 ms, once, and never on disabled buttons", () => {
  assert.equal(tokens.input.gazeDwellMs, 1000);
  const selected = [];
  const dwell = new ViroSpecsGazeDwell(() => tokens.input.gazeDwellMs, (id) => id !== "disabled", (id) => selected.push(id));
  assert.equal(dwell.update("next", 0).progress, 0);
  assert.equal(dwell.update("next", 500).progress, 0.5);
  dwell.update("next", 999);
  assert.deepEqual(selected, []);
  dwell.update("next", 1000);
  dwell.update("next", 3000);
  assert.deepEqual(selected, ["next"], "fires once while the gaze stays");
  dwell.update(undefined, 3100);
  dwell.update("next", 3200);
  dwell.update("next", 4200);
  assert.deepEqual(selected, ["next", "next"], "re-arms after the gaze leaves");
  dwell.update("other", 4300);
  dwell.update("next", 4400);
  assert.equal(dwell.update("next", 5000).progress, 0.6, "switching targets restarts the fill");
  dwell.update("disabled", 0);
  assert.equal(dwell.update("disabled", 5000).progress, 0);
  assert.deepEqual(selected, ["next", "next"]);
});

test("a gaze dwell on the Interaction scene reaches the app as a select from source gaze", async () => {
  const { controller, experience } = setup("interaction");
  controller.present(fixture("interaction"));
  await flush();
  experience.setCapabilities({ "hand-tracking": "permission-required" });
  const doc = fixture("interaction");
  const authored = (id) => doc.nodes.find((n) => n.id === id)?.component?.state;
  const commits = [];
  const tracker = new ViroSpecsButtonTracker(authored);
  controller.addOnInteractionListener((event) => {
    const commit = tracker.handle(event);
    if (commit) commits.push(commit);
  });
  const dwell = new ViroSpecsGazeDwell(
    () => experience.view().tokens.input.gazeDwellMs,
    (id) => resolveViroSpecsButtonVisual("", authored(id) ?? "idle", { hovered: false, pressed: false }, tokens).accepts,
    (id) => {
      controller.dispatchInteraction({ nodeId: id, phase: "select-start", source: "gaze" });
      controller.dispatchInteraction({ nodeId: id, phase: "select-end", source: "gaze" });
    }
  );
  dwell.update("ix-next", 0);
  dwell.update("ix-next", 1000);
  dwell.update("ix-btn-disabled", 1100);
  dwell.update("ix-btn-disabled", 3000);
  assert.deepEqual(commits, [{ nodeId: "ix-next", source: "gaze" }]);
});

// --- Placement --------------------------------------------------------------------

test("surface classification: ground, walls, ceilings, and tables and seats by height above the floor", () => {
  assert.equal(classifyViroSpecsSurface({ position: [0, -1.5, -1], normal: [0, 1, 0], classification: "ground" }), "floor");
  assert.equal(classifyViroSpecsSurface({ position: [0, 0, -2], normal: [0, 0, 1] }), "wall");
  assert.equal(classifyViroSpecsSurface({ position: [0, 1, -1], normal: [0, -1, 0] }), "ceiling");
  assert.equal(classifyViroSpecsSurface({ position: [0, -0.8, -1], normal: [0, 1, 0] }), "table", "no floor known: horizontal reads as table");
  assert.equal(classifyViroSpecsSurface({ position: [0, -0.8, -1], normal: [0, 1, 0] }, { floorY: -1.6 }), "table");
  assert.equal(classifyViroSpecsSurface({ position: [0, -1.15, -1], normal: [0, 1, 0] }, { floorY: -1.6 }), "seat");
  assert.equal(classifyViroSpecsSurface({ position: [0, -1, -1], normal: [0, 0.6, 0.8] }), "unknown", "slopes are unknown");
});

const tableHit = { position: [0, -0.5, -1.2], normal: [0, 1, 0] };

test("placement: search, aim with surface tint, pinch to place", () => {
  const settled = [];
  const session = new ViroSpecsPlacementSession({ tokens, onSettled: (r) => settled.push(r) });
  let view = session.view();
  assert.equal(view.phase, "searching");
  assert.equal(view.visible, false);
  assert.equal(view.label, "Look at a table or the floor");
  session.update(tableHit, 0);
  view = session.view();
  assert.equal(view.phase, "aiming");
  assert.equal(view.label, "Table. Pinch to place.");
  assert.equal(view.tintColor, tokens.tint.table);
  assert.equal(view.tintOpacity, 0.35);
  assert.equal(view.ringColor, tokens.color.focus);
  assert.equal(view.accessibilityLabel, "Placement reticle on Table");
  assert.equal(view.hint, "Look away to cancel");
  assert.ok(Math.abs(viroSpecsMetersToAngle(view.diameterMeters, Math.hypot(0, -0.5, -1.2)) - 2) < 1e-9, "reticle is 2 degrees at the hit");
  const result = session.pinch();
  assert.deepEqual(result, { placed: true, position: tableHit.position, normal: tableHit.normal, surface: "table" });
  view = session.view();
  assert.equal(view.label, "Placed");
  assert.equal(view.ringColor, tokens.color.success);
  assert.deepEqual(settled, ["confirmed"]);
});

test("placement: looking away for 1.5 s cancels; any valid hit resets the timer", () => {
  const session = new ViroSpecsPlacementSession({ tokens });
  session.update(tableHit, 0);
  session.update(null, 100);
  assert.equal(session.currentPhase, "countdown");
  session.update(null, 1000);
  assert.ok(Math.abs(session.view().countdown - 0.6) < 1e-9);
  session.update(tableHit, 1500);
  assert.equal(session.currentPhase, "aiming", "valid hit resets");
  session.update(null, 1600);
  session.update(null, 3099);
  assert.equal(session.currentPhase, "countdown");
  session.update(null, 3100);
  assert.equal(session.currentPhase, "cancelled");
  assert.equal(session.view().label, "Placement cancelled");
  assert.deepEqual(session.pinch(), { placed: false });
  session.restart();
  session.update(tableHit, 4000);
  assert.equal(session.view().hint, undefined, "the cancel hint does not return after a cancel");
});

test("placement: unknown surfaces and hits outside the band show a muted reticle and cannot place", () => {
  const session = new ViroSpecsPlacementSession({ tokens });
  session.update(tableHit, 0);
  session.update({ position: [0, -0.5, -4], normal: [0, 1, 0] }, 50);
  let view = session.view();
  assert.equal(view.canPlace, false);
  assert.equal(view.ringColor, tokens.color.textMuted);
  assert.equal(view.tintColor, undefined);
  assert.deepEqual(session.pinch(), { placed: false });
  session.update({ position: [0, -0.3, -1], normal: [0, 0.6, 0.8] }, 100);
  view = session.view();
  assert.equal(view.surface, "unknown");
  assert.equal(view.canPlace, false);
  // Pinching during the countdown places when the hit became valid again.
  session.update(tableHit, 400);
  assert.equal(session.pinch().placed, true);
});

test("placement: the surface label changes no faster than motion.base; reduced motion uses words for the countdown", () => {
  const session = new ViroSpecsPlacementSession({ tokens, reducedMotion: true });
  session.update(tableHit, 0);
  session.update({ position: [0, -1.4, -1], normal: [0, 1, 0], classification: "ground" }, 100);
  assert.equal(session.view().label, "Table. Pinch to place.", "flip inside 240 ms keeps the old label");
  assert.equal(session.view().tintColor, tokens.tint.floor, "tint follows immediately");
  session.update({ position: [0, -1.4, -1], normal: [0, 1, 0], classification: "ground" }, 400);
  assert.equal(session.view().label, "Floor. Pinch to place.");
  session.update(null, 500);
  assert.equal(session.view().label, "Cancelling");
  assert.equal(session.view().countdown, 0);
});

// --- Comfort clamps -----------------------------------------------------------

test("drag and placement stop at the band edge with VS5023; small text is raised with VS5022", () => {
  const { experience, diagnostics } = setup("interaction");
  assert.deepEqual(experience.clampToComfortBand("m", [0, 0, -1.5]), [0, 0, -1.5]);
  const far = experience.clampToComfortBand("far", [0, 0, -4]);
  assert.ok(Math.abs(Math.hypot(...far) - 3) < 1e-9);
  const near = experience.clampToComfortBand("near", [0.1, 0, -0.2]);
  assert.ok(Math.abs(Math.hypot(...near) - 0.6) < 1e-9);
  assert.equal(diagnostics.filter((d) => d.code === "VS5023").length, 2);

  assert.equal(experience.minimumTextSize("t", 200, 1.5), 200);
  const raised = experience.minimumTextSize("t", 48, 2.5);
  assert.ok(viroSpecsMetersToAngle(raised * VIRO_SPECS_LENS_TEXT_EM_METERS_PER_SIZE, 2.5) >= 1.2);
  assert.equal(diagnostics.filter((d) => d.code === "VS5022").length, 1);
});

test("gaze Move and Scroll steps: 10 cm moves, one row per scroll press, clamped", () => {
  assert.deepEqual(stepViroSpecsMove([0, 0, -1.5], "left", 0.1), [-0.1, 0, -1.5]);
  const away = stepViroSpecsMove([0, 0, -1.5], "away", 0.1);
  assert.ok(Math.abs(Math.hypot(...away) - 1.6) < 1e-9);
  const scroll = { itemHeightMeters: 0.13, viewportHeightMeters: 0.3, contentHeightMeters: 0.52 };
  const first = stepViroSpecsScroll(0, "down", scroll);
  assert.ok(Math.abs(first - 0.13 / 0.22) < 1e-9);
  assert.equal(stepViroSpecsScroll(first, "down", scroll), 1);
  assert.equal(stepViroSpecsScroll(0, "up", scroll), 0);
  assert.equal(stepViroSpecsScroll(0.5, "down", { ...scroll, contentHeightMeters: 0.2 }), 0);
});

test("the experience controller detaches cleanly", () => {
  const { experience, controller } = setup("hello");
  const views = [];
  experience.addOnViewListener((v) => views.push(v));
  experience.dispose();
  experience.dispose();
  controller.present(fixture("hello"));
  assert.equal(views.length, 1, "no views after dispose");
});

// --- Review fixes --------------------------------------------------------------

test("the loading line advances as assets arrive, without a lifecycle change", async () => {
  const backend = new MockBackend();
  const scheduler = new ManualScheduler();
  const pending = [];
  backend.images.set(CARD_IMAGE, () => {
    const d = deferred();
    pending.push(d);
    return d.promise;
  });
  const controller = new ViroSpecsSceneController(backend, scheduler);
  const experience = new ViroSpecsExperienceController({ requirements: REQUIREMENTS.navigation, diagnostics: controller.diagnostics, nowMs: () => scheduler.nowMs() });
  experience.attach(controller);
  controller.present(fixture("navigation"));
  scheduler.tick(200);
  experience.tick();
  const total = controller.assetProgress.total;
  assert.equal(experience.view().loading.line, "Loading 0 of " + total);
  pending[0].resolve({ asset: "one" });
  await flush();
  assert.equal(controller.lifecycle, "loading");
  experience.tick();
  assert.equal(experience.view().loading.line, "Loading 1 of " + total);
});

test("a scene that commits after a rejected first scene clears the no-fallback panel", async () => {
  const { controller, experience } = setup("hello");
  controller.present({ version: 2, nodes: [{ id: "x", kind: "nope" }] });
  assert.equal(experience.view().errorPanel.kind, "scene-no-fallback");
  controller.present(fixture("hello"));
  await flush();
  assert.equal(experience.view().errorPanel, undefined);
  assert.equal(experience.view().sceneVisible, true);
});

test("the host reads #RRGGBBAA theme colors, like viro's validator and schema", () => {
  const theme = structuredClone(VIRO_SPECS_LENS_DEFAULT_THEME);
  theme.tokens.color.focus = "#f2b544cc";
  assert.equal(readViroSpecsSceneInput({ version: 2, nodes: [], theme }, 1).ok, true);
});

test("gaze dwell starts filling when a target becomes selectable, not when the gaze arrived", () => {
  let selectable = false;
  const selected = [];
  const dwell = new ViroSpecsGazeDwell(() => 1000, () => selectable, (id) => selected.push(id));
  dwell.update("retry", 0);
  dwell.update("retry", 3000);
  selectable = true;
  assert.equal(dwell.update("retry", 3001).progress, 0.001);
  assert.deepEqual(selected, []);
  dwell.update("retry", 4001);
  assert.deepEqual(selected, ["retry"]);
});

test("Move closer never passes through the wearer, and a drag excursion reports VS5023 once", () => {
  const closer = stepViroSpecsMove([0, 0, -0.05], "closer", 0.1);
  assert.deepEqual(closer.map((v) => Math.abs(v)), [0, 0, 0]);
  const { experience, diagnostics } = setup("interaction");
  for (let i = 0; i < 30; i++) experience.clampToComfortBand("m", [0, 0, -4 - i * 0.01]);
  experience.clampToComfortBand("m", [0, 0, -1.5]);
  experience.clampToComfortBand("m", [0, 0, -5]);
  assert.equal(diagnostics.filter((d) => d.code === "VS5023").length, 2);
});

test("premium features the host does not draw yet are named for VS5025", () => {
  for (const name of GALLERY) {
    for (const node of fixture(name).nodes) {
      const missing = unrenderedViroSpecsComponentFeatures(node.component);
      if (node.component?.type === "scroll-view") assert.deepEqual(missing, [], "scroll-view draws as a scroll group");
      if (node.component?.type === "model-viewer") assert.ok(missing.includes("resettable (Reset model button)"));
      if (["spatial-panel", "panel-text", "panel-button"].includes(node.component?.type)) assert.deepEqual(missing, []);
    }
  }
  assert.deepEqual(unrenderedViroSpecsComponentFeatures(undefined), []);
});

// SpatialScrollView: the gallery's nav-list is a scroll group, so the host
// scrolls it with ScrollWindow (mocked here with the same normalized range:
// 1 at the content top, -1 at the bottom).
const offsetOf = (state, scroll) => ((1 - state.scrollNormalized[1]) / 2) * (scroll.contentHeight - scroll.height);

test("navigation: nav-list is a scroll group stepping by itemHeightMeters from initialIndex", () => {
  const backend = new MockBackend();
  const scheduler = new ManualScheduler();
  const controller = new ViroSpecsSceneController(backend, scheduler);
  const doc = fixture("navigation");
  const list = doc.nodes.find((n) => n.id === "nav-list");
  assert.equal(list.kind, "group");
  assert.deepEqual(list.scroll, { width: 0.48, height: 0.3, contentHeight: 0.56 });
  assert.equal(controller.present(doc).status, "committed");
  const handle = controller.getNodeHandle("nav-list");
  assert.deepEqual(handle.state.scrollRows, { stepMeters: 0.13, initialOffsetMeters: 0 });
  assert.deepEqual(handle.state.scrollNormalized, [0, 1], "initialIndex 0 starts at the top");

  // initialIndex 1 starts one row down; an index past the end stops at the bottom.
  for (const [index, offset] of [[1, 0.13], [9, 0.26]]) {
    const other = new ViroSpecsSceneController(new MockBackend(), new ManualScheduler());
    const moved = JSON.parse(JSON.stringify(doc));
    moved.nodes.find((n) => n.id === "nav-list").component.initialIndex = index;
    other.present(moved);
    const state = other.getNodeHandle("nav-list").state;
    assert.ok(Math.abs(offsetOf(state, list.scroll) - offset) < 1e-9, "initialIndex " + index);
  }
});

test("navigation: cards 5-8 scroll into the window, and the position survives an update", () => {
  const backend = new MockBackend();
  const controller = new ViroSpecsSceneController(backend, new ManualScheduler());
  const doc = fixture("navigation");
  controller.present(doc);
  const list = doc.nodes.find((n) => n.id === "nav-list");
  const visible = () => {
    // Content y = 0 is the window top; the window shows [-offset - height, -offset].
    const offset = offsetOf(controller.getNodeState("nav-list"), list.scroll);
    const top = -offset;
    const bottom = top - list.scroll.height;
    return doc.nodes
      .filter((n) => n.parentId === "nav-list")
      .filter((n) => n.position[1] + n.extents.height / 2 <= top + 1e-9 && n.position[1] - n.extents.height / 2 >= bottom - 1e-9)
      .map((n) => n.id);
  };
  assert.deepEqual(visible(), ["nav-card-1", "nav-card-2", "nav-card-3", "nav-card-4"]);
  assert.equal(controller.scrollByRows("nav-list", 2), true);
  assert.deepEqual(visible(), ["nav-card-5", "nav-card-6", "nav-card-7", "nav-card-8"]);
  // Past the end clamps; a non-scroll node is refused.
  controller.scrollByRows("nav-list", 5);
  assert.deepEqual(visible(), ["nav-card-5", "nav-card-6", "nav-card-7", "nav-card-8"]);
  assert.equal(controller.scrollByRows("nav-card-1", 1), false);
  assert.equal(controller.scrollByRows("missing", 1), false);

  const patched = JSON.parse(JSON.stringify(doc));
  patched.nodes.find((n) => n.id === "nav-title").text = "Exhibits";
  controller.update(patched);
  assert.deepEqual(visible(), ["nav-card-5", "nav-card-6", "nav-card-7", "nav-card-8"], "kept across a patch");
  controller.scrollByRows("nav-list", -1);
  assert.deepEqual(visible(), ["nav-card-3", "nav-card-4", "nav-card-5", "nav-card-6"]);
});

test("navigation: the scroll position is kept per route across navigation and back", () => {
  const controller = new ViroSpecsSceneController(new MockBackend(), new ManualScheduler());
  const list = { ...fixture("navigation"), route: "list" };
  const details = { version: 2, route: "details", nodes: [{ id: "detail-title", kind: "text", text: "Card 6", position: [0, 0, -1.5] }] };
  controller.present(list);
  controller.scrollByRows("nav-list", 2);
  const kept = controller.getNodeState("nav-list").scrollNormalized.slice();
  assert.ok(Math.abs(kept[1] + 1) < 1e-9, "scrolled to the bottom");
  assert.equal(controller.present(details).status, "committed");
  assert.equal(controller.present(list).status, "committed");
  assert.deepEqual(controller.getNodeState("nav-list").scrollNormalized, kept, "back restores the remembered position, not initialIndex");
});
