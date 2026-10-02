import { Interactable } from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable";
import { InteractableManipulation } from "SpectaclesInteractionKit.lspkg/Components/Interaction/InteractableManipulation/InteractableManipulation";
import type { ViroSpecsPortableInteraction } from "./ViroSpecsProtocol";
import { ViroSpecsRuntimeHost } from "./ViroSpecsRuntimeHost";

type InteractionRecord = {
  target: SceneObject;
  root: SceneObject;
  interactable: Interactable;
  manipulation?: InteractableManipulation;
  unsubscribe: (() => void)[];
};

export class ViroSpecsInteractionRuntime {
  private readonly records = new Map<string, InteractionRecord>();
  private readonly listeners = new Set<
    (event: ViroSpecsPortableInteraction) => void
  >();
  private readonly activeDrags = new Set<string>();

  constructor(private readonly host: ViroSpecsRuntimeHost) {}

  subscribe(
    listener: (event: ViroSpecsPortableInteraction) => void
  ): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  setInteractable(nodeId: string, enabled: boolean): void {
    const record = this.ensureRecord(nodeId);
    record.interactable.enabled = enabled;
  }

  setManipulationEnabled(nodeId: string, enabled: boolean): void {
    const record = this.ensureRecord(nodeId);

    if (!record.manipulation) {
      record.manipulation = record.target.createComponent(
        InteractableManipulation.getTypeName()
      ) as InteractableManipulation;

      record.manipulation.setManipulateRoot(record.root.getTransform());
      record.manipulation.setCanRotate(false);
      record.manipulation.setCanScale(false);
      // Portable Viro drag positions are linear world translations. SIK's
      // optional depth amplification otherwise changes Z on lateral motion.
      record.manipulation.enableStretchZ = false;

      record.unsubscribe.push(record.manipulation.onManipulationStart.add(() => {
        this.activeDrags.add(nodeId);
        this.emitDrag(nodeId);
      }));

      record.unsubscribe.push(record.manipulation.onManipulationEnd.add(() => {
        this.emitDrag(nodeId);
        this.activeDrags.delete(nodeId);
      }));
    }

    record.manipulation.enabled = enabled;
  }

  update(): void {
    for (const nodeId of this.activeDrags) {
      this.emitDrag(nodeId);
    }
  }

  remove(nodeId: string): void {
    const record = this.records.get(nodeId);
    if (!record) return;
    this.activeDrags.delete(nodeId);
    record.unsubscribe.forEach(unsubscribe => unsubscribe());
    if (!isNull(record.interactable)) record.interactable.enabled = false;
    if (record.manipulation && !isNull(record.manipulation)) record.manipulation.enabled = false;
    this.records.delete(nodeId);
  }

  dispose(): void {
    for (const id of Array.from(this.records.keys())) this.remove(id);
    this.listeners.clear();
  }

  private ensureRecord(nodeId: string): InteractionRecord {
    const existing = this.records.get(nodeId);
    if (existing && !isNull(existing.root) && existing.root === this.host.getNode(nodeId)) {
      return existing;
    }
    if (existing) this.remove(nodeId);

    const node = this.host.getNode(nodeId);
    if (!node) {
      throw new Error("Cannot attach Specs interaction to missing node: " + nodeId);
    }

    const target = this.findBestInteractionTarget(node);
    target.name = "viro-interactable:" + nodeId;
    this.ensureCollider(target);

    let interactable = target.getComponent(
      Interactable.getTypeName()
    ) as Interactable | null;

    if (!interactable) {
      interactable = target.createComponent(
        Interactable.getTypeName()
      ) as Interactable;
    }

    const unsubscribe: (() => void)[] = [];
    unsubscribe.push(interactable.onHoverEnter.add(() => {
      this.emit({
        source: "hand",
        phase: "hover-enter",
        targetId: nodeId,
      });
    }));

    unsubscribe.push(interactable.onHoverExit.add(() => {
      this.emit({
        source: "hand",
        phase: "hover-exit",
        targetId: nodeId,
      });
    }));

    unsubscribe.push(interactable.onTriggerStart.add(() => {
      this.emit({
        source: "pinch",
        phase: "select-start",
        targetId: nodeId,
      });
    }));

    unsubscribe.push(interactable.onTriggerEnd.add(() => {
      this.emit({
        source: "pinch",
        phase: "select-end",
        targetId: nodeId,
      });
    }));

    const record: InteractionRecord = {
      target,
      root: node,
      interactable,
      unsubscribe,
    };

    this.records.set(nodeId, record);
    return record;
  }

  private ensureCollider(object: SceneObject): void {
    let collider = object.getComponent(
      "ColliderComponent"
    ) as ColliderComponent | null;

    if (!collider) {
      collider = object.createComponent(
        "ColliderComponent"
      ) as ColliderComponent;

      const hasVisual =
        object.getComponent("Component.RenderMeshVisual") ||
        object.getComponent("Component.Image") ||
        object.getComponent("Component.Text");

      if (hasVisual) {
        collider.fitVisual = true;
      } else {
        const shape = Shape.createBoxShape();
        shape.size = new vec3(10, 10, 10);
        collider.shape = shape;
        collider.fitVisual = false;
      }

      collider.intangible = false;
    }
  }

  private findBestInteractionTarget(root: SceneObject): SceneObject {
    if (root.getComponent(Interactable.getTypeName())) {
      return root;
    }

    const hasVisual =
      root.getComponent("Component.RenderMeshVisual") ||
      root.getComponent("Component.Image") ||
      root.getComponent("Component.Text");

    if (hasVisual) {
      return root;
    }

    for (const child of root.children) {
      const target = this.findBestInteractionTarget(child);
      if (target !== child || this.hasVisual(child) || child.getComponent(Interactable.getTypeName())) {
        return target;
      }
    }

    return root;
  }

  private hasVisual(object: SceneObject): boolean {
    return Boolean(
      object.getComponent("Component.RenderMeshVisual") ||
        object.getComponent("Component.Image") ||
        object.getComponent("Component.Text")
    );
  }

  private emitDrag(nodeId: string): void {
    const target =
      this.records.get(nodeId)?.root ?? this.host.getNode(nodeId);
    if (!target) {
      return;
    }

    const world = target.getTransform().getWorldPosition();
    this.emit({
      source: "hand",
      phase: "drag",
      targetId: nodeId,
      // Lens world coordinates are centimeters; portable Viro events are meters.
      position: [world.x / 100, world.y / 100, world.z / 100],
    });
  }

  private emit(event: ViroSpecsPortableInteraction): void {
    const timestampMs = getTime() * 1000;
    const payload: ViroSpecsPortableInteraction = {
      ...event,
      timestampMs,
    };

    for (const listener of this.listeners) {
      listener(payload);
    }
  }
}
