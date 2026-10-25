import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { allocateRiveSurfaceId } from "../src/rive/allocateRiveSurfaceId.ts";
import { createRiveBindingWriter } from "../src/rive/createRiveBindingWriter.ts";
import { createRivePanelPointerSink } from "../src/rive/createRivePanelPointerSink.ts";
import { mountNativeRivePanel } from "../src/rive/mountNativeRivePanel.ts";
import { resolveNativeRive } from "../src/rive/resolveNativeRive.ts";

const flush = () => new Promise((resolve) => setImmediate(resolve));

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

// Records the calls mountNativeRivePanel makes on the native classes.
function createFakeRive({ createGate } = {}) {
  const log = [];
  const panels = [];
  const files = [];
  const RiveFile = {
    async fromBytes(bytes) {
      const file = { byteLength: bytes.byteLength, disposed: false, dispose() { this.disposed = true; log.push("file.dispose"); } };
      files.push(file);
      log.push("fromBytes");
      return file;
    },
  };
  const RivePanel = {
    isAvailable: true,
    async create(options) {
      log.push("create");
      if (createGate) await createGate.promise;
      const listeners = new Set();
      const panel = {
        options,
        disposed: false,
        updates: [],
        active: [],
        pointers: [],
        viewModelInstance: { applyUpdate: (update) => panel.updates.push(update) },
        setActive: (value) => panel.active.push(value),
        dispatchPointer: (...args) => panel.pointers.push(args),
        addOnStateChangedListener(listener) {
          listeners.add(listener);
          return { remove: () => { listeners.delete(listener); log.push("listener.remove"); } };
        },
        emit(state, detail = "") { for (const listener of listeners) listener(state, detail); },
        dispose() { panel.disposed = true; log.push("panel.dispose"); },
      };
      panels.push(panel);
      return panel;
    },
  };
  return { rive: { RiveFile, RivePanel }, log, panels, files };
}

function createFakeMaterials(log) {
  const created = [];
  const deleted = [];
  return {
    created,
    deleted,
    createMaterials(dict) { created.push(dict); log.push("createMaterials"); },
    deleteMaterials(names) { deleted.push(names); log.push("deleteMaterials"); },
  };
}

function mountOptions(fake, materials, overrides = {}) {
  const events = { panels: [], states: [], errors: [] };
  const options = {
    rive: fake.rive,
    materials,
    rivBytes: new Uint8Array([82, 73, 86, 69]).buffer,
    artboardName: "BoardChrome",
    stateMachineName: "BoardChrome",
    fit: "contain",
    surfaceId: 1314914304,
    materialName: "chrome",
    widthPx: 2496,
    heightPx: 1560,
    widthM: 0.6,
    heightM: 0.375,
    cornerRadiusM: 0.021,
    lightingModel: "Constant",
    fallbackColor: "#ffffff",
    blendMode: "PremultiplyAlpha",
    maxFrameRateHz: 72,
    onPanel: (panel) => events.panels.push(panel),
    onState: (state, detail) => events.states.push([state, detail]),
    onError: (error) => events.errors.push(error),
    ...overrides,
  };
  return { options, events };
}

describe("mountNativeRivePanel", () => {
  test("creates a premultiplied, rounded canvasSource material before the panel", async () => {
    const fake = createFakeRive();
    const materials = createFakeMaterials(fake.log);
    const { options, events } = mountOptions(fake, materials);
    const mount = mountNativeRivePanel(options);
    assert.deepEqual(materials.created, [{
      chrome: {
        diffuseTexture: {
          canvasSource: 1314914304, width: 2496, height: 1560,
          cornerRadius: 0.021, panelWidth: 0.6, panelHeight: 0.375,
        },
        diffuseColor: "#ffffff",
        lightingModel: "Constant",
        blendMode: "PremultiplyAlpha",
      },
    }]);
    await flush();
    assert.equal(events.panels.length, 1);
    const [panel] = fake.panels;
    assert.deepEqual(
      { ...panel.options, file: undefined },
      {
        surfaceId: 1314914304, widthPx: 2496, heightPx: 1560, file: undefined,
        artboardName: "BoardChrome", stateMachineName: "BoardChrome", fit: "contain",
        alignmentX: 0, alignmentY: 0, cornerRadiusM: 0.021, panelWidthM: 0.6, panelHeightM: 0.375,
        maxFrameRateHz: 72,
      },
    );
    assert.equal(fake.files[0].disposed, true, "the file is released once the panel copied it");
    mount.dispose();
  });

  test("square corners leave the corner keys off the material", () => {
    const fake = createFakeRive();
    const materials = createFakeMaterials(fake.log);
    const { options } = mountOptions(fake, materials, { cornerRadiusM: 0 });
    const mount = mountNativeRivePanel(options);
    assert.deepEqual(materials.created[0].chrome.diffuseTexture, { canvasSource: 1314914304, width: 2496, height: 1560 });
    mount.dispose();
  });

  test("dispose ends the listener and the panel before deleting the material", async () => {
    const fake = createFakeRive();
    const materials = createFakeMaterials(fake.log);
    const { options } = mountOptions(fake, materials);
    const mount = mountNativeRivePanel(options);
    await flush();
    mount.dispose();
    mount.dispose();
    const tail = fake.log.slice(fake.log.indexOf("listener.remove"));
    assert.deepEqual(tail, ["listener.remove", "panel.dispose", "deleteMaterials"]);
    assert.deepEqual(materials.deleted, [["chrome"]], "dispose is idempotent");
  });

  test("a panel that arrives after dispose is disposed and never reported", async () => {
    const gate = deferred();
    const fake = createFakeRive({ createGate: gate });
    const materials = createFakeMaterials(fake.log);
    const { options, events } = mountOptions(fake, materials);
    const mount = mountNativeRivePanel(options);
    await flush();
    mount.dispose();
    gate.resolve();
    await flush();
    assert.equal(fake.panels[0].disposed, true);
    assert.equal(events.panels.length, 0);
    assert.deepEqual(materials.deleted, [["chrome"]]);
  });

  test("forwards state changes until disposed", async () => {
    const fake = createFakeRive();
    const materials = createFakeMaterials(fake.log);
    const { options, events } = mountOptions(fake, materials);
    const mount = mountNativeRivePanel(options);
    await flush();
    fake.panels[0].emit("active");
    fake.panels[0].emit("active", "unknown property tool");
    mount.dispose();
    fake.panels[0].emit("disposed");
    assert.deepEqual(events.states, [["active", ""], ["active", "unknown property tool"]]);
  });

  test("reports a rejected create through onError and keeps the material until dispose", async () => {
    const fake = createFakeRive();
    fake.rive.RivePanel.create = async () => { throw new Error("RivePanel widthPx must be an integer"); };
    const materials = createFakeMaterials(fake.log);
    const { options, events } = mountOptions(fake, materials);
    const mount = mountNativeRivePanel(options);
    await flush();
    assert.equal(events.errors.length, 1);
    assert.match(events.errors[0].message, /widthPx/);
    assert.deepEqual(materials.deleted, []);
    mount.dispose();
    assert.deepEqual(materials.deleted, [["chrome"]]);
  });
});

