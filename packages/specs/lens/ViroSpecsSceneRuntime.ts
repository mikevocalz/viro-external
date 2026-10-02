import type {
  ViroSpecsRenderCommand,
  ViroSpecsRenderPlan,
  ViroSpecsRenderPrimitive,
} from "./ViroSpecsProtocol";
import { Frame } from "SpectaclesUIKit.lspkg/Scripts/Components/Frame/Frame";
import { ScrollWindow } from "SpectaclesUIKit.lspkg/Scripts/Components/ScrollWindow/ScrollWindow";
import { ViroSpecsAssetRegistry } from "./ViroSpecsAssetRegistry";

type NodeRecord = {
  object: SceneObject;
  primitive: ViroSpecsRenderPrimitive;
  text?: Text;
  image?: Image;
  instantiatedModel?: SceneObject;
  scroll?: ScrollWindow;
  screenTransform?: ScreenTransform;
  frame?: Frame;
  video?: Image;
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
    private readonly assets: ViroSpecsAssetRegistry,
    /** Runs `work` on the next frame, after every OnStartEvent has completed. */
    private readonly afterStart: (work: () => void) => void
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

    const parentRecord = parentId ? this.requireNode(parentId) : null;
    const parent = parentRecord ? parentRecord.object : this.root;

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
          record.image.mainMaterial = this.assets.defaultImageMaterial.clone();
        }
        break;

      // UIKit's Frame is what gives a panel visible chrome and situates it in
      // AR space. Unlike ScrollWindow it has no public initialize() in the
      // installed 0.18.0 — it self-initializes on OnStartEvent, and its onAwake
      // adds a collider, an Interactable and an InteractableManipulation, so a
      // panel is grabbable without extra wiring.
      case "ui-frame": {
        record.frame = object.createComponent(Frame.getTypeName()) as Frame;
        if (this.assets.defaultPanelPrefab) {
          this.assets.defaultPanelPrefab.instantiate(object);
        }
        break;
      }

      // Per the SPECS UIKit ScrollWindow docs, the component is created at
      // runtime and then explicitly initialized; window and scroll extents are
      // local-space centimetres. Children scroll directly as its SceneObject
      // children, so no separate content object is needed.
      case "scroll-window": {
        const scroll = object.createComponent(
          ScrollWindow.getTypeName()
        ) as ScrollWindow;
        scroll.initialize();
        scroll.vertical = true;
        scroll.horizontal = false;
        record.scroll = scroll;
        // A ScrollBar would give the region a visible affordance, but the
        // installed SpectaclesUIKit 0.18.0 keeps ScrollBar.scrollWindow and
        // .slider private and ships no initialize(), unlike its docs. It has to
        // be wired from the editor, so a scroll node stays bar-less for now.
        break;
      }

      case "video-surface":
        record.video = object.createComponent("Component.Image") as Image;
        if (this.assets.defaultImageMaterial) {
          record.video.mainMaterial = this.assets.defaultImageMaterial.clone();
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
    const record = this.requireNode(command.id);
    const transform = record.object.getTransform();

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
        new quat(
          command.rotation[3],
          command.rotation[0],
          command.rotation[1],
          command.rotation[2]
        )
      );
    }

    // Surfaces are measured, not scaled: Lens lays an Image, a Frame and a
    // ScrollWindow out from a width and a height, so SceneObject scale would
    // leave them at the component's own default size.
    if (command.sizeMeters) {
      this.applySurfaceSize(
        record,
        command.sizeMeters[0],
        command.sizeMeters[1]
      );
    }

    // A ScreenTransform owns its object's layout, so setLocalPosition above is
    // ignored for these and every sibling collapses onto the parent's centre.
    // Place them through the same offsets rect that sizes them.
    if (command.position && record.screenTransform) {
      record.screenTransform.offsets.setCenter(
        new vec2(command.position[0] * 100, command.position[1] * 100)
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

  private applySurfaceSize(
    record: NodeRecord,
    widthMeters: number,
    heightMeters: number
  ): void {
    const width = widthMeters * 100;
    const height = heightMeters * 100;

    if (record.frame) {
      // Frame's innerSize setter calls scaleFrame(), which reads state the
      // component only builds in its own OnStartEvent — assigning it in the
      // same frame throws "Cannot read property 'setSize' of undefined". The
      // installed 0.18.0 exposes no readiness event, so apply the size on the
      // next frame, once every OnStartEvent has run. ViroSpecsPlatformLab
      // defers its SIK wiring for the same reason.
      const frame = record.frame;
      this.afterStart(() => {
        if (!isNull(frame)) frame.innerSize = new vec2(width, height);
      });
      return;
    }

    if (record.scroll) {
      // The ScrollWindow docs call setWindowSize/setScrollDimensions, but those
      // are private in the installed SpectaclesUIKit 0.18.0 — it exposes the
      // windowSize/scrollDimensions setters instead.
      record.scroll.windowSize = new vec2(width, height);
      // Scrolling is only reachable when the content exceeds the viewport.
      record.scroll.scrollDimensions = new vec2(width, height * 4);
      return;
    }

    const existing = record.object.getComponent(
      "Component.ScreenTransform"
    ) as ScreenTransform | null;
    const screenTransform =
      existing ??
      (record.object.createComponent(
        "Component.ScreenTransform"
      ) as ScreenTransform);

    // Zero anchors collapse the element to its parent's centre, so the offsets
    // alone give an absolute size. Anchoring to the full parent rect (-1..1)
    // would make offsets additive and the surface would inherit parent size.
    screenTransform.anchors.left = 0;
    screenTransform.anchors.right = 0;
    screenTransform.anchors.bottom = 0;
    screenTransform.anchors.top = 0;
    // setSize keeps the current centre, so a later position command can move it
    // without the size resetting it back to the parent's middle.
    screenTransform.offsets.setSize(new vec2(width, height));
    record.screenTransform = screenTransform;
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

    if (command.source === undefined) {
      return;
    }

    if (record.primitive === "image") {
      this.applyImageSource(record, command.source, command.id);
      this.applyFit(record.image, command.fit);
      return;
    }

    if (record.primitive === "render-mesh") {
      this.applyModelSource(record, command.source, command.id);
      return;
    }

    if (record.primitive === "video-surface") {
      this.applyVideoSource(record, command.source, command.id);
      this.applyFit(record.video, command.fit);
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

  /**
   * Lens expresses fit as StretchMode on the Image component. Default to cover,
   * because Stretch (the component default) distorts any texture whose aspect
   * ratio differs from the surface.
   */
  private applyFit(
    image: Image | undefined,
    fit: "cover" | "contain" | "stretch" | undefined
  ): void {
    if (!image) return;
    if (fit === "contain") {
      image.stretchMode = StretchMode.Fit;
      return;
    }
    if (fit === "stretch") {
      image.stretchMode = StretchMode.Stretch;
      return;
    }
    image.stretchMode = StretchMode.Fill;
  }

  private applyVideoSource(
    record: NodeRecord,
    source: string,
    id: string
  ): void {
    if (!record.video) {
      throw new Error("Missing Image component for Specs video node " + id);
    }

    const texture = this.assets.resolveVideo(source);
    if (!texture) {
      throw new Error(
        "Specs video asset is not registered: " + source + " (" + id + ")"
      );
    }

    if (!record.video.mainMaterial) {
      throw new Error(
        "Specs video node requires an Image material before setting source: " + id
      );
    }

    record.video.mainPass.baseTex = texture;

    // An imported video is a Texture whose control drives playback. Guard the
    // cast: a still assigned to a video node would otherwise fail silently.
    const control = texture.control as VideoTextureProvider | null;
    if (!control || typeof control.play !== "function") {
      throw new Error(
        "Specs video asset has no VideoTextureProvider: " + source + " (" + id + ")"
      );
    }
    // Negative playCount loops indefinitely.
    control.play(-1);
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
