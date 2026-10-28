/**
 * ViroSpecsSceneController: the Lens-side owner of one live Specs scene.
 *
 * Two ways in:
 *
 * - {@linkcode ViroSpecsSceneController.present} replaces the scene
 *   (navigation). It is transactional: validate, stage the new scene under a
 *   disabled root, commit by enabling it, then retire the previous scene. If
 *   anything fails before commit, the staging is disposed and the previous
 *   scene is untouched.
 * - {@linkcode ViroSpecsSceneController.update} and
 *   {@linkcode ViroSpecsSceneController.applyPatch} change the committed
 *   scene in place with create, update, remove and reparent ops, so a state
 *   change touches only the nodes whose fields changed. Stable nodes keep
 *   their SceneObjects, and with them scroll, selection and focus.
 *
 * Every scene owns its async work: deferred SIK binding, queued actions,
 * delayed animations and asset loads. Retiring a scene cancels all of it, and
 * a late completion is discarded with VS5006 instead of touching a newer
 * scene.
 *
 * The controller never throws. Failures arrive on the
 * {@linkcode ViroSpecsHostDiagnostics} channel.
 *
 * Dependency-free and free of Lens globals; the Lens binding is
 * ViroSpecsLensSceneBackend plus ViroSpecsSceneControllerHost.
 */
import type {
  ViroSpecsDocumentAnimation,
  ViroSpecsDocumentInteraction,
  ViroSpecsDocumentLight,
  ViroSpecsDocumentMaterial,
  ViroSpecsDocumentNode,
  ViroSpecsDocumentPolyline,
  ViroSpecsExtents,
  ViroSpecsHostInteraction,
  ViroSpecsNativeAnimationPlan,
} from "./ViroSpecsProtocol";
import {
  createViroSpecsHostDiagnostic,
  describeError,
  ViroSpecsHostDiagnostics,
  type ViroSpecsHostDiagnostic,
  type ViroSpecsHostDiagnosticCode,
  type ViroSpecsHostDiagnosticDetails,
  type ViroSpecsHostPhase,
  type ViroSpecsSubscription,
} from "./ViroSpecsHostDiagnostics";
import {
  readViroSpecsSceneInput,
  type ViroSpecsHostNode,
  type ViroSpecsHostScene,
  type ViroSpecsResolvedTextStyle,
} from "./ViroSpecsSceneDocument";
import type {
  ViroSpecsBackendInteraction,
  ViroSpecsCancel,
  ViroSpecsHostScheduler,
  ViroSpecsNodeUiState,
  ViroSpecsSceneBackend,
} from "./ViroSpecsSceneBackend";
import { ViroSpecsResourceCache } from "./ViroSpecsResourceCache";

/** Lifecycle of the committed scene, for loading, degraded and error visuals. */
export type ViroSpecsSceneLifecycle =
  /** Nothing committed yet. */
  | "empty"
  /** Committed; some assets are still loading. Animations wait. */
  | "loading"
  /** Committed; every asset resolved. */
  | "ready"
  /** Committed; at least one asset is missing and shows a placeholder. */
  | "degraded"
  /** The first scene was rejected; nothing is on screen. */
  | "error";

/** Explicit change to the committed scene. */
export type ViroSpecsPatchOp =
  /** Adds a node. Its parent must exist or be created earlier in the same patch. */
  | { op: "create"; node: ViroSpecsDocumentNode }
  /** Replaces a node's fields. `kind` and `parentId` must not change; use remove+create or reparent. */
  | { op: "update"; node: ViroSpecsDocumentNode }
  /** Removes a node and its subtree. */
  | { op: "remove"; id: string }
  /** Moves a node. Absent `parentId` means the scene root. */
  | { op: "reparent"; id: string; parentId?: string };

/** Outcome of a present, update or patch call. */
export type ViroSpecsApplyResult =
  | {
      readonly status: "committed" | "patched";
      readonly revision: number;
      /** Ops applied to nodes, in order. Empty for a full replacement. */
      readonly ops: readonly ViroSpecsPatchOp[];
      readonly diagnostics: readonly ViroSpecsHostDiagnostic[];
    }
  | {
      readonly status: "rejected";
      readonly revision: number;
      readonly diagnostics: readonly ViroSpecsHostDiagnostic[];
    };

/** Per-node state that survives patches, and navigation for stable IDs. */
export type ViroSpecsNodeState = ViroSpecsNodeUiState & {
  readonly focused: boolean;
  readonly selected: boolean;
};

/** Construction options. */
export type ViroSpecsSceneControllerOptions = {
  /** Channel to report on. A new one is created when absent. */
  readonly diagnostics?: ViroSpecsHostDiagnostics;
  /** Idle owned materials kept for reuse across scenes. Default 32. */
  readonly maxCachedMaterials?: number;
  /** Placeholder size when a missing asset has no extents. Default 0.2 m square. */
  readonly placeholderExtents?: ViroSpecsExtents;
};

type NodeRecord<N> = {
  spec: ViroSpecsHostNode;
  handle: N;
  placeholder: boolean;
};

type ExtraRecord<N> = { json: string; handle: N };

/** Async work a scene owns. `retire` cancels all of it, once. */
class Ownership {
  private readonly cancels = new Set<ViroSpecsCancel>();
  alive = true;

  own(cancel: ViroSpecsCancel): ViroSpecsCancel {
    if (!this.alive) {
      cancel();
      return () => undefined;
    }
    let done = false;
    const wrapped = (): void => {
      if (done) return;
      done = true;
      this.cancels.delete(wrapped);
      cancel();
    };
    this.cancels.add(wrapped);
    return wrapped;
  }

  retire(): void {
    if (!this.alive) return;
    this.alive = false;
    for (const cancel of Array.from(this.cancels)) cancel();
    this.cancels.clear();
  }

  get pendingCount(): number {
    return this.cancels.size;
  }
}

type SceneState<N, M> = {
  revision: number;
  /** Holder ID for owned resources; the revision the scene was presented at. */
  holder: number;
  /** Nodes that received setMaterial during the running patch. */
  materialApplied: Set<string> | null;
  scene: ViroSpecsHostScene;
  root: N;
  ownership: Ownership;
  nodes: Map<string, NodeRecord<N>>;
  polylines: Map<string, ExtraRecord<N>>;
  lights: Map<string, ExtraRecord<N>>;
  /** Resolved material per material ID, for this scene. */
  materials: Map<string, M | null>;
  bindings: Map<string, ViroSpecsCancel>;
  animations: Map<string, ViroSpecsCancel>;
  /** nodeId to load token of the asset still loading for it. */
  pendingAssets: Map<string, number>;
  animationsStarted: boolean;
};

