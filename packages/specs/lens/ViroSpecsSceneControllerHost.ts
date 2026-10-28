import type { ViroSpecsActionEvent, ViroSpecsHostInteraction, ViroSpecsVec3 } from "./ViroSpecsProtocol";
import {
  formatViroSpecsHostDiagnostic,
  ViroSpecsHostDiagnostics,
  type ViroSpecsHostDiagnostic,
  type ViroSpecsSubscription,
} from "./ViroSpecsHostDiagnostics";
import type { ViroSpecsCancel, ViroSpecsHostScheduler } from "./ViroSpecsSceneBackend";
import {
  ViroSpecsSceneController,
  type ViroSpecsApplyResult,
  type ViroSpecsNodeState,
  type ViroSpecsPatchOp,
  type ViroSpecsSceneLifecycle,
} from "./ViroSpecsSceneController";
import { ViroSpecsAssetRegistry } from "./ViroSpecsAssetRegistry";
import type { ViroSpecsHostScene } from "./ViroSpecsSceneDocument";
import { ViroSpecsLensSceneBackend, type ViroSpecsLensAsset, type ViroSpecsLensNode } from "./ViroSpecsLensSceneBackend";

/**
 * Lens component that owns one ViroSpecsSceneController.
 *
 * Generated hosts and app scripts call {@linkcode present} for navigation
 * and {@linkcode update} or {@linkcode applyPatch} for state changes. No
 * method throws: problems are written to the Lens log and delivered to
 * {@linkcode addOnDiagnosticListener} listeners.
 *
 * Inputs: the asset registry and, optionally, the SceneObject scenes are
 * built under (defaults to this component's SceneObject).
 */
@component
export class ViroSpecsSceneControllerHost extends BaseScriptComponent {
  @input
  assetRegistryObject: SceneObject;

  @input
  @allowUndefined
  root: SceneObject | null = null;

  @input
  @hint("Idle scene-defined materials kept for reuse across scenes")
  maxCachedMaterials: number = 32;

  private controller: ViroSpecsSceneController<ViroSpecsLensNode, ViroSpecsLensAsset, Material> | null = null;
  private readonly diagnostics = new ViroSpecsHostDiagnostics({ log: (line) => console.log(line) });

  onAwake(): void {
    (globalThis as unknown as { __VIRO_SPECS_BUILD__?: boolean }).__VIRO_SPECS_BUILD__ = true;
    const registry = this.assetRegistryObject
      ? (this.assetRegistryObject.getComponent(ViroSpecsAssetRegistry.getTypeName()) as ViroSpecsAssetRegistry | null)
      : null;
    if (!registry) {
      // Without a registry nothing can render; report instead of throwing so
      // the Lens and its other components keep running.
      console.error("[viro-specs-host] error: ViroSpecsSceneControllerHost needs ViroSpecsAssetRegistry on assetRegistryObject.");
      return;
    }
    const scheduler = this.createScheduler();
    const backend = new ViroSpecsLensSceneBackend(this.root ?? this.getSceneObject(), registry, (cb) => scheduler.nextFrame(cb));
    this.controller = new ViroSpecsSceneController(backend, scheduler, {
      diagnostics: this.diagnostics,
      maxCachedMaterials: this.maxCachedMaterials,
    });
    this.createEvent("OnDestroyEvent").bind(() => this.dispose());
  }

  /** Whether onAwake found the registry. Every call is a no-op when false. */
  get isReady(): boolean {
    return this.controller !== null;
  }

  get lifecycle(): ViroSpecsSceneLifecycle {
    return this.controller?.lifecycle ?? "error";
  }

  /** Asset loads of the committed scene, for the experience layer's loading ring. */
  get assetProgress(): { readonly pending: number; readonly total: number } {
    return this.controller?.assetProgress ?? { pending: 0, total: 0 };
  }

  /** The committed, validated scene (read-only), or null. */
  get committedScene(): ViroSpecsHostScene | null {
    return this.controller?.committedScene ?? null;
  }

  /** IDs of committed nodes, parents first. */
  get nodeIds(): readonly string[] {
    return this.controller?.nodeIds ?? [];
  }

  /**
   * The diagnostics channel this host reports to. The experience layer and an
   * action runtime that shares the channel report into it too.
   */
  get diagnosticsChannel(): ViroSpecsHostDiagnostics {
    return this.diagnostics;
  }

