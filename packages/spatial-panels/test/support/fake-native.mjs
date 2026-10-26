// A fake ViroSpatialPanels module and CompositorPanel shared object that
// record calls and let a test emit native events.

export function createFakePanel(id) {
  const listeners = new Map();
  const calls = [];
  const panel = {
    id,
    presentation: { presentation: "pending", reason: "none", hasFallback: false },
    status: { state: "initializing", detail: "" },
    calls,
    addListener(name, listener) {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name).add(listener);
      return { remove: () => listeners.get(name)?.delete(listener) };
    },
    emit(name, payload) {
      for (const listener of [...(listeners.get(name) ?? [])]) listener(payload);
    },
    listenerCount(name) {
      return listeners.get(name)?.size ?? 0;
    },
  };
  for (const method of [
    "setPose",
    "setVisible",
    "setNumber",
    "setBoolean",
    "setString",
    "fireTrigger",
    "dispatchPointer",
    "setActive",
    "bindFallbackMaterial",
    "dispose",
  ]) {
    panel[method] = (...args) => {
      calls.push([method, ...args]);
      return true;
    };
  }
  return panel;
}

export function createFakeModule({ rejectWith } = {}) {
  const created = [];
  return {
    created,
    async getCapabilities() {
      return { isSessionReady: true, supportsCylinder: true, maxPanels: 14, supportsRive: true };
    },
    async createRiveCompositorPanel(options, file) {
      if (rejectWith) throw rejectWith;
      const panel = createFakePanel(options.id);
      created.push({ options, file, panel });
      return panel;
    },
  };
}

export function createFakeMaterials() {
  const registered = new Map();
  const deleted = [];
  return {
    registered,
    deleted,
    createMaterials(materials) {
      for (const [name, value] of Object.entries(materials)) registered.set(name, value);
    },
    deleteMaterials(names) {
      for (const name of names) {
        registered.delete(name);
        deleted.push(name);
      }
    },
  };
}
