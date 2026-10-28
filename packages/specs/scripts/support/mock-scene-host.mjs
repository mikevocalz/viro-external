// Mock backend and scheduler for ViroSpecsSceneController tests. The backend
// keeps a SceneObject-like tree and records every call, so tests can assert
// which nodes an operation touched and that nothing leaks.

export class ManualScheduler {
  constructor() {
    this.frame = [];
    this.timers = [];
    this.timeMs = 0;
  }

  nextFrame(callback) {
    const job = { callback, cancelled: false };
    this.frame.push(job);
    return () => {
      job.cancelled = true;
    };
  }

  after(seconds, callback) {
    const job = { at: this.timeMs + seconds * 1000, callback, cancelled: false };
    this.timers.push(job);
    return () => {
      job.cancelled = true;
    };
  }

  nowMs() {
    return this.timeMs;
  }

  /** Live (uncancelled) jobs still queued. */
  get queued() {
    return this.frame.filter((j) => !j.cancelled).length + this.timers.filter((j) => !j.cancelled).length;
  }

  /** Advances one frame of `ms` milliseconds. */
  tick(ms = 16) {
    this.timeMs += ms;
    const frame = this.frame;
    this.frame = [];
    for (const job of frame) if (!job.cancelled) job.callback();
    const due = this.timers.filter((j) => j.at <= this.timeMs);
    this.timers = this.timers.filter((j) => j.at > this.timeMs);
    for (const job of due) if (!job.cancelled) job.callback();
  }

  /** Runs frames until nothing is queued, at most `limit`. */
  drain(limit = 100) {
    for (let i = 0; i < limit && (this.frame.length || this.timers.length); i++) this.tick(100);
  }
}

let handleCounter = 0;

export class MockBackend {
  constructor() {
    this.calls = [];
    this.handles = [];
    this.images = new Map();
    this.models = new Map();
    this.registeredMaterials = new Map();
    this.fonts = new Set();
    this.createdMaterials = [];
    this.disposedMaterials = [];
    this.bindings = [];
    this.animations = [];
    this.placeholderAvailable = true;
    /** (call, id) => true to make that call throw. */
    this.failOn = () => false;
  }

  record(call, handle, extra = {}) {
    this.calls.push({ call, id: handle?.id, handle, ...extra });
    if (this.failOn(call, handle?.id)) throw new Error("mock " + call + " failed for " + handle?.id);
  }

  make(id, kind, parent) {
    const handle = {
      key: ++handleCounter,
      id,
      kind,
      parent: parent ?? null,
      children: [],
      alive: true,
      enabled: true,
      visible: true,
      state: {},
    };
    if (parent) parent.children.push(handle);
    this.handles.push(handle);
    return handle;
  }

  /** Live handles that are not scene roots. */
  liveNodes() {
    return this.handles.filter((h) => h.alive && h.kind !== "root");
  }

  liveRoots() {
    return this.handles.filter((h) => h.alive && h.kind === "root");
  }

  callsSince(index) {
    return this.calls.slice(index);
  }

  createSceneRoot(revision) {
    const handle = this.make("root:" + revision, "root", null);
    this.record("createSceneRoot", handle);
    return handle;
  }

  setEnabled(handle, enabled) {
    this.record("setEnabled", handle, { enabled });
    handle.enabled = enabled;
  }

  createNode(spec, parent) {
    if (!parent.alive) throw new Error("parent is destroyed");
    const handle = this.make(spec.id, spec.kind, parent);
    this.record("createNode", handle);
    return handle;
  }

  setParent(handle, parent) {
    this.record("setParent", handle, { parentId: parent.id });
    if (handle.parent) handle.parent.children = handle.parent.children.filter((c) => c !== handle);
    handle.parent = parent;
    parent.children.push(handle);
  }

  destroy(handle) {
    this.record("destroy", handle);
    const kill = (h) => {
      h.alive = false;
      for (const material of h.state.ownedClones ?? []) this.disposedMaterials.push(material);
      for (const child of h.children) kill(child);
    };
    kill(handle);
    if (handle.parent) handle.parent.children = handle.parent.children.filter((c) => c !== handle);
  }

  setTransform(handle, transform) {
    this.record("setTransform", handle);
    handle.state.transform = transform;
  }

  setVisible(handle, visible) {
    this.record("setVisible", handle);
    handle.visible = visible;
  }

  setOpacity(handle, opacity) {
    this.record("setOpacity", handle);
    handle.state.opacity = opacity;
  }

  setText(handle, text) {
    this.record("setText", handle);
    handle.state.text = text;
  }

  setExtents(handle, extents) {
    this.record("setExtents", handle);
    handle.state.extents = extents;
  }

  setScroll(handle, scroll) {
    this.record("setScroll", handle);
    handle.state.scroll = scroll;
    if (!handle.state.scrollNormalized) handle.state.scrollNormalized = [0, 1];
  }

  setAsset(handle, asset) {
    this.record("setAsset", handle);
    handle.state.asset = asset;
  }

  showPlaceholder(handle, extents) {
    this.record("showPlaceholder", handle);
    if (!this.placeholderAvailable) return false;
    handle.state.placeholder = extents;
    return true;
  }

  clearPlaceholder(handle) {
    this.record("clearPlaceholder", handle);
    delete handle.state.placeholder;
  }

  setMaterial(handle, material) {
    this.record("setMaterial", handle);
    handle.state.material = material;
  }

  loadAsset(kind, source) {
    const table = kind === "image" ? this.images : this.models;
    const entry = table.get(source);
    if (typeof entry === "function") return entry();
    return entry ?? null;
  }

  resolveMaterial(id) {
    return this.registeredMaterials.get(id) ?? null;
  }

  createMaterial(definition, texture) {
    const material = { owned: true, definition, texture, key: ++handleCounter };
    this.createdMaterials.push(material);
    return material;
  }

  disposeMaterial(material) {
    this.disposedMaterials.push(material);
  }

  hasFont(family) {
    return this.fonts.has(family);
  }

  createLight(light, parent) {
    const handle = this.make(light.id, "light", parent);
    handle.state.light = light;
    this.record("createLight", handle);
    return handle;
  }

  createPolyline(line, material, parent) {
    const handle = this.make(line.id, "polyline", parent);
    handle.state.line = line;
    handle.state.material = material;
    this.record("createPolyline", handle);
    return handle;
  }

  bindInteraction(handle, interaction, emit) {
    this.record("bindInteraction", handle);
    const binding = { handle, interaction, emit, active: true };
    this.bindings.push(binding);
    return () => {
      if (binding.active) this.calls.push({ call: "unbind", id: handle.id, handle });
      binding.active = false;
    };
  }

  /** Fires an SIK-like event on the latest binding for `id`, live or not. */
  fire(id, event) {
    const binding = [...this.bindings].reverse().find((b) => b.handle.id === id);
    if (!binding) throw new Error("no binding for " + id);
    if (binding.active && binding.handle.alive) binding.emit(event);
    return binding;
  }

  playAnimation(handle, plan, onComplete) {
    this.record("playAnimation", handle);
    const animation = { handle, plan, onComplete, active: true };
    this.animations.push(animation);
    return () => {
      animation.active = false;
    };
  }

  captureUiState(handle) {
    return handle.state.scrollNormalized ? { scrollNormalized: handle.state.scrollNormalized.slice() } : {};
  }

  restoreUiState(handle, state) {
    this.record("restoreUiState", handle);
    if (state.scrollNormalized) handle.state.scrollNormalized = state.scrollNormalized.slice();
  }
}