describe("createRiveBindingWriter", () => {
  test("sends only changed values, grouped by type", () => {
    const writer = createRiveBindingWriter();
    const first = writer.diff({ tool: 2, canUndo: true, status: "ready", clear: { kind: "trigger", serial: 1 } });
    assert.deepEqual(first.update, {
      numbers: { tool: 2 }, booleans: { canUndo: true }, strings: { status: "ready" }, triggers: ["clear"],
    });
    assert.equal(writer.diff({ tool: 2, canUndo: true, status: "ready", clear: { kind: "trigger", serial: 1 } }).update, undefined);
    assert.deepEqual(writer.diff({ tool: 3, canUndo: true, status: "ready", clear: { kind: "trigger", serial: 2 } }).update, {
      numbers: { tool: 3 }, triggers: ["clear"],
    });
  });

  test("a value that changes type is sent again", () => {
    const writer = createRiveBindingWriter();
    writer.diff({ status: "1" });
    assert.deepEqual(writer.diff({ status: 1 }).update, { numbers: { status: 1 } });
  });

  test("enum and color are reported once and never sent", () => {
    const writer = createRiveBindingWriter();
    const first = writer.diff({ mode: { kind: "enum", value: "night" }, tint: { kind: "color", value: 255 } });
    assert.equal(first.update, undefined);
    assert.deepEqual(first.unsupportedPaths, ["mode", "tint"]);
    assert.deepEqual(writer.diff({ mode: { kind: "enum", value: "day" } }).unsupportedPaths, []);
  });

  test("reset resends every value to a new panel", () => {
    const writer = createRiveBindingWriter();
    writer.diff({ tool: 1 });
    writer.reset();
    assert.deepEqual(writer.diff({ tool: 1 }).update, { numbers: { tool: 1 } });
  });
});

describe("createRivePanelPointerSink", () => {
  test("maps paper UV to panel pixels and keeps the pointer id", () => {
    const calls = [];
    const sink = createRivePanelPointerSink({ dispatchPointer: (...args) => calls.push(args) }, { widthPx: 2496, heightPx: 1560 });
    sink({ phase: "down", pointerId: 3, uv: [0.5, 0.25] });
    sink({ phase: "move", pointerId: 3, uv: [1, 1] });
    sink({ phase: "hover", pointerId: 4, uv: [0.1, 0.1] });
    sink({ phase: "leave", pointerId: 4, uv: [0.1, 0.1] });
    sink({ phase: "cancel", pointerId: 3, uv: [1, 1] });
    assert.deepEqual(calls, [
      ["down", 1248, 390, 3],
      ["move", 2496, 1560, 3],
      ["cancel", 2496, 1560, 3],
    ]);
  });
});

describe("allocateRiveSurfaceId", () => {
  test("hands out distinct int32 ids above the nitro-canvas range", () => {
    const a = allocateRiveSurfaceId();
    const b = allocateRiveSurfaceId();
    assert.notEqual(a, b);
    for (const id of [a, b]) {
      assert.ok(Number.isInteger(id) && id >= 0x4e500000 && id <= 0x7fffffff);
    }
  });
});

describe("resolveNativeRive", () => {
  test("is undefined until both classes are registered and the panel is available", () => {
    const classes = globalThis.__fakeNitro.classes;
    classes.clear();
    assert.equal(resolveNativeRive(), undefined);
    const RiveFile = { fromBytes() {} };
    const RivePanel = { isAvailable: false, create() {} };
    classes.set("nativepanels.RivePanel", RivePanel);
    assert.equal(resolveNativeRive(), undefined, "RiveFile missing");
    classes.set("nativepanels.RiveFile", RiveFile);
    assert.equal(resolveNativeRive(), undefined, "isAvailable false");
    RivePanel.isAvailable = true;
    const runtime = resolveNativeRive();
    assert.equal(runtime?.RivePanel, RivePanel);
    assert.equal(runtime?.RiveFile, RiveFile);
    classes.clear();
  });
});