const IDENTITY_POSITION: [number, number, number] = [0, 0, 0];
const IDENTITY_ROTATION: [number, number, number, number] = [0, 0, 0, 1];
const IDENTITY_SCALE: [number, number, number] = [1, 1, 1];

/**
 * Owns one live scene on top of a {@linkcode ViroSpecsSceneBackend}.
 *
 * @example
 * const controller = new ViroSpecsSceneController(backend, scheduler);
 * const sub = controller.diagnostics.addOnDiagnosticListener((d) => print(formatViroSpecsHostDiagnostic(d)));
 * controller.present(GENERATED_SCENE);           // navigation
 * controller.update(nextStateDocument);          // same page, new state
 * controller.dispose();                          // OnDestroyEvent
 */
export class ViroSpecsSceneController<N, A, M> {
  /** Diagnostics for this controller. */
  readonly diagnostics: ViroSpecsHostDiagnostics;

  private current: SceneState<N, M> | null = null;
  private revisionCounter = 0;
  private assetToken = 0;
  private disposed = false;
  private lifecycleValue: ViroSpecsSceneLifecycle = "empty";
  private focusedId: string | undefined;
  private selectedId: string | undefined;
  private readonly controllerWork = new Ownership();
  private readonly materialCache: ViroSpecsResourceCache<M>;
  private readonly placeholderExtents: ViroSpecsExtents;
  private readonly interactionListeners = new Set<(event: ViroSpecsHostInteraction) => void>();
  private readonly lifecycleListeners = new Set<(state: ViroSpecsSceneLifecycle) => void>();
  private readonly completionListeners = new Set<(nodeId: string, name: string) => void>();
  private collecting: ViroSpecsHostDiagnostic[] | null = null;

  constructor(
    private readonly backend: ViroSpecsSceneBackend<N, A, M>,
    private readonly scheduler: ViroSpecsHostScheduler,
    options: ViroSpecsSceneControllerOptions = {}
  ) {
    this.diagnostics = options.diagnostics ?? new ViroSpecsHostDiagnostics();
    this.placeholderExtents = options.placeholderExtents ?? { width: 0.2, height: 0.2 };
    this.materialCache = new ViroSpecsResourceCache<M>(
      Math.max(0, options.maxCachedMaterials ?? 32),
      (material) => this.guard("dispose", "disposeMaterial", () => this.backend.disposeMaterial(material)),
      (key) => this.report("VS5010", "dispose", "Released idle material " + key + ".")
    );
  }

  /** Lifecycle of the committed scene. */
  get lifecycle(): ViroSpecsSceneLifecycle {
    return this.lifecycleValue;
  }

  /** Revision of the committed scene, 0 when none. */
  get revision(): number {
    return this.current?.revision ?? 0;
  }

  /** IDs of committed nodes, parents first. */
  get nodeIds(): readonly string[] {
    return this.current ? Array.from(this.current.nodes.keys()) : [];
  }

  /** Async jobs the committed scene still owns. For tests and leak checks. */
  get pendingWork(): number {
    return (this.current?.ownership.pendingCount ?? 0) + this.controllerWork.pendingCount;
  }

  /** Owned materials currently cached. */
  get cachedMaterialCount(): number {
    return this.materialCache.size;
  }

  /** Backend handle of a committed node, for host code that adds Lens components. */
  getNodeHandle(id: string): N | null {
    return this.current?.nodes.get(id)?.handle ?? null;
  }

  /** Focus, selection and scroll of a committed node. Undefined when absent. */
  getNodeState(id: string): ViroSpecsNodeState | undefined {
    const record = this.current?.nodes.get(id);
    if (!record) return undefined;
    const ui = this.guard("interaction", "captureUiState", () => this.backend.captureUiState(record.handle)) ?? {};
    return { ...ui, focused: this.focusedId === id, selected: this.selectedId === id };
  }

  /** Sets or clears the selected node. Ignored for unknown IDs. */
  setSelected(id: string | undefined): void {
    if (id === undefined || this.current?.nodes.has(id)) this.selectedId = id;
  }

  /** Sets or clears the focused node. Ignored for unknown IDs. */
  setFocused(id: string | undefined): void {
    if (id === undefined || this.current?.nodes.has(id)) this.focusedId = id;
  }

  /** Interaction events from bound nodes and from {@linkcode dispatchInteraction}. */
  addOnInteractionListener(listener: (event: ViroSpecsHostInteraction) => void): ViroSpecsSubscription {
    return subscribe(this.interactionListeners, listener);
  }

  /** Lifecycle changes. */
  addOnLifecycleListener(listener: (state: ViroSpecsSceneLifecycle) => void): ViroSpecsSubscription {
    return subscribe(this.lifecycleListeners, listener);
  }

  /** `single` animations that played to the end on the committed scene. */
  addOnAnimationCompleteListener(listener: (nodeId: string, name: string) => void): ViroSpecsSubscription {
    return subscribe(this.completionListeners, listener);
  }

  /**
   * Runs `action` on the next frame, owned by the committed scene: if
   * navigation or replacement retires the scene first, the action never
   * runs. Use it for work triggered from inside an SIK callback.
   */
  queueAction(action: () => void): ViroSpecsCancel {
    if (this.disposed) return () => undefined;
    const owner = this.current?.ownership ?? this.controllerWork;
    const revision = this.current?.revision;
    return this.ownFrame(owner, () => this.safeCall("queued action", revision, action));
  }

  /**
   * Delivers an interaction that did not come from SIK: a gaze provider, a
   * LEAF scenario or an accessibility switch. Ignored for nodes not in the
   * committed scene.
   */
  dispatchInteraction(event: Omit<ViroSpecsHostInteraction, "timestampMs" | "sceneRevision">): void {
    const state = this.current;
    if (!state || !state.nodes.has(event.nodeId)) return;
    this.deliverInteraction(state, event.nodeId, event);
  }

  /**
   * Replaces the committed scene with `input`, transactionally.
   *
   * @param input Parsed JSON: a protocol 2 document or a protocol 1 snapshot.
   */
  present(input: unknown): ViroSpecsApplyResult {
    return this.collect(() => this.presentInner(input));
  }

  /**
   * Moves the committed scene to `input` with the smallest set of patch
   * ops. Presents when nothing is committed yet.
   */
  update(input: unknown): ViroSpecsApplyResult {
    return this.collect(() => {
      const state = this.current;
      if (!state || this.disposed) return this.presentInner(input);
      const revision = ++this.revisionCounter;
      const read = readViroSpecsSceneInput(input, revision);
      if (read.ok === false) return this.reject(revision, read.diagnostics);
      return this.patchTo(state, read.scene, revision);
    });
  }

