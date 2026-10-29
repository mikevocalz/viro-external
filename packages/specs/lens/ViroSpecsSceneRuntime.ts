import { ScrollWindow } from "./ViroSpecsUIKit";
import type {
  ViroSpecsRenderCommand,
  ViroSpecsRenderPlan,
  ViroSpecsRenderPrimitive,
  ViroSpecsScroll,
} from "./ViroSpecsProtocol";
import { ViroSpecsAssetRegistry } from "./ViroSpecsAssetRegistry";

type NodeRecord = {
  object: SceneObject;
  primitive: ViroSpecsRenderPrimitive;
  text?: Text;
  image?: Image;
  instantiatedModel?: SceneObject;
  scrollWindow?: ScrollWindow;
  /** Where child nodes attach. Set for scroll groups: the content anchor inside the ScrollWindow. */
  contentParent?: SceneObject;
};

/**
 * Executes ViroSpecsRenderPlan against live Lens Studio SceneObjects.
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

  apply(plan: ViroSpecsRenderPlan): void {
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

    if (!isNull(record.object)) record.object.destroy();
    this.nodes.delete(id);
  }

  clear(): void {
    for (const record of this.nodes.values()) {
      if (!isNull(record.object)) record.object.destroy();
    }
    this.nodes.clear();
  }

  getSceneObject(id: string): SceneObject | null {
    return this.nodes.get(id)?.object ?? null;
  }

  /**
   * ScrollWindow caches the child colliders it enables and disables, and only
   * drops that cache when scrollDimensions is written. Colliders added after
   * the cache was built (deferred pinch targets) would otherwise stay live
   * outside the visible window.
   */
  refreshScrollColliders(): void {
    for (const record of this.nodes.values()) {
      const scrollWindow = record.scrollWindow;
      if (scrollWindow && !isNull(scrollWindow)) scrollWindow.scrollDimensions = scrollWindow.scrollDimensions;
    }
  }

  private applyCommand(command: ViroSpecsRenderCommand): void {
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
    primitive: ViroSpecsRenderPrimitive,
    parentId?: string
  ): void {
    if (this.nodes.has(id)) {
      this.removeNode(id);
    }

    let parent = this.root;
    if (parentId) {
      const parentRecord = this.requireNode(parentId);
      parent = parentRecord.contentParent ?? parentRecord.object;
    }

    const object = global.scene.createSceneObject("viro:" + id);
    object.setParent(parent);

    const record: NodeRecord = { object, primitive };

    switch (primitive) {
      case "text":
        record.text = object.createComponent("Component.Text") as Text;
        if (this.assets.defaultFont) record.text.font = this.assets.defaultFont;
        record.text.depthTest = true;
        record.text.size = 48;
        record.text.horizontalAlignment = HorizontalAlignment.Center;
        record.text.horizontalOverflow = HorizontalOverflow.Overflow;
        record.text.layoutRect = Rect.create(-36, 36, -4, 4);
        break;

      case "image":
        record.image = object.createComponent("Component.Image") as Image;
        if (this.assets.defaultImageMaterial) {
          // Image materials are mutable shared assets. Each dynamic image must
          // own a clone or setting baseTex would replace every other image.
          record.image.mainMaterial = this.assets.defaultImageMaterial.clone();
        }
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
    command: Extract<ViroSpecsRenderCommand, { op: "transform" }>
  ): void {
    const transform = this.requireNode(command.id).object.getTransform();

    if (command.position) {
      // Viro spatial positions are meters; Lens Studio world units are cm.
      transform.setLocalPosition(
        new vec3(
          command.position[0] * 100,
          command.position[1] * 100,
          command.position[2] * 100
        )
      );
    }

    if (command.rotation) {
      transform.setLocalRotation(
        // Shared Viro quaternion is [x, y, z, w]; Lens constructor is (w, x, y, z).
        new quat(
          command.rotation[3],
          command.rotation[0],
          command.rotation[1],
          command.rotation[2]
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
    command: Extract<ViroSpecsRenderCommand, { op: "content" }>
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

    if (command.textStyle) {
      if (!record.text) {
        throw new Error("Text style supplied to non-text Specs node " + command.id);
      }
      if (command.textStyle.size !== undefined) record.text.size = command.textStyle.size;
      const c = command.textStyle.color;
      if (c) record.text.textFill.color = new vec4(c[0], c[1], c[2], c[3]);
    }

    if (command.scroll) {
      if (record.primitive !== "scene-object") {
        throw new Error("Scroll supplied to non-group Specs node " + command.id);
      }
      this.applyScroll(record, command.scroll, command.id);
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

  /**
   * Gives a group a vertical UI Kit ScrollWindow, following the pattern UI
   * Kit's own Dropdown uses: the ScrollWindow sits on a child SceneObject and
   * the content goes in through addObject(). ScrollWindow centres its content
   * area on its origin and shows the top when scrolled to normalized y = 1, so
   * the content anchor sits at +contentHeight / 2. Children parented to the
   * anchor then use y = 0 for the content top, negative downward.
   */
  private applyScroll(record: NodeRecord, scroll: ViroSpecsScroll, id: string): void {
    // Viro sizes are metres; ScrollWindow works in local centimetres.
    const width = scroll.width * 100;
    const height = scroll.height * 100;
    const contentHeight = Math.max(height, scroll.contentHeight * 100);

    let scrollWindow = record.scrollWindow;
    let content = record.contentParent;
    if (!scrollWindow || isNull(scrollWindow) || !content || isNull(content)) {
      const scrollObject = global.scene.createSceneObject("viro-scroll:" + id);
      scrollObject.setParent(record.object);
      scrollObject.layer = record.object.layer;
      scrollWindow = scrollObject.createComponent(ScrollWindow.getTypeName()) as ScrollWindow;
      scrollWindow.vertical = true;
      scrollWindow.horizontal = false;
      // Snap's dynamic-creation pattern: initialize() right after
      // createComponent sets up the Scroller, masking, collider and
      // Interactable before any setter touches them. It ignores repeat calls,
      // so the component's own OnStart initialize is harmless.
      scrollWindow.initialize();
      content = global.scene.createSceneObject("viro-scroll-content:" + id);
      content.layer = record.object.layer;
      // Children that already exist (a scroll added by a later plan) move in
      // with their local transforms intact.
      const existing = record.object.children.filter((child) => child !== scrollObject);
      // After initialize(), addObject parents the anchor into the internal Scroller.
      scrollWindow.addObject(content);
      for (const child of existing) child.setParent(content);
      record.scrollWindow = scrollWindow;
      record.contentParent = content;
    }

    scrollWindow.windowSize = new vec2(width, height);
    scrollWindow.scrollDimensions = new vec2(width, contentHeight);
    content.getTransform().setLocalPosition(new vec3(0, contentHeight / 2, 0));
    scrollWindow.scrollPositionNormalized = new vec2(0, 1);
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
