import assert from "node:assert/strict";
import { test } from "node:test";

import { createSpatialPanelsHost } from "../src/createSpatialPanelsHost.ts";
import { fallbackMaterialName } from "../src/fallback/fallbackMaterialName.ts";
import { createFakeMaterials, createFakeModule } from "./support/fake-native.mjs";

const RIV = new Uint8Array([0x52, 0x49, 0x56, 0x45]);

function options(overrides = {}) {
  return {
    id: "tools",
    pose: { position: [0, 1.2, -1.4], orientation: [0, 0, 0, 1] },
    widthM: 0.6,
    heightM: 0.375,
    widthPx: 1248,
    heightPx: 780,
    cornerRadiusM: 0.021,
    content: { kind: "rive", file: RIV, artboard: "BoardChrome", stateMachine: "BoardChrome" },
    ...overrides,
  };
}

async function setup(overrides) {
  const module = createFakeModule();
  const materials = createFakeMaterials();
  const host = createSpatialPanelsHost(module, materials);
  const handle = await host.createCompositorPanel(options(overrides));
  const native = module.created[0].panel;
  return { module, materials, host, handle, native };
}

const evicted = (hasFallback) => ({ presentation: "evicted", reason: "layer-budget", hasFallback });
const compositor = { presentation: "compositor", reason: "none", hasFallback: true };

test("unavailable module: no panels, all-false capabilities", async () => {
  const host = createSpatialPanelsHost(null, createFakeMaterials());
  assert.equal(host.isAvailable, false);
  assert.deepEqual(await host.getCapabilities(), {
    isSessionReady: false,
    supportsCylinder: false,
    maxPanels: 0,
    supportsRive: false,
  });
  await assert.rejects(host.createCompositorPanel(options()), { name: "SpatialPanelsError", code: "COMPOSITOR_UNAVAILABLE" });
});

test("create forwards options, registers a premultiplied material and binds it", async () => {
  const { module, materials, native } = await setup();
  const { options: sent, file } = module.created[0];
  assert.equal(file, RIV);
  assert.equal(sent.shape, "quad");
  assert.deepEqual(sent.position, [0, 1.2, -1.4]);
  assert.equal(sent.cornerRadiusM, 0.021);
  assert.equal(sent.artboard, "BoardChrome");
  assert.equal(sent.fit, "contain");
  const name = fallbackMaterialName("tools");
  const material = materials.registered.get(name);
  assert.equal(material.blendMode, "PremultiplyAlpha");
  assert.equal(material.lightingModel, "Constant");
  assert.equal(material.writesToDepthBuffer, false);
  assert.deepEqual(native.calls.filter((c) => c[0] === "bindFallbackMaterial"), [["bindFallbackMaterial", name]]);
});

test("fallback shows while evicted with a bound texture and hides on compositor", async () => {
  const { handle, native } = await setup();
  assert.equal(handle.fallback.getState().isFallbackVisible, false);

  native.emit("presentationChange", evicted(true));
  assert.equal(handle.fallback.getState().isFallbackVisible, true);
  assert.equal(handle.getPresentation().reason, "layer-budget");

  native.emit("presentationChange", compositor);
  assert.equal(handle.fallback.getState().isFallbackVisible, false);

  native.emit("presentationChange", { presentation: "evicted", reason: "layer-limit-exceeded", hasFallback: true });
  assert.equal(handle.fallback.getState().isFallbackVisible, true);
});

test("evicted before the texture is bound: stays hidden and asks to bind again", async () => {
  const { handle, native } = await setup();
  native.emit("presentationChange", evicted(false));
  assert.equal(handle.fallback.getState().isFallbackVisible, false);
  assert.equal(native.calls.filter((c) => c[0] === "bindFallbackMaterial").length, 2);

  native.emit("presentationChange", evicted(true));
  assert.equal(handle.fallback.getState().isFallbackVisible, true);
});

test('presentation ["compositor"] never registers or shows a scene fallback', async () => {
  const { materials, handle, native } = await setup({ presentation: ["compositor"] });
  assert.equal(materials.registered.size, 0);
  assert.equal(native.calls.some((c) => c[0] === "bindFallbackMaterial"), false);
  native.emit("presentationChange", evicted(true));
  assert.equal(handle.fallback.getState().isFallbackVisible, false);
});

test("hiding the panel hides the fallback; pose moves layer and mesh", async () => {
  const { handle, native } = await setup();
  native.emit("presentationChange", evicted(true));
  handle.setVisible(false);
  assert.equal(handle.fallback.getState().isFallbackVisible, false);
  handle.setVisible(true);
  assert.equal(handle.fallback.getState().isFallbackVisible, true);

  const pose = { position: [0.2, 1.1, -1.5], orientation: [0, 0.3826834, 0, 0.9238795] };
  handle.setPose(pose);
  assert.deepEqual(native.calls.at(-1), ["setPose", [0.2, 1.1, -1.5], [0, 0.3826834, 0, 0.9238795]]);
  assert.deepEqual(handle.fallback.getState().pose, pose);
  assert.throws(() => handle.setPose({ position: [0, 0], orientation: [0, 0, 0, 1] }), { code: "PANEL_INVALID_ARGUMENT" });
});