  /** Applies explicit ops to the committed scene. Invalid ops are skipped with VS5013. */
  applyPatch(ops: readonly ViroSpecsPatchOp[]): ViroSpecsApplyResult {
    return this.collect(() => {
      const state = this.current;
      const revision = ++this.revisionCounter;
      if (!state || this.disposed) {
        const d = createViroSpecsHostDiagnostic("VS5013", "patch", "No committed scene to patch.", { sceneRevision: revision });
        return this.reject(revision, [d]);
      }
      const nodes = this.applyOpsToSpecs(state.scene.nodes, ops, revision);
      const document = {
        version: 2,
        nodes,
        polylines: state.scene.polylines,
        lights: state.scene.lights,
        materials: state.scene.materials,
        interactions: state.scene.interactions.filter((i) => nodes.some((n) => n.id === i.nodeId)),
        animations: state.scene.animations.filter((a) => nodes.some((n) => n.id === a.nodeId)),
      };
      const read = readViroSpecsSceneInput(document, revision, { allowLegacyTextStyle: true });
      if (read.ok === false) return this.reject(revision, read.diagnostics);
      return this.patchTo(state, read.scene, revision);
    });
  }

  /** Removes the committed scene. Lifecycle returns to `empty`. */
  clear(): void {
    const state = this.current;
    if (!state) return;
    this.current = null;
    this.retireScene(state);
    this.focusedId = undefined;
    this.selectedId = undefined;
    this.setLifecycle("empty");
  }

  /** Clears the scene, disposes owned resources and drops listeners. Idempotent. */
  dispose(): void {
    if (this.disposed) return;
    this.clear();
    this.disposed = true;
    this.controllerWork.retire();
    this.materialCache.dispose();
    this.interactionListeners.clear();
    this.lifecycleListeners.clear();
    this.completionListeners.clear();
  }

  // ---------------------------------------------------------------------------
  // Replacement

  private presentInner(input: unknown): ViroSpecsApplyResult {
    const revision = ++this.revisionCounter;
    if (this.disposed) {
      return this.reject(revision, [
        createViroSpecsHostDiagnostic("VS5005", "stage", "The controller is disposed.", { sceneRevision: revision }),
      ]);
    }
    const read = readViroSpecsSceneInput(input, revision);
    if (read.ok === false) return this.reject(revision, read.diagnostics);

    // Stage: build the whole scene under a disabled root.
    const ownership = new Ownership();
    let root: N | null = null;
    let staged: SceneState<N, M> | null = null;
    try {
      root = this.backend.createSceneRoot(revision);
      this.backend.setEnabled(root, false);
      staged = {
        revision,
        holder: revision,
        materialApplied: null,
        scene: read.scene,
        root,
        ownership,
        nodes: new Map(),
        polylines: new Map(),
        lights: new Map(),
        materials: new Map(),
        bindings: new Map(),
        animations: new Map(),
        pendingAssets: new Map(),
        animationsStarted: false,
      };
      for (const spec of read.scene.nodes) this.createNodeRecord(staged, spec, "stage");
      for (const light of read.scene.lights) this.createLight(staged, light, "stage");
      for (const line of read.scene.polylines) this.createPolyline(staged, line, "stage");
    } catch (error) {
      ownership.retire();
      if (root !== null) {
        const stagingRoot = root;
        this.guard("stage", "destroy staging root", () => this.backend.destroy(stagingRoot));
      }
      this.materialCache.releaseHolder(revision);
      return this.reject(revision, [
        createViroSpecsHostDiagnostic("VS5005", "stage", "Staging failed: " + describeError(error), { sceneRevision: revision }),
      ]);
    }

    // Commit: carry UI state of stable nodes, show the new root, retire the old one.
    const previous = this.current;
    if (previous) {
      for (const [id, record] of staged.nodes) {
        const old = previous.nodes.get(id);
        if (!old || old.spec.kind !== record.spec.kind) continue;
        const ui = this.guard("commit", "captureUiState", () => this.backend.captureUiState(old.handle));
        if (ui) this.guard("commit", "restoreUiState", () => this.backend.restoreUiState(record.handle, ui));
      }
      if (this.focusedId !== undefined && !this.isStable(previous, staged, this.focusedId)) this.focusedId = undefined;
      if (this.selectedId !== undefined && !this.isStable(previous, staged, this.selectedId)) this.selectedId = undefined;
    }
    const committedRoot = staged.root;
    if (this.guard("commit", "enable scene root", () => this.backend.setEnabled(committedRoot, true)) === undefined) {
      // setEnabled threw: the new scene cannot be shown. Keep the old one.
      ownership.retire();
      this.guard("commit", "destroy staging root", () => this.backend.destroy(committedRoot));
      this.materialCache.releaseHolder(revision);
      return this.reject(revision, [
        createViroSpecsHostDiagnostic("VS5005", "commit", "Could not enable the staged scene.", { sceneRevision: revision }),
      ]);
    }
    this.current = staged;
    if (previous) this.retireScene(previous);

    this.scheduleBindings(staged, staged.scene.interactions);
    this.refreshLifecycle(staged);
    return { status: "committed", revision, ops: [], diagnostics: [] };
  }

  private isStable(previous: SceneState<N, M>, next: SceneState<N, M>, id: string): boolean {
    const a = previous.nodes.get(id);
    const b = next.nodes.get(id);
    return a !== undefined && b !== undefined && a.spec.kind === b.spec.kind;
  }

  /** Cancels a scene's async work, unbinds SIK before destroying objects, frees owned materials. */
  private retireScene(state: SceneState<N, M>): void {
    for (const cancel of state.bindings.values()) cancel();
    state.bindings.clear();
    state.ownership.retire();
    state.animations.clear();
    state.pendingAssets.clear();
    const root = state.root;
    this.guard("dispose", "destroy scene root", () => this.backend.destroy(root));
    state.nodes.clear();
    this.materialCache.releaseHolder(state.holder);
  }

  private reject(revision: number, diagnostics: readonly ViroSpecsHostDiagnostic[]): ViroSpecsApplyResult {
    for (const d of diagnostics) this.emit(d);
    if (!this.current && !this.disposed) this.setLifecycle("error");
    return { status: "rejected", revision, diagnostics: [] };
  }

  // ---------------------------------------------------------------------------
  // Patching