  /** Navigation: replaces the scene transactionally. */
  present(input: unknown): ViroSpecsApplyResult {
    return this.controller?.present(input) ?? notReady();
  }

  /** State change: patches the committed scene to match `input`. */
  update(input: unknown): ViroSpecsApplyResult {
    return this.controller?.update(input) ?? notReady();
  }

  applyPatch(ops: readonly ViroSpecsPatchOp[]): ViroSpecsApplyResult {
    return this.controller?.applyPatch(ops) ?? notReady();
  }

  /** Runs `action` next frame unless navigation retires the scene first. */
  queueAction(action: () => void): ViroSpecsCancel {
    return this.controller?.queueAction(action) ?? (() => undefined);
  }

  dispatchInteraction(event: Omit<ViroSpecsHostInteraction, "timestampMs" | "sceneRevision">): void {
    this.controller?.dispatchInteraction(event);
  }

  addOnInteractionListener(listener: (event: ViroSpecsHostInteraction) => void): ViroSpecsSubscription {
    return this.controller?.addOnInteractionListener(listener) ?? { remove: () => undefined };
  }

  /** See {@linkcode ViroSpecsSceneController.setDragConstraint}. */
  setDragConstraint(constraint: ((nodeId: string, position: ViroSpecsVec3) => ViroSpecsVec3) | undefined): void {
    this.controller?.setDragConstraint(constraint);
  }

  /** Typed actions from triggers, one frame after the pinch, owned by their scene. */
  addOnActionListener(listener: (event: ViroSpecsActionEvent) => void): ViroSpecsSubscription {
    return this.controller?.addOnActionListener(listener) ?? { remove: () => undefined };
  }

  addOnLifecycleListener(listener: (state: ViroSpecsSceneLifecycle) => void): ViroSpecsSubscription {
    return this.controller?.addOnLifecycleListener(listener) ?? { remove: () => undefined };
  }

  addOnDiagnosticListener(listener: (diagnostic: ViroSpecsHostDiagnostic) => void): ViroSpecsSubscription {
    return this.diagnostics.addOnDiagnosticListener(listener);
  }

  /** Recent diagnostics, oldest first. */
  get recentDiagnostics(): readonly ViroSpecsHostDiagnostic[] {
    return this.diagnostics.recent;
  }

  /** The SceneObject of a committed node, for app code that adds components. */
  getNode(id: string): SceneObject | null {
    return this.controller?.getNodeHandle(id)?.object ?? null;
  }

  /**
   * Scrolls a committed scroll group by `rows` rows (positive is further down
   * the list). False when `id` is not a committed scroll group.
   */
  scrollByRows(id: string, rows: number): boolean {
    return this.controller?.scrollByRows(id, rows) ?? false;
  }

  /** True while the committed scene is still loading node `id`'s image or model. */
  isAssetPending(id: string): boolean {
    return this.controller?.isAssetPending(id) ?? false;
  }

  /** Focus, selection and scroll position of a committed node. Undefined when absent. */
  getNodeState(id: string): ViroSpecsNodeState | undefined {
    return this.controller?.getNodeState(id);
  }

  clear(): void {
    this.controller?.clear();
  }

  private dispose(): void {
    this.controller?.dispose();
    this.controller = null;
    this.diagnostics.dispose();
  }

  private createScheduler(): ViroSpecsHostScheduler {
    const at = (seconds: number, callback: () => void): ViroSpecsCancel => {
      const event = this.createEvent("DelayedCallbackEvent");
      let cancelled = false;
      event.bind(() => {
        if (!cancelled) callback();
      });
      event.reset(seconds);
      return () => {
        cancelled = true;
        event.enabled = false;
      };
    };
    return {
      nextFrame: (callback) => at(0, callback),
      after: (seconds, callback) => at(seconds, callback),
      nowMs: () => getTime() * 1000,
    };
  }
}

function notReady(): ViroSpecsApplyResult {
  console.error(formatViroSpecsHostDiagnostic({
    code: "VS5005",
    severity: "error",
    phase: "stage",
    message: "ViroSpecsSceneControllerHost is not ready (missing asset registry).",
    hint: "Assign assetRegistryObject.",
  }));
  return { status: "rejected", revision: 0, diagnostics: [] };
}