test("listeners receive presentation and status, and removal stops them", async () => {
  const { handle, native } = await setup();
  const seen = [];
  const subscription = handle.addOnPresentationChangeListener((change) => seen.push(change.presentation));
  const statuses = [];
  handle.addOnStatusChangeListener((change) => statuses.push(change));
  native.emit("presentationChange", evicted(true));
  native.emit("statusChange", { state: "lost", detail: "context lost" });
  subscription.remove();
  native.emit("presentationChange", compositor);
  assert.deepEqual(seen, ["evicted"]);
  assert.deepEqual(statuses, [{ state: "lost", detail: "context lost" }]);
});

test("dispose is idempotent, releases native and material, and ignores later events", async () => {
  const { materials, handle, native } = await setup();
  native.emit("presentationChange", evicted(true));
  handle.dispose();
  handle.dispose();
  assert.equal(native.calls.filter((c) => c[0] === "dispose").length, 1);
  assert.deepEqual(materials.deleted, [fallbackMaterialName("tools")]);
  assert.equal(handle.fallback.getState().isDisposed, true);
  assert.equal(handle.fallback.getState().isFallbackVisible, false);
  assert.equal(native.listenerCount("presentationChange"), 0);
  assert.equal(handle.setNumber("tool", 2), false);
  const before = native.calls.length;
  handle.setPose({ position: [0, 0, -1], orientation: [0, 0, 0, 1] });
  handle.setVisible(true);
  assert.equal(native.calls.length, before);
});

test("view-model writes and pointers reach the native panel", async () => {
  const { handle, native } = await setup();
  assert.equal(handle.setNumber("tool", 3), true);
  assert.equal(handle.setBoolean("paletteOpen", true), true);
  assert.equal(handle.fireTrigger("clear"), true);
  assert.equal(handle.dispatchPointer({ action: "down", xPx: 10, yPx: 20, pointerId: 1 }), true);
  assert.deepEqual(native.calls.slice(-4), [
    ["setNumber", "tool", 3],
    ["setBoolean", "paletteOpen", true],
    ["fireTrigger", "clear"],
    ["dispatchPointer", "down", 10, 20, 1],
  ]);
});

test("native rejections keep their code; unknown failures map to COMPOSITOR_UNAVAILABLE", async () => {
  const duplicate = Object.assign(new Error("panel ID already registered"), { code: "PANEL_DUPLICATE_ID" });
  const host = createSpatialPanelsHost(createFakeModule({ rejectWith: duplicate }), createFakeMaterials());
  await assert.rejects(host.createCompositorPanel(options()), { code: "PANEL_DUPLICATE_ID", message: "panel ID already registered" });

  const odd = createSpatialPanelsHost(createFakeModule({ rejectWith: new Error("boom") }), createFakeMaterials());
  await assert.rejects(odd.createCompositorPanel(options()), { code: "COMPOSITOR_UNAVAILABLE" });
});

test("invalid options are rejected before reaching native", async () => {
  const module = createFakeModule();
  const host = createSpatialPanelsHost(module, createFakeMaterials());
  const cases = [
    [{ id: "" }, "PANEL_INVALID_ARGUMENT"],
    [{ widthM: -1 }, "PANEL_INVALID_ARGUMENT"],
    [{ widthPx: 8 }, "PANEL_INVALID_ARGUMENT"],
    [{ cornerRadiusM: Number.NaN }, "PANEL_INVALID_ARGUMENT"],
    [{ shape: "cylinder" }, "PANEL_INVALID_ARGUMENT"],
    [{ presentation: ["scene"] }, "PANEL_INVALID_ARGUMENT"],
    [{ content: { kind: "rive", file: new Uint8Array(0) } }, "PANEL_INVALID_RIVE_FILE"],
    [{ content: { kind: "rive", file: new Uint8Array([0x89, 0x50, 0x4e, 0x47]) } }, "PANEL_INVALID_RIVE_FILE"],
    [{ content: { kind: "rive", file: new Uint8Array([0x52, 0x49, 0x56]) } }, "PANEL_INVALID_RIVE_FILE"],
  ];
  for (const [overrides, code] of cases) {
    await assert.rejects(host.createCompositorPanel(options(overrides)), { code }, JSON.stringify(overrides));
  }
  assert.equal(module.created.length, 0);
});

test("a .riv over 64 MiB is rejected before reaching native", async () => {
  const module = createFakeModule();
  const host = createSpatialPanelsHost(module, createFakeMaterials());
  const file = new Uint8Array(64 * 1024 * 1024 + 1);
  file.set(RIV);
  await assert.rejects(host.createCompositorPanel(options({ content: { kind: "rive", file } })), {
    code: "PANEL_INVALID_RIVE_FILE",
    message: /64 MiB/,
  });
  assert.equal(module.created.length, 0);
});

test("the initial presentation comes from the native snapshot", async () => {
  const module = createFakeModule();
  const original = module.createRiveCompositorPanel;
  module.createRiveCompositorPanel = async (...args) => {
    const panel = await original(...args);
    panel.presentation = { presentation: "evicted", reason: "layer-budget", hasFallback: true };
    return panel;
  };
  const host = createSpatialPanelsHost(module, createFakeMaterials());
  const handle = await host.createCompositorPanel(options());
  assert.equal(handle.fallback.getState().isFallbackVisible, true);
});