  private applyOpsToSpecs(
    current: readonly ViroSpecsHostNode[],
    ops: readonly ViroSpecsPatchOp[],
    revision: number
  ): ViroSpecsHostNode[] {
    const nodes = current.slice();
    const indexOf = (id: string): number => nodes.findIndex((n) => n.id === id);
    const skip = (op: ViroSpecsPatchOp, why: string): void =>
      this.report("VS5013", "patch", "Skipped " + op.op + ": " + why, {
        sceneRevision: revision,
        nodeId: op.op === "create" || op.op === "update" ? op.node.id : op.id,
      });
    const descendants = (id: string): Set<string> => {
      const out = new Set<string>([id]);
      let grew = true;
      while (grew) {
        grew = false;
        for (const n of nodes) {
          if (n.parentId !== undefined && out.has(n.parentId) && !out.has(n.id)) {
            out.add(n.id);
            grew = true;
          }
        }
      }
      return out;
    };
    for (const op of ops) {
      switch (op.op) {
        case "create":
          if (indexOf(op.node.id) >= 0) skip(op, "node " + op.node.id + " already exists.");
          else if (op.node.parentId !== undefined && indexOf(op.node.parentId) < 0) skip(op, "parent " + op.node.parentId + " does not exist.");
          else nodes.push(op.node);
          break;
        case "update": {
          const i = indexOf(op.node.id);
          const existing = nodes[i];
          if (!existing) skip(op, "node " + op.node.id + " does not exist.");
          else if (existing.kind !== op.node.kind) skip(op, "kind cannot change; remove and create instead.");
          else if (existing.parentId !== op.node.parentId) skip(op, "parent cannot change in update; use reparent.");
          else nodes[i] = op.node;
          break;
        }
        case "remove": {
          if (indexOf(op.id) < 0) {
            skip(op, "node " + op.id + " does not exist.");
            break;
          }
          const gone = descendants(op.id);
          for (let i = nodes.length - 1; i >= 0; i--) {
            const n = nodes[i];
            if (n && gone.has(n.id)) nodes.splice(i, 1);
          }
          break;
        }
        case "reparent": {
          const i = indexOf(op.id);
          const existing = nodes[i];
          if (!existing) skip(op, "node " + op.id + " does not exist.");
          else if (op.parentId !== undefined && indexOf(op.parentId) < 0) skip(op, "parent " + op.parentId + " does not exist.");
          else if (op.parentId !== undefined && descendants(op.id).has(op.parentId)) skip(op, "it would create a parent cycle.");
          else {
            const { parentId: _old, ...rest } = existing;
            nodes[i] = (op.parentId === undefined ? rest : { ...rest, parentId: op.parentId }) as ViroSpecsHostNode;
          }
          break;
        }
      }
    }
    return nodes;
  }

  private patchTo(state: SceneState<N, M>, next: ViroSpecsHostScene, revision: number): ViroSpecsApplyResult {
    const ops = diffViroSpecsScenes(state.scene.nodes, next.nodes);
    const previousScene = state.scene;
    state.revision = revision;
    state.scene = next;

    const changedMaterials = new Set<string>();
    const before = new Map(previousScene.materials.map((m) => [m.id, JSON.stringify(m)] as const));
    for (const m of next.materials) if (before.get(m.id) !== JSON.stringify(m)) changedMaterials.add(m.id);
    for (const id of before.keys()) if (!next.materials.some((m) => m.id === id)) changedMaterials.add(id);
    for (const id of changedMaterials) state.materials.delete(id);
    const materialApplied = new Set<string>();
    state.materialApplied = materialApplied;

    const removedRoots = new Set(ops.flatMap((op) => (op.op === "remove" ? [op.id] : [])));
    // Children that survive a removed parent move to the scene root first;
    // their reparent op puts them under the final parent after creates.
    for (const op of ops) {
      if (op.op !== "reparent") continue;
      const record = state.nodes.get(op.id);
      if (!record || record.spec.parentId === undefined || !this.isUnder(state, record.spec.parentId, removedRoots)) continue;
      const root = state.root;
      this.guard("patch", "detach " + op.id, () => this.backend.setParent(record.handle, root), op.id);
      const { parentId: _gone, ...detached } = record.spec;
      record.spec = detached as ViroSpecsHostNode;
    }

    for (const op of ops) {
      switch (op.op) {
        case "remove":
          this.removeNodeRecord(state, op.id);
          break;
        case "create":
          try {
            this.createNodeRecord(state, op.node, "patch");
          } catch (error) {
            this.report("VS5014", "patch", "create " + op.node.id + " failed: " + describeError(error), { nodeId: op.node.id });
          }
          break;
        case "reparent": {
          const record = state.nodes.get(op.id);
          if (!record) break;
          const parent = op.parentId !== undefined ? state.nodes.get(op.parentId)?.handle : state.root;
          if (parent === undefined) break;
          if (this.guard("patch", "reparent " + op.id, () => this.backend.setParent(record.handle, parent), op.id) !== undefined) {
            const { parentId: _old, ...rest } = record.spec;
            record.spec = (op.parentId === undefined ? rest : { ...rest, parentId: op.parentId }) as ViroSpecsHostNode;
          }
          break;
        }
        case "update": {
          const record = state.nodes.get(op.node.id);
          if (record) this.updateNodeRecord(state, record, op.node);
          break;
        }
      }
    }

    // A changed material definition reaches nodes that use it even when
    // their own fields did not change.
    if (changedMaterials.size > 0) {
      for (const record of state.nodes.values()) {
        const materialId = record.spec.materialId;
        if (materialId === undefined || !changedMaterials.has(materialId) || materialApplied.has(record.spec.id)) continue;
        const material = this.resolveMaterial(state, materialId, record.spec.id);
        this.guard("patch", "setMaterial " + record.spec.id, () => this.backend.setMaterial(record.handle, material), record.spec.id);
      }
    }
    state.materialApplied = null;

    const parentGone = (parentId: string | undefined): boolean => parentId !== undefined && this.isUnder(state, parentId, removedRoots);
    this.syncExtras(state.lights, previousScene.lights, next.lights,
      (light) => parentGone(light.parentId), (light) => this.createLight(state, light, "patch"));
    this.syncExtras(state.polylines, previousScene.polylines, next.polylines,
      (line) => line.materialId !== undefined && changedMaterials.has(line.materialId), (line) => this.createPolyline(state, line, "patch"));
    this.syncInteractions(state, previousScene.interactions, next.interactions);
    this.syncAnimations(state, previousScene.animations, next.animations);
    if (changedMaterials.size > 0) this.releaseUnusedMaterials(state);

    if (this.focusedId !== undefined && !state.nodes.has(this.focusedId)) this.focusedId = undefined;
    if (this.selectedId !== undefined && !state.nodes.has(this.selectedId)) this.selectedId = undefined;
    this.refreshLifecycle(state);
    return { status: "patched", revision, ops, diagnostics: [] };
  }

  /** Whether `id` is one of `roots` or below one, using the pre-patch tree. */
  private isUnder(state: SceneState<N, M>, id: string, roots: ReadonlySet<string>): boolean {
    let cursor: string | undefined = id;
    const seen = new Set<string>();
    while (cursor !== undefined && !seen.has(cursor)) {
      if (roots.has(cursor)) return true;
      seen.add(cursor);
      cursor = state.nodes.get(cursor)?.spec.parentId;
    }
    return false;
  }

