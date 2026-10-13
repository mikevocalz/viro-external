import { compileLensRenderPlan, type ViroSpecsSceneSnapshot } from "./ViroSpecsProtocol";
import { ViroSpecsInteractionHost } from "./ViroSpecsInteractionHost";
import { ViroSpecsRuntimeHost } from "./ViroSpecsRuntimeHost";

/** A plain JSON payload prepared by the phone/app host, not Lens React. */
export type ViroSpecsPresentationSnapshot = {
  scene: ViroSpecsSceneSnapshot;
  targets: { targetId: string; action: string }[];
};

/**
 * Replaces the entire active page atomically at the validation boundary.
 * SIK targets are retired before their SceneObjects are destroyed.
 */
@component
export class ViroSpecsPresentationHost extends BaseScriptComponent {
  @input
  @hint("SceneObject hosting ViroSpecsRuntimeHost")
  runtimeHostObject: SceneObject;

  @input
  @hint("SceneObject hosting ViroSpecsInteractionHost")
  interactionHostObject: SceneObject;

  private renderer: ViroSpecsRuntimeHost | null = null;
  private interactions: ViroSpecsInteractionHost | null = null;
  private readonly actions = new Map<string, string>();
  private readonly listeners = new Set<(action: string) => void>();
  private unsubscribe: (() => void) | null = null;

  onAwake(): void {
    this.renderer = this.runtimeHostObject.getComponent(
      ViroSpecsRuntimeHost.getTypeName()
    ) as ViroSpecsRuntimeHost | null;
    this.interactions = this.interactionHostObject.getComponent(
      ViroSpecsInteractionHost.getTypeName()
    ) as ViroSpecsInteractionHost | null;
    if (!this.renderer || !this.interactions) {
      throw new Error("ViroSpecsPresentationHost requires scene and SIK hosts.");
    }
    this.createEvent("OnDestroyEvent").bind(() => this.dispose());
  }

  subscribeAction(listener: (action: string) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  present(snapshot: ViroSpecsPresentationSnapshot): void {
    const renderer = this.requireRenderer();
    const interactions = this.requireInteractions();
    if (!snapshot.scene || snapshot.scene.version !== 1 ||
        !Array.isArray(snapshot.scene.nodes) || snapshot.scene.nodes.length === 0) {
      throw new Error("Specs presentation requires a non-empty version 1 scene.");
    }
    const plan = compileLensRenderPlan(snapshot.scene);
    if (plan.diagnostics.some((d) => d.level === "error")) {
      throw new Error("Invalid Specs scene: " + plan.diagnostics.map((d) => d.message).join("; "));
    }
    const sceneIds = new Set<string>();
    for (const node of snapshot.scene.nodes) {
      if (node.parentId && !sceneIds.has(node.parentId)) {
        throw new Error("Specs child precedes parent or parent is missing: " + node.id);
      }
      sceneIds.add(node.id);
    }
    const next = new Map<string, string>();
    for (const target of snapshot.targets) {
      if (!sceneIds.has(target.targetId) || !target.action.trim() || next.has(target.targetId)) {
        throw new Error("Invalid or duplicate Specs action target: " + target.targetId);
      }
      next.set(target.targetId, target.action);
    }

    // No visible state changes until all predictable source failures are ruled out.
    renderer.validateSources(snapshot.scene.nodes);

    // Subscription survives changes of page; target bindings never do.
    if (!this.unsubscribe) {
      this.unsubscribe = interactions.subscribe((event) => {
        if (event.phase !== "select-end" || !event.targetId) return;
        const action = this.actions.get(event.targetId);
        if (action) for (const listener of this.listeners) listener(action);
      });
    }
    interactions.resetTargets();
    renderer.clear();
    this.actions.clear();
    try {
      renderer.applyRenderPlan(plan);
      for (const target of next.keys()) interactions.setInteractable(target, true);
      for (const [key, action] of next) this.actions.set(key, action);
    } catch (error) {
      interactions.resetTargets();
      renderer.clear();
      throw error;
    }
  }

  clear(): void {
    this.interactions?.resetTargets();
    this.renderer?.clear();
    this.actions.clear();
  }

  private dispose(): void {
    this.clear();
    this.unsubscribe?.();
    this.unsubscribe = null;
    this.listeners.clear();
  }

  private requireRenderer(): ViroSpecsRuntimeHost {
    if (!this.renderer) throw new Error("ViroSpecsPresentationHost not initialized.");
    return this.renderer;
  }

  private requireInteractions(): ViroSpecsInteractionHost {
    if (!this.interactions) throw new Error("ViroSpecsInteractionHost not initialized.");
    return this.interactions;
  }
}
