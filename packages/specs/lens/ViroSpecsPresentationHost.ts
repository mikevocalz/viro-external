import { compileLensRenderPlan, type ViroSpecsSceneSnapshot } from "./ViroSpecsProtocol";
import { formatViroSpecsHostDiagnostic } from "./ViroSpecsHostDiagnostics";
import { readViroSpecsSceneInput } from "./ViroSpecsSceneDocument";
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
  private generation = 0;

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
    // Same field checks as ViroSpecsSceneController, so raw wire JSON cannot
    // pass with a kind, field or reference this host would trip over later.
    const read = readViroSpecsSceneInput(snapshot.scene, this.generation + 1);
    if (read.ok === false) {
      throw new Error("Invalid Specs scene: " + read.diagnostics.map(formatViroSpecsHostDiagnostic).join("; "));
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
      // Raw wire JSON may skip compileSpecsPresentation; these would throw after clear().
      if (node.text !== undefined && node.kind !== "text") {
        throw new Error("Specs text is only valid on text nodes: " + node.id);
      }
      if (node.source !== undefined && node.kind !== "image" && node.kind !== "model") {
        throw new Error("Specs source is only valid on image/model nodes: " + node.id);
      }
      if (node.textStyle !== undefined) {
        const style = node.textStyle;
        if (node.kind !== "text" || typeof style !== "object" || style === null) {
          throw new Error("Specs textStyle is only valid on text nodes: " + node.id);
        }
        if (style.size !== undefined &&
            (typeof style.size !== "number" || !Number.isFinite(style.size) || style.size <= 0 || style.size > 1000)) {
          throw new Error("Invalid Specs textStyle.size on node " + node.id);
        }
        assertVector(style.color, 4, "textStyle.color", node.id);
        if (style.color?.some((value) => value < 0 || value > 1)) {
          throw new Error("Invalid Specs textStyle.color on node " + node.id);
        }
      }
      if (node.scroll !== undefined) {
        const scroll = node.scroll;
        if (node.kind !== "group" || typeof scroll !== "object" || scroll === null) {
          throw new Error("Specs scroll is only valid on group nodes: " + node.id);
        }
        for (const value of [scroll.width, scroll.height]) {
          if (typeof value !== "number" || !Number.isFinite(value) || value <= 0 || value > 10) {
            throw new Error("Invalid Specs scroll size on node " + node.id);
          }
        }
        if (typeof scroll.contentHeight !== "number" || !Number.isFinite(scroll.contentHeight) ||
            scroll.contentHeight < 0) {
          throw new Error("Invalid Specs scroll.contentHeight on node " + node.id);
        }
      }
      assertVector(node.position, 3, "position", node.id);
      assertVector(node.rotation, 4, "rotation", node.id);
      assertVector(node.scale, 3, "scale", node.id);
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
        if (action) this.emitDeferred(action);
      });
    }
    // Invalidate any pending bind first, so a failed render below cannot
    // leave an older page's callback binding destroyed nodes.
    const generation = ++this.generation;
    interactions.resetTargets();
    renderer.clear();
    this.actions.clear();
    try {
      renderer.applyRenderPlan(plan);
      // A Canvas on each top-level node keeps UI Kit backing frames behind
      // later text/model children, as the validated Platform Lab does.
      for (const node of snapshot.scene.nodes) {
        if (node.parentId) continue;
        const root = renderer.getNode(node.id);
        if (root && !root.getComponent("Component.Canvas")) root.createComponent("Component.Canvas");
      }
      // UI Kit frames build their mesh after creation, so binding now would
      // fit the collider to a text label instead of the frame. Bind next
      // frame, and only if no newer page or clear() has replaced this one.
      const bind = this.createEvent("DelayedCallbackEvent");
      bind.bind(() => {
        if (generation !== this.generation) return;
        for (const target of next.keys()) interactions.setInteractable(target, true);
        // ScrollWindow caches the colliders it toggles; register the new ones.
        renderer.refreshScrollColliders();
        for (const [key, action] of next) this.actions.set(key, action);
      });
      bind.reset(0);
    } catch (error) {
      interactions.resetTargets();
      renderer.clear();
      throw error;
    }
  }

  // Listeners usually call present(), which destroys the selected Interactable.
  // Doing that inside SIK's trigger-end dispatch leaves SIK walking dead objects,
  // so actions are delivered on the next frame instead.
  // The action belongs to the page that was live when it was selected: if
  // present() or clear() replaces that page before the next frame, the
  // action is dropped instead of firing against the new page.
  private emitDeferred(action: string): void {
    const generation = this.generation;
    const delayed = this.createEvent("DelayedCallbackEvent");
    delayed.bind(() => {
      if (generation !== this.generation) return;
      for (const listener of Array.from(this.listeners)) {
        try {
          listener(action);
        } catch (error) {
          console.error("[viro-specs-host] error VS5009 (listener): action listener threw: " +
            (error instanceof Error ? error.message : String(error)));
        }
      }
    });
    delayed.reset(0);
  }

  clear(): void {
    this.generation++;
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

function assertVector(value: unknown, length: number, field: string, id: string): void {
  if (value === undefined) return;
  if (!Array.isArray(value) || value.length !== length ||
      !value.every((n) => typeof n === "number" && Number.isFinite(n))) {
    throw new Error("Invalid Specs " + field + " on node " + id);
  }
}