  /** Drops this scene's hold on owned materials no node or polyline uses any more. */
  private releaseUnusedMaterials(state: SceneState<N, M>): void {
    const used = new Set<string>();
    const keyOf = (materialId: string | undefined): void => {
      const definition = materialId !== undefined ? state.scene.materials.find((m) => m.id === materialId) : undefined;
      if (definition) used.add(JSON.stringify(definition));
    };
    for (const record of state.nodes.values()) keyOf(record.spec.materialId);
    for (const line of state.scene.polylines) keyOf(line.materialId);
    this.materialCache.releaseUnused(state.holder, used);
  }

  private syncExtras<T extends { id: string }>(
    records: Map<string, ExtraRecord<N>>,
    before: readonly T[],
    after: readonly T[],
    force: (item: T) => boolean,
    create: (item: T) => void
  ): void {
    const afterIds = new Set(after.map((x) => x.id));
    for (const item of before) {
      if (afterIds.has(item.id)) continue;
      const record = records.get(item.id);
      if (record) {
        records.delete(item.id);
        this.guard("patch", "destroy " + item.id, () => this.backend.destroy(record.handle), item.id);
      }
    }
    for (const item of after) {
      const json = JSON.stringify(item);
      const record = records.get(item.id);
      if (record && record.json === json && !force(item)) continue;
      if (record) {
        records.delete(item.id);
        this.guard("patch", "destroy " + item.id, () => this.backend.destroy(record.handle), item.id);
      }
      this.guard("patch", "create " + item.id, () => create(item), item.id);
    }
  }

  private syncInteractions(
    state: SceneState<N, M>,
    before: readonly ViroSpecsDocumentInteraction[],
    after: readonly ViroSpecsDocumentInteraction[]
  ): void {
    const previous = new Map(before.map((i) => [i.nodeId, JSON.stringify(i)] as const));
    const changed: ViroSpecsDocumentInteraction[] = [];
    for (const interaction of after) {
      const unchanged = previous.get(interaction.nodeId) === JSON.stringify(interaction) && state.bindings.has(interaction.nodeId);
      previous.delete(interaction.nodeId);
      if (unchanged) continue;
      state.bindings.get(interaction.nodeId)?.();
      state.bindings.delete(interaction.nodeId);
      changed.push(interaction);
    }
    for (const nodeId of previous.keys()) {
      state.bindings.get(nodeId)?.();
      state.bindings.delete(nodeId);
    }
    if (changed.length) this.scheduleBindings(state, changed);
  }

  private syncAnimations(
    state: SceneState<N, M>,
    before: readonly ViroSpecsDocumentAnimation[],
    after: readonly ViroSpecsDocumentAnimation[]
  ): void {
    if (!state.animationsStarted) return; // still loading; startAnimations reads state.scene
    const key = (a: ViroSpecsDocumentAnimation): string => a.nodeId + "\u0000" + a.name;
    const previous = new Map(before.map((a) => [key(a), JSON.stringify(a)] as const));
    for (const animation of after) {
      const k = key(animation);
      const same = previous.get(k) === JSON.stringify(animation) && state.animations.has(k);
      previous.delete(k);
      if (same) continue;
      state.animations.get(k)?.();
      state.animations.delete(k);
      this.startAnimation(state, animation);
    }
    for (const k of previous.keys()) {
      state.animations.get(k)?.();
      state.animations.delete(k);
    }
  }

  // ---------------------------------------------------------------------------
  // Nodes

  private createNodeRecord(state: SceneState<N, M>, spec: ViroSpecsHostNode, phase: ViroSpecsHostPhase): void {
    const parent = spec.parentId !== undefined ? state.nodes.get(spec.parentId)?.handle : state.root;
    if (parent === undefined) throw new Error("Parent " + spec.parentId + " of " + spec.id + " was not created.");
    // Staging lets backend errors escape so present() can roll back; patches guard per op.
    const handle = this.backend.createNode(spec, parent);
    const record: NodeRecord<N> = { spec, handle, placeholder: false };
    state.nodes.set(spec.id, record);
    this.backend.setTransform(handle, transformOf(spec));
    if (spec.visible !== undefined) this.backend.setVisible(handle, spec.visible);
    this.applyContent(state, record, spec, undefined, phase);
  }

  private updateNodeRecord(state: SceneState<N, M>, record: NodeRecord<N>, next: ViroSpecsHostNode): void {
    const prev = record.spec;
    const id = next.id;
    if (!sameJson(prev.position, next.position) || !sameJson(prev.rotation, next.rotation) || !sameJson(prev.scale, next.scale)) {
      this.guard("patch", "setTransform " + id, () => this.backend.setTransform(record.handle, transformOf(next)), id);
    }
    if (prev.visible !== next.visible) {
      this.guard("patch", "setVisible " + id, () => this.backend.setVisible(record.handle, next.visible ?? true), id);
    }
    this.applyContent(state, record, next, prev, "patch");
    record.spec = next;
  }

