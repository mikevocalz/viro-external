import { Interactable } from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable";
import { InteractableManipulation } from "SpectaclesInteractionKit.lspkg/Components/Interaction/InteractableManipulation/InteractableManipulation";
import type { ViroSpecsPortableInteraction } from "./ViroSpecsProtocol";
import { ViroSpecsRuntimeHost } from "./ViroSpecsRuntimeHost";

type InteractionRecord = {
  target: SceneObject;
  interactable: Interactable;
  manipulation?: InteractableManipulation;
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

      record.manipulation.setCanRotate(false);
      record.manipulation.setCanScale(false);

      record.manipulation.onManipulationStart.add(() => {
        this.activeDrags.add(nodeId);
        this.emitDrag(nodeId);
      });

      record.manipulation.onManipulationEnd.add(() => {
        this.emitDrag(nodeId);
        this.activeDrags.delete(nodeId);
      });
    }

    record.manipulation.enabled = enabled;
  }

  update(): void {
    for (const nodeId of this.activeDrags) {
      this.emitDrag(nodeId);
    }
  }

  dispose(): void {
    for (const record of this.records.values()) {
      record.interactable.enabled = false;
      if (record.manipulation) {
        record.manipulation.enabled = false;
      }
    }

    this.activeDrags.clear();
    this.records.clear();
    this.listeners.clear();
  }

  private ensureRecord(nodeId: string): InteractionRecord {
    const existing = this.records.get(nodeId);
    if (existing) {
      return existing;
    }

    const node = this.host.getNode(nodeId);
    if (!node) {
      throw new Error("Cannot attach Specs interaction to missing node: " + nodeId);
    }

    const target = this.findBestInteractionTarget(node);
    this.ensureCollider(target);

    let interactable = target.getComponent(
      Interactable.getTypeName()
    ) as Interactable | null;

    if (!interactable) {
      interactable = target.createComponent(
        Interactable.getTypeName()
      ) as Interactable;
    }

    interactable.onHoverEnter.add(() => {
      this.emit({
        source: "hand",
        phase: "hover-enter",
        targetId: nodeId,
      });
    });

    interactable.onHoverExit.add(() => {
      this.emit({
        source: "hand",
        phase: "hover-exit",
        targetId: nodeId,
      });
    });

    interactable.onTriggerStart.add(() => {
      this.emit({
        source: "pinch",
        phase: "select-start",
        targetId: nodeId,
      });
    });

    interactable.onTriggerEnd.add(() => {
      this.emit({
        source: "pinch",
        phase: "select-end",
        targetId: nodeId,
      });
    });

    const record: InteractionRecord = {
      target,
      interactable,
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

      collider.intangible = true;
    }
  }

  private findBestInteractionTarget(root: SceneObject): SceneObject {
    const hasVisual =
      root.getComponent("Component.RenderMeshVisual") ||
      root.getComponent("Component.Image") ||
      root.getComponent("Component.Text");

    if (hasVisual) {
      return root;
    }

    for (const child of root.children) {
      const target = this.findBestInteractionTarget(child);
      if (target !== child || this.hasVisual(child)) {
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
    const node = this.host.getNode(nodeId);
    if (!node) {
      return;
    }

    const world = node.getTransform().getWorldPosition();
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
