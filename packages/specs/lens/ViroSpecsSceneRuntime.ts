import type {
  SpecsRenderCommand,
  SpecsRenderPlan,
  SpecsRenderPrimitive,
} from "../src/render";
import { ViroSpecsAssetRegistry } from "./ViroSpecsAssetRegistry";

type NodeRecord = {
  object: SceneObject;
  primitive: SpecsRenderPrimitive;
  text?: Text;
  image?: Image;
  instantiatedModel?: SceneObject;
};

/**
 * Executes SpecsRenderPlan against live Lens Studio SceneObjects.
 *
 * This class deliberately owns only renderer mechanics. Scene compilation,
 * Viro semantics, and diagnostics stay in the portable TypeScript package.
 */
export class ViroSpecsSceneRuntime {
  private readonly nodes = new Map<string, NodeRecord>();

  constructor(
    private readonly root: SceneObject,
    private readonly assets: ViroSpecsAssetRegistry
  ) {}

  apply(plan: SpecsRenderPlan): void {
    const errors = plan.diagnostics.filter((diagnostic) => diagnostic.level === "error");
    if (errors.length > 0) {
      throw new Error(
        "Specs render plan contains errors: " +
          errors.map((diagnostic) => diagnostic.message).join(" ")
      );
    }

    for (const command of plan.commands) {
      this.applyCommand(command);
    }
  }

  removeNode(id: string): void {
    const record = this.nodes.get(id);
    if (!record) {
      return;
    }

    record.object.destroy();
    this.nodes.delete(id);
  }

  clear(): void {
    for (const record of this.nodes.values()) {
      record.object.destroy();
    }
    this.nodes.clear();
  }

  getSceneObject(id: string): SceneObject | null {
    return this.nodes.get(id)?.object ?? null;
  }

  private applyCommand(command: SpecsRenderCommand): void {
    switch (command.op) {
      case "create":
        this.createNode(
          command.id,
          command.primitive,
          command.parentId
        );
        return;

      case "transform":
        this.applyTransform(command);
        return;

      case "content":
        this.applyContent(command);
        return;

      case "visibility":
        this.requireNode(command.id).object.enabled = command.visible;
        return;
    }
  }

  private createNode(
    id: string,
    primitive: SpecsRenderPrimitive,
    parentId?: string
  ): void {
    if (this.nodes.has(id)) {
      this.removeNode(id);
    }

    const parent = parentId
      ? this.requireNode(parentId).object
      : this.root;

    const object = global.scene.createSceneObject("viro:" + id);
    object.setParent(parent);

    const record: NodeRecord = { object, primitive };

    switch (primitive) {
      case "text":
        record.text = object.createComponent("Component.Text") as Text;
        break;

      case "image":
        record.image = object.createComponent("Component.Image") as Image;
        break;

      case "ui-frame":
        if (this.assets.defaultPanelPrefab) {
          this.assets.defaultPanelPrefab.instantiate(object);
        }
        break;

      case "scene-object":
      case "render-mesh":
        break;
    }

    this.nodes.set(id, record);
  }

  private applyTransform(
    command: Extract<SpecsRenderCommand, { op: "transform" }>
  ): void {
    const transform = this.requireNode(command.id).object.getTransform();

    if (command.position) {
      transform.setLocalPosition(
        new vec3(
          command.position[0],
          command.position[1],
          command.position[2]
        )
      );
    }

    if (command.rotation) {
      transform.setLocalRotation(
        new quat(
          command.rotation[0],
          command.rotation[1],
          command.rotation[2],
          command.rotation[3]
        )
      );
    }

    if (command.scale) {
      transform.setLocalScale(
        new vec3(
          command.scale[0],
          command.scale[1],
          command.scale[2]
        )
      );
    }
  }

  private applyContent(
    command: Extract<SpecsRenderCommand, { op: "content" }>
  ): void {
    const record = this.requireNode(command.id);

    if (command.text !== undefined) {
      if (!record.text) {
        throw new Error(
          "Text content supplied to non-text Specs node " + command.id
        );
      }
      record.text.text = command.text;
    }

    if (command.source === undefined) {
      return;
    }

    if (record.primitive === "image") {
      this.applyImageSource(record, command.source, command.id);
      return;
    }

    if (record.primitive === "render-mesh") {
      this.applyModelSource(record, command.source, command.id);
      return;
    }

    throw new Error(
      "Source content is unsupported for Specs primitive " +
        record.primitive +
        " (" +
        command.id +
        ")"
    );
  }

  private applyImageSource(
    record: NodeRecord,
    source: string,
    id: string
  ): void {
    if (!record.image) {
      throw new Error("Missing Image component for Specs node " + id);
    }

    const texture = this.assets.resolveImage(source);
    if (!texture) {
      throw new Error(
        "Specs image asset is not registered: " + source + " (" + id + ")"
      );
    }

    // UIKit/Image materials can differ by project. If the image already has a
    // material, assigning baseTex is the least invasive portable behavior.
    if (!record.image.mainMaterial) {
      throw new Error(
        "Specs Image node requires an Image material before setting source: " + id
      );
    }

    record.image.mainPass.baseTex = texture;
  }

  private applyModelSource(
    record: NodeRecord,
    source: string,
    id: string
  ): void {
    const prefab = this.assets.resolveModel(source);
    if (!prefab) {
      throw new Error(
        "Specs model asset is not registered: " + source + " (" + id + ")"
      );
    }

    if (record.instantiatedModel) {
      record.instantiatedModel.destroy();
    }

    record.instantiatedModel = prefab.instantiate(record.object);
    record.instantiatedModel.name = "viro-model:" + id;
  }

  private requireNode(id: string): NodeRecord {
    const record = this.nodes.get(id);
    if (!record) {
      throw new Error("Specs render node does not exist: " + id);
    }
    return record;
  }
}