  /**
   * Applies content fields. With `prev`, only fields that differ are sent.
   * During staging (`phase` stage) backend errors propagate to roll back.
   */
  private applyContent(
    state: SceneState<N, M>,
    record: NodeRecord<N>,
    next: ViroSpecsHostNode,
    prev: ViroSpecsHostNode | undefined,
    phase: ViroSpecsHostPhase
  ): void {
    const id = next.id;
    const run = (label: string, fn: () => void): void => {
      if (phase === "stage") fn();
      else this.guard(phase, label + " " + id, fn, id);
    };
    const changed = (a: unknown, b: unknown): boolean => prev === undefined || !sameJson(a, b);

    if (next.kind === "text") {
      const p = prev?.kind === "text" ? prev : undefined;
      if (
        !p || p.text !== next.text || !sameJson(p.style, next.style) || !sameJson(p.legacyTextStyle, next.legacyTextStyle) ||
        !sameJson(p.extents, next.extents) || p.maxLines !== next.maxLines
      ) {
        const style: ViroSpecsResolvedTextStyle = {
          ...(next.style ?? {}),
          ...(next.legacyTextStyle?.size !== undefined ? { lensSize: next.legacyTextStyle.size } : {}),
          ...(next.legacyTextStyle?.color !== undefined ? { rgba: next.legacyTextStyle.color } : {}),
        };
        let fontFamily: string | undefined;
        if (style.fontFamily !== undefined) {
          const family = style.fontFamily;
          if (this.guard(phase, "hasFont", () => this.backend.hasFont(family)) === true) fontFamily = family;
          else this.report("VS5007", phase, "Font family " + JSON.stringify(family) + " is not registered.", { nodeId: id, fieldPath: "/nodes/" + id + "/style/fontFamily" });
        }
        if (next.maxLines !== undefined && (!p || p.maxLines !== next.maxLines)) {
          this.report("VS5008", phase, "Text " + JSON.stringify(id) + " maxLines " + next.maxLines + " is approximated.", { nodeId: id });
        }
        run("setText", () =>
          this.backend.setText(record.handle, {
            text: next.text,
            style,
            ...(next.extents !== undefined ? { extents: next.extents } : {}),
            ...(next.maxLines !== undefined ? { maxLines: next.maxLines } : {}),
            ...(fontFamily !== undefined ? { fontFamily } : {}),
          })
        );
      }
    }
    if ((next.kind === "image" || next.kind === "panel") && next.extents !== undefined) {
      const before = prev && "extents" in prev ? prev.extents : undefined;
      if (changed(before, next.extents)) {
        const extents = next.extents;
        run("setExtents", () => this.backend.setExtents(record.handle, extents));
      }
    }
    if (next.kind === "group" && next.scroll !== undefined) {
      const before = prev?.kind === "group" ? prev.scroll : undefined;
      if (changed(before, next.scroll)) {
        const scroll = next.scroll;
        run("setScroll", () => this.backend.setScroll(record.handle, scroll));
      }
    }
    if (next.kind === "image" || next.kind === "model") {
      const before = prev && (prev.kind === "image" || prev.kind === "model") ? prev.source : undefined;
      if (prev === undefined || before !== next.source) this.loadNodeAsset(state, record, next.kind, next.source, phase);
    }
    if (changed(prev?.materialId, next.materialId) && (next.materialId !== undefined || prev !== undefined)) {
      const material = next.materialId !== undefined ? this.resolveMaterial(state, next.materialId, id) : null;
      run("setMaterial", () => this.backend.setMaterial(record.handle, material));
      state.materialApplied?.add(id);
    }
    if (changed(prev?.opacity, next.opacity) && (next.opacity !== undefined || prev !== undefined)) {
      const opacity = next.opacity ?? 1;
      run("setOpacity", () => this.backend.setOpacity(record.handle, opacity));
    }
  }

  private removeNodeRecord(state: SceneState<N, M>, id: string): void {
    const record = state.nodes.get(id);
    if (!record) return;
    // Unbind the subtree before its SceneObjects go away.
    const subtree = new Set<string>([id]);
    for (const [childId, child] of state.nodes) {
      let parent = child.spec.parentId;
      while (parent !== undefined) {
        if (subtree.has(parent) || parent === id) {
          subtree.add(childId);
          break;
        }
        parent = state.nodes.get(parent)?.spec.parentId;
      }
    }
    for (const nodeId of subtree) {
      state.bindings.get(nodeId)?.();
      state.bindings.delete(nodeId);
      for (const [key, cancel] of state.animations) {
        if (key.startsWith(nodeId + "\u0000")) {
          cancel();
          state.animations.delete(key);
        }
      }
      state.pendingAssets.delete(nodeId);
    }
    this.guard("patch", "destroy " + id, () => this.backend.destroy(record.handle), id);
    for (const nodeId of subtree) state.nodes.delete(nodeId);
  }

  // ---------------------------------------------------------------------------
  // Assets and materials

  private loadNodeAsset(
    state: SceneState<N, M>,
    record: NodeRecord<N>,
    kind: "image" | "model",
    source: string,
    phase: ViroSpecsHostPhase
  ): void {
    const id = record.spec.id;
    let result: A | null | Promise<A | null>;
    try {
      result = this.backend.loadAsset(kind, source);
    } catch (error) {
      this.applyAssetResult(state, record, null, kind, source, phase, describeError(error));
      return;
    }
    if (!isPromise(result)) {
      this.applyAssetResult(state, record, result, kind, source, phase);
      return;
    }
    const token = ++this.assetToken;
    state.pendingAssets.set(id, token);
    let settled = false;
    const cancel = state.ownership.own(() => {
      settled = true;
    });
    const settle = (asset: A | null, failure?: string): void => {
      if (settled || !state.ownership.alive || state.pendingAssets.get(id) !== token || state.nodes.get(id) !== record) {
        this.report("VS5006", "assets", "Asset " + JSON.stringify(source) + " for " + JSON.stringify(id) + " finished after its scene or node was replaced.", {
          nodeId: id,
          sceneRevision: state.revision,
        });
        return;
      }
      cancel();
      state.pendingAssets.delete(id);
      this.applyAssetResult(state, record, asset, kind, source, "assets", failure);
      this.refreshLifecycle(state);
    };
    result.then(
      (asset) => settle(asset),
      (error: unknown) => settle(null, describeError(error))
    );
  }

  private applyAssetResult(
    state: SceneState<N, M>,
    record: NodeRecord<N>,
    asset: A | null,
    kind: "image" | "model",
    source: string,
    phase: ViroSpecsHostPhase,
    failure?: string
  ): void {
    const id = record.spec.id;
    if (asset !== null) {
      if (record.placeholder) {
        this.guard(phase, "clearPlaceholder " + id, () => this.backend.clearPlaceholder(record.handle), id);
        record.placeholder = false;
      }
      this.guard(phase, "setAsset " + id, () => this.backend.setAsset(record.handle, asset), id);
      return;
    }
    this.report(
      "VS5003",
      phase,
      "No " + kind + " asset is registered for " + JSON.stringify(source) + " (node " + JSON.stringify(id) + ")" +
        (failure ? ": " + failure : "") + ". A placeholder is shown.",
      { nodeId: id, sceneRevision: state.revision }
    );
    const extents = record.spec.kind === "image" && record.spec.extents ? record.spec.extents : this.placeholderExtents;
    const shown = this.guard(phase, "showPlaceholder " + id, () => this.backend.showPlaceholder(record.handle, extents), id);
    record.placeholder = true;
    if (shown !== true) {
      this.report("VS5011", phase, "Node " + JSON.stringify(id) + " has no placeholder visual.", { nodeId: id, sceneRevision: state.revision });
    }
  }

  private resolveMaterial(state: SceneState<N, M>, materialId: string, nodeId: string): M | null {
    if (state.materials.has(materialId)) return state.materials.get(materialId) ?? null;
    let material: M | null = null;
    const definition = state.scene.materials.find((m) => m.id === materialId);
    if (definition) {
      material = this.ownedMaterial(state, definition, nodeId);
    } else {
      material = this.guard("assets", "resolveMaterial", () => this.backend.resolveMaterial(materialId), nodeId) ?? null;
      if (material === null) {
        this.report("VS5004", "assets", "Material " + JSON.stringify(materialId) + " is not registered (node " + JSON.stringify(nodeId) + ").", {
          nodeId,
          sceneRevision: state.revision,
        });
      }
    }
    state.materials.set(materialId, material);
    return material;
  }

  private ownedMaterial(state: SceneState<N, M>, definition: ViroSpecsDocumentMaterial, nodeId: string): M | null {
    if (definition.lightingModel !== undefined) {
      this.report("VS5012", "assets", "Material " + JSON.stringify(definition.id) + " lightingModel " + definition.lightingModel + " is not mapped to a Lens shader.", {
        nodeId: definition.id,
        sceneRevision: state.revision,
      });
    }
    let texture: A | null = null;
    if (definition.texture !== undefined) {
      const source = definition.texture;
      const loaded = this.guard("assets", "loadAsset", () => this.backend.loadAsset("image", source), nodeId);
      if (loaded !== undefined && loaded !== null && !isPromise(loaded)) texture = loaded;
      else {
        this.report("VS5003", "assets", "Texture " + JSON.stringify(source) + " of material " + JSON.stringify(definition.id) +
          " is not registered or loads asynchronously; the material is built without it.", { nodeId, sceneRevision: state.revision });
      }
    }
    const key = JSON.stringify(definition);
    const material = this.materialCache.acquire(key, state.holder, () =>
      this.guard("assets", "createMaterial", () => this.backend.createMaterial(definition, texture), nodeId) ?? null
    );
    if (material === null) {
      this.report("VS5004", "assets", "Material " + JSON.stringify(definition.id) + " could not be built; the backend has no base material.", {
        nodeId,
        sceneRevision: state.revision,
      });
    }
    return material;
  }

  // ---------------------------------------------------------------------------
  // Lights and polylines

  private createLight(state: SceneState<N, M>, light: ViroSpecsDocumentLight, phase: ViroSpecsHostPhase): void {
    const parent = light.parentId !== undefined ? state.nodes.get(light.parentId)?.handle ?? state.root : state.root;
    const handle = phase === "stage"
      ? this.backend.createLight(light, parent)
      : this.guard(phase, "createLight " + light.id, () => this.backend.createLight(light, parent), light.id);
    if (handle !== undefined) state.lights.set(light.id, { json: JSON.stringify(light), handle });
  }

  private createPolyline(state: SceneState<N, M>, line: ViroSpecsDocumentPolyline, phase: ViroSpecsHostPhase): void {
    const material = line.materialId !== undefined ? this.resolveMaterial(state, line.materialId, line.id) : null;
    const handle = phase === "stage"
      ? this.backend.createPolyline(line, material, state.root)
      : this.guard(phase, "createPolyline " + line.id, () => this.backend.createPolyline(line, material, state.root), line.id);
    if (handle !== undefined) state.polylines.set(line.id, { json: JSON.stringify(line), handle });
  }

  // ---------------------------------------------------------------------------
  // Interaction

  /**
   * SIK fits colliders to visuals that UI Kit builds after creation, so
   * binding waits one frame. The wait is owned by the scene: navigation
   * before it fires cancels it.
   */
  private scheduleBindings(state: SceneState<N, M>, interactions: readonly ViroSpecsDocumentInteraction[]): void {
    if (interactions.length === 0) return;
    const pending = interactions.slice();
    this.ownFrame(state.ownership, () => {
      if (!state.ownership.alive || this.current !== state) return;
      for (const interaction of pending) this.bind(state, interaction);
    });
  }

  private bind(state: SceneState<N, M>, interaction: ViroSpecsDocumentInteraction): void {
    const record = state.nodes.get(interaction.nodeId);
    if (!record) return;
    state.bindings.get(interaction.nodeId)?.();
    const handle = record.handle;
    const cancel = this.guard(
      "interaction",
      "bindInteraction " + interaction.nodeId,
      () =>
        this.backend.bindInteraction(handle, interaction, (raw) => {
          if (!state.ownership.alive || this.current !== state || state.nodes.get(interaction.nodeId) !== record) return;
          this.deliverInteraction(state, interaction.nodeId, raw);
        }),
      interaction.nodeId
    );
    if (cancel !== undefined) state.bindings.set(interaction.nodeId, state.ownership.own(cancel));
  }

  private deliverInteraction(state: SceneState<N, M>, nodeId: string, raw: ViroSpecsBackendInteraction): void {
    if (raw.phase === "hover-enter" || raw.phase === "hover-move") this.focusedId = nodeId;
    else if (raw.phase === "hover-exit" && this.focusedId === nodeId) this.focusedId = undefined;
    else if (raw.phase === "select-end") this.selectedId = nodeId;
    const event: ViroSpecsHostInteraction = {
      nodeId,
      phase: raw.phase,
      source: raw.source,
      ...(raw.position !== undefined ? { position: raw.position } : {}),
      ...(raw.normal !== undefined ? { normal: raw.normal } : {}),
      ...(raw.direction !== undefined ? { direction: raw.direction } : {}),
      timestampMs: this.scheduler.nowMs(),
      sceneRevision: state.revision,
    };
    for (const listener of Array.from(this.interactionListeners)) {
      this.safeCall("interaction listener", state.revision, () => listener(event));
    }
  }

  // ---------------------------------------------------------------------------
  // Lifecycle and animation

  private refreshLifecycle(state: SceneState<N, M>): void {
    if (this.current !== state) return;
    if (state.pendingAssets.size > 0) {
      this.setLifecycle("loading");
      return;
    }
    let degraded = false;
    for (const record of state.nodes.values()) if (record.placeholder) degraded = true;
    this.setLifecycle(degraded ? "degraded" : "ready");
    if (!state.animationsStarted) {
      state.animationsStarted = true;
      for (const animation of state.scene.animations) this.startAnimation(state, animation);
    }
  }

  private startAnimation(state: SceneState<N, M>, animation: ViroSpecsDocumentAnimation): void {
    const key = animation.nodeId + "\u0000" + animation.name;
    const plan: ViroSpecsNativeAnimationPlan = {
      ...animation.plan,
      backendPackage: "AnimationExamples",
      // The controller owns the delay so navigation can cancel it.
      delaySeconds: 0,
    };
    const play = (): ViroSpecsCancel => {
      const record = state.nodes.get(animation.nodeId);
      if (!record || !state.ownership.alive) return () => undefined;
      return (
        this.guard("animation", "playAnimation " + animation.nodeId, () =>
          this.backend.playAnimation(record.handle, plan, () => {
            if (!state.ownership.alive || this.current !== state) return;
            for (const listener of Array.from(this.completionListeners)) {
              this.safeCall("animation listener", state.revision, () => listener(animation.nodeId, animation.name));
            }
          }), animation.nodeId
        ) ?? (() => undefined)
      );
    };
    if (animation.plan.delaySeconds > 0) {
      let stopPlayback: ViroSpecsCancel = () => undefined;
      const stopDelay = this.scheduler.after(animation.plan.delaySeconds, () => {
        stopPlayback = play();
      });
      state.animations.set(key, state.ownership.own(() => {
        stopDelay();
        stopPlayback();
      }));
    } else {
      state.animations.set(key, state.ownership.own(play()));
    }
  }

  /**
   * Schedules a one-shot next-frame job owned by `owner`. The ownership
   * entry is released when the job runs, so finished jobs do not count as
   * pending work.
   */
  private ownFrame(owner: Ownership, job: () => void): ViroSpecsCancel {
    let release: ViroSpecsCancel = () => undefined;
    let ran = false;
    const cancel = this.scheduler.nextFrame(() => {
      ran = true;
      release();
      job();
    });
    release = owner.own(cancel);
    if (ran) release();
    return release;
  }

  private setLifecycle(next: ViroSpecsSceneLifecycle): void {
    if (this.lifecycleValue === next) return;
    this.lifecycleValue = next;
    for (const listener of Array.from(this.lifecycleListeners)) {
      this.safeCall("lifecycle listener", this.current?.revision, () => listener(next));
    }
  }

  // ---------------------------------------------------------------------------
  // Diagnostics plumbing

  private collect(run: () => ViroSpecsApplyResult): ViroSpecsApplyResult {
    const outer = this.collecting;
    const bucket: ViroSpecsHostDiagnostic[] = [];
    this.collecting = bucket;
    let result: ViroSpecsApplyResult;
    try {
      result = run();
    } catch (error) {
      // Defensive: every path above guards its backend calls.
      this.report("VS5005", "stage", "Unexpected host failure: " + describeError(error));
      result = { status: "rejected", revision: this.revisionCounter, diagnostics: [] };
    } finally {
      this.collecting = outer;
    }
    return { ...result, diagnostics: bucket };
  }

  private emit(diagnostic: ViroSpecsHostDiagnostic): void {
    this.collecting?.push(diagnostic);
    this.diagnostics.report(diagnostic);
  }

  private report(
    code: ViroSpecsHostDiagnosticCode,
    phase: ViroSpecsHostPhase,
    message: string,
    details: ViroSpecsHostDiagnosticDetails = {}
  ): void {
    this.emit(
      createViroSpecsHostDiagnostic(code, phase, message, {
        ...details,
        ...(details.sceneRevision === undefined && this.current ? { sceneRevision: this.current.revision } : {}),
      })
    );
  }

  /** Runs a backend call; on throw reports VS5014 and returns undefined. */
  private guard<T>(phase: ViroSpecsHostPhase, label: string, fn: () => T, nodeId?: string): T | undefined {
    try {
      const value = fn();
      return value === undefined ? (true as unknown as T) : value;
    } catch (error) {
      this.report("VS5014", phase, label + " failed: " + describeError(error), nodeId !== undefined ? { nodeId } : {});
      return undefined;
    }
  }

  private safeCall(label: string, revision: number | undefined, fn: () => void): void {
    try {
      fn();
    } catch (error) {
      this.report("VS5009", "listener", label + " threw: " + describeError(error), revision !== undefined ? { sceneRevision: revision } : {});
    }
  }
}

/**
 * Minimal node ops that turn `before` into `after`, matched by ID: removes
 * (subtree roots only), creates (parents first), reparents, then updates for
 * nodes whose own fields changed. A kind change is a remove plus a create.
 */
export function diffViroSpecsScenes(
  before: readonly ViroSpecsHostNode[],
  after: readonly ViroSpecsHostNode[]
): ViroSpecsPatchOp[] {
  const prev = new Map(before.map((n) => [n.id, n] as const));
  const next = new Map(after.map((n) => [n.id, n] as const));
  const removed = new Set<string>();
  for (const node of before) {
    const target = next.get(node.id);
    if (!target || target.kind !== node.kind) removed.add(node.id);
  }
  // A removed parent takes its subtree with it, so children that survive
  // by ID under the same parent must be recreated too.
  let grew = true;
  while (grew) {
    grew = false;
    for (const node of before) {
      if (removed.has(node.id) || node.parentId === undefined) continue;
      const target = next.get(node.id);
      if (removed.has(node.parentId) && target && target.parentId === node.parentId) {
        removed.add(node.id);
        grew = true;
      }
    }
  }
  const ops: ViroSpecsPatchOp[] = [];
  for (const node of before) {
    if (!removed.has(node.id)) continue;
    let parent = node.parentId;
    let covered = false;
    while (parent !== undefined) {
      if (removed.has(parent)) covered = true;
      parent = prev.get(parent)?.parentId;
    }
    if (!covered) ops.push({ op: "remove", id: node.id });
  }
  const creates: ViroSpecsPatchOp[] = [];
  for (const node of after) {
    if (!prev.has(node.id) || removed.has(node.id)) creates.push({ op: "create", node });
  }
  const reparents: ViroSpecsPatchOp[] = [];
  for (const node of after) {
    const old = prev.get(node.id);
    if (!old || removed.has(node.id) || old.parentId === node.parentId) continue;
    reparents.push(node.parentId === undefined ? { op: "reparent", id: node.id } : { op: "reparent", id: node.id, parentId: node.parentId });
  }
  const updates: ViroSpecsPatchOp[] = [];
  for (const node of after) {
    const old = prev.get(node.id);
    if (!old || removed.has(node.id)) continue;
    const { parentId: _a, ...oldFields } = old;
    const { parentId: _b, ...newFields } = node;
    if (!sameJson(oldFields, newFields)) updates.push({ op: "update", node });
  }
  // Removes run first. The controller moves surviving children of a removed
  // node to the scene root before the remove, and the reparent puts them
  // under their new parent once creates have run.
  return [...ops, ...creates, ...reparents, ...updates];
}

function transformOf(spec: ViroSpecsHostNode) {
  return {
    position: spec.position ?? IDENTITY_POSITION,
    rotation: spec.rotation ?? IDENTITY_ROTATION,
    scale: spec.scale ?? IDENTITY_SCALE,
  };
}

function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function isPromise<T>(value: T | Promise<T>): value is Promise<T> {
  return typeof value === "object" && value !== null && typeof (value as { then?: unknown }).then === "function";
}

function subscribe<T>(set: Set<T>, listener: T): ViroSpecsSubscription {
  set.add(listener);
  let removed = false;
  return {
    remove: () => {
      if (removed) return;
      removed = true;
      set.delete(listener);
    },
  };
}
