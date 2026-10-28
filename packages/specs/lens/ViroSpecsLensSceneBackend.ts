import { ScrollWindow } from "SpectaclesUIKit.lspkg/Scripts/Components/ScrollWindow/ScrollWindow";
import { Frame } from "SpectaclesUIKit.lspkg/Scripts/Components/Frame/Frame";
import { VolumetricLine } from "VolumetricLine.lspkg/Scripts/VolumetricLine";
import type {
  ViroSpecsDocumentInteraction,
  ViroSpecsDocumentLight,
  ViroSpecsDocumentMaterial,
  ViroSpecsDocumentPolyline,
  ViroSpecsExtents,
  ViroSpecsNativeAnimationPlan,
  ViroSpecsScroll,
} from "./ViroSpecsProtocol";
import type {
  ViroSpecsBackendInteraction,
  ViroSpecsBackendText,
  ViroSpecsBackendTransform,
  ViroSpecsCancel,
  ViroSpecsNodeUiState,
  ViroSpecsSceneBackend,
  ViroSpecsScrollRows,
} from "./ViroSpecsSceneBackend";
import type { ViroSpecsHostNode } from "./ViroSpecsSceneDocument";
import { parseViroSpecsColor } from "./ViroSpecsSceneDocument";
import { ViroSpecsAssetRegistry } from "./ViroSpecsAssetRegistry";
import { ViroSpecsAnimationRuntime } from "./ViroSpecsAnimationRuntime";
import { bindViroSpecsSik, findViroSpecsInteractionTarget } from "./ViroSpecsSikBinding";

/** Lens backend node handle. */
export type ViroSpecsLensNode = {
  id: string;
  kind: ViroSpecsHostNode["kind"] | "root" | "light" | "polyline";
  object: SceneObject;
  text?: Text;
  image?: Image;
  model?: SceneObject;
  placeholder?: SceneObject;
  scrollWindow?: ScrollWindow;
  /** Where children attach: the scroll content anchor for scroll groups. */
  contentParent?: SceneObject;
  /** Child that carries the Image component and its extents scale. */
  imageSurface?: SceneObject;
  /** Text fill color before opacity. */
  textColor?: vec4;
  /** Last opacity set, re-applied after a material or asset swap. */
  opacity?: number;
};

/** Lens asset handle: a texture for images, a prefab for models. */
export type ViroSpecsLensAsset = Texture | ObjectPrefab;

const CM_PER_METER = 100;
/** Lens Text default used by the protocol 1 runtime; kept for unstyled text. */
const DEFAULT_TEXT_SIZE = 48;
/**
 * Lens Text `size` per Viro `fontSize` point. 1 means the number carries
 * over unchanged. Visual parity with ViroCore text is not preview-validated;
 * see ADR 0002.
 */
export const VIRO_SPECS_LENS_TEXT_SIZE_PER_POINT = 1;
/** Line height in layout centimeters per Lens size unit, for maxLines. */
const LINE_HEIGHT_CM_PER_SIZE = 0.1;
const PLACEHOLDER_TINT = new vec4(0.55, 0.6, 0.7, 0.6);

/**
 * Draws ViroSpecsSceneController scenes with Lens Studio SceneObjects.
 * Mechanics only: node creation, components, materials, SIK and
 * AnimationPlayer. Ordering, ownership and diagnostics live in the
 * controller.
 */
export class ViroSpecsLensSceneBackend
  implements ViroSpecsSceneBackend<ViroSpecsLensNode, ViroSpecsLensAsset, Material>
{
  private readonly animations = new ViroSpecsAnimationRuntime(null);

  constructor(
    private readonly container: SceneObject,
    private readonly assets: ViroSpecsAssetRegistry,
    private readonly deferFrame: (callback: () => void) => ViroSpecsCancel
  ) {}

  createSceneRoot(revision: number): ViroSpecsLensNode {
    const object = global.scene.createSceneObject("viro-scene:" + revision);
    object.setParent(this.container);
    object.layer = this.container.layer;
    return { id: "viro-scene:" + revision, kind: "root", object };
  }

  setEnabled(node: ViroSpecsLensNode, enabled: boolean): void {
    node.object.enabled = enabled;
  }

  createNode(spec: ViroSpecsHostNode, parent: ViroSpecsLensNode): ViroSpecsLensNode {
    const object = global.scene.createSceneObject("viro:" + spec.id);
    object.setParent(parent.contentParent ?? parent.object);
    object.layer = parent.object.layer;
    const node: ViroSpecsLensNode = { id: spec.id, kind: spec.kind, object };
    switch (spec.kind) {
      case "text": {
        const text = object.createComponent("Component.Text") as Text;
        if (this.assets.defaultFont) text.font = this.assets.defaultFont;
        text.depthTest = true;
        text.size = DEFAULT_TEXT_SIZE;
        text.horizontalAlignment = HorizontalAlignment.Center;
        text.verticalAlignment = VerticalAlignment.Center;
        text.horizontalOverflow = HorizontalOverflow.Overflow;
        text.layoutRect = Rect.create(-36, 36, -4, 4);
        node.text = text;
        node.textColor = text.textFill.color;
        break;
      }
      case "image": {
        const surface = global.scene.createSceneObject("viro-image:" + spec.id);
        surface.setParent(object);
        surface.layer = object.layer;
        node.imageSurface = surface;
        const image = surface.createComponent("Component.Image") as Image;
        // Image materials are shared assets; each image owns a clone so
        // setting baseTex or opacity changes only this node.
        if (this.assets.defaultImageMaterial) {
          const own = this.assets.defaultImageMaterial.clone();
          own.name = "viro-node:" + spec.id;
          image.mainMaterial = own;
        }
        node.image = image;
        break;
      }
      case "panel":
        if (this.assets.defaultPanelPrefab) this.assets.defaultPanelPrefab.instantiate(object);
        break;
      case "group":
      case "model":
        break;
    }
    return node;
  }

  setParent(node: ViroSpecsLensNode, parent: ViroSpecsLensNode): void {
    node.object.setParent(parent.contentParent ?? parent.object);
  }

  destroy(node: ViroSpecsLensNode): void {
    if (!isNull(node.object)) node.object.destroy();
  }

  setTransform(node: ViroSpecsLensNode, transform: ViroSpecsBackendTransform): void {
    const t = node.object.getTransform();
    const [px, py, pz] = transform.position;
    t.setLocalPosition(new vec3(px * CM_PER_METER, py * CM_PER_METER, pz * CM_PER_METER));
    const [x, y, z, w] = transform.rotation;
    // Portable quaternions are [x, y, z, w]; the Lens constructor is (w, x, y, z).
    t.setLocalRotation(new quat(w, x, y, z));
    const [sx, sy, sz] = transform.scale;
    t.setLocalScale(new vec3(sx, sy, sz));
  }

  setVisible(node: ViroSpecsLensNode, visible: boolean): void {
    node.object.enabled = visible;
  }

  setOpacity(node: ViroSpecsLensNode, opacity: number): void {
    node.opacity = opacity;
    if (node.text) {
      const c = node.text.textFill.color;
      node.text.textFill.color = new vec4(c.x, c.y, c.z, (node.textColor?.w ?? 1) * opacity);
    }
    if (node.image?.mainMaterial) {
      const c = node.image.mainPass.baseColor;
      node.image.mainPass.baseColor = new vec4(c.x, c.y, c.z, opacity);
    }
    if (node.model && !isNull(node.model)) {
      // Prefab, registry and cached scene materials are shared; clone once per
      // visual (marked with this node's ID) before fading, so other nodes keep
      // their opacity.
      for (const visual of collectMeshVisuals(node.model)) {
        if (!visual.mainMaterial) continue;
        if (visual.mainMaterial.name !== nodeMaterialName(node)) {
          const clone = visual.mainMaterial.clone();
          clone.name = nodeMaterialName(node);
          visual.mainMaterial = clone;
        }
        const c = visual.mainPass.baseColor;
        visual.mainPass.baseColor = new vec4(c.x, c.y, c.z, opacity);
      }
    }
  }

  setText(node: ViroSpecsLensNode, content: ViroSpecsBackendText): void {
    const text = node.text;
    if (!text) throw new Error("Text content on non-text node " + node.id);
    text.text = content.text;
    const style = content.style;
    const size =
      style.fontSize !== undefined ? style.fontSize * VIRO_SPECS_LENS_TEXT_SIZE_PER_POINT : style.lensSize ?? DEFAULT_TEXT_SIZE;
    text.size = size;
    if (content.fontFamily !== undefined) {
      const font = this.assets.resolveFont(content.fontFamily);
      if (font) text.font = font;
    } else if (this.assets.defaultFont) {
      text.font = this.assets.defaultFont;
    }
    if (style.fontWeight !== undefined) {
      text.weight = style.fontWeight === "bold" ? 700 : style.fontWeight === "normal" ? 400 : Number(style.fontWeight);
    }
    if (style.fontStyle !== undefined) text.italic = style.fontStyle === "italic";
    const rgba = style.color !== undefined ? parseViroSpecsColor(style.color) : style.rgba;
    if (rgba) {
      node.textColor = new vec4(rgba[0], rgba[1], rgba[2], rgba[3]);
      text.textFill.color = node.textColor;
    }
    if (style.textAlign !== undefined) {
      text.horizontalAlignment =
        style.textAlign === "left" ? HorizontalAlignment.Left : style.textAlign === "right" ? HorizontalAlignment.Right : HorizontalAlignment.Center;
    }
    if (style.textAlignVertical !== undefined) {
      text.verticalAlignment =
        style.textAlignVertical === "top" ? VerticalAlignment.Top : style.textAlignVertical === "bottom" ? VerticalAlignment.Bottom : VerticalAlignment.Center;
    }
    const halfWidth = content.extents ? (content.extents.width * CM_PER_METER) / 2 : 36;
    let halfHeight = content.extents ? (content.extents.height * CM_PER_METER) / 2 : 4;
    if (content.extents) text.horizontalOverflow = HorizontalOverflow.Wrap;
    if (content.maxLines !== undefined) {
      // Lens Text has no line limit (VS5008): size the box to maxLines lines and truncate.
      const linesHalf = (content.maxLines * size * LINE_HEIGHT_CM_PER_SIZE) / 2;
      halfHeight = content.extents ? Math.min(halfHeight, linesHalf) : linesHalf;
      text.horizontalOverflow = HorizontalOverflow.Wrap;
      text.verticalOverflow = VerticalOverflow.Truncate;
    }
    text.layoutRect = Rect.create(-halfWidth, halfWidth, -halfHeight, halfHeight);
  }

  setExtents(node: ViroSpecsLensNode, extents: ViroSpecsExtents): void {
    if (node.kind === "image" && node.image && node.imageSurface) {
      // Scale the surface child, not the node, so the node transform keeps
      // its manifest values. The quad's own size comes from its local AABB.
      const min = node.image.localAabbMin();
      const max = node.image.localAabbMax();
      const nativeW = Math.max(1e-6, max.x - min.x);
      const nativeH = Math.max(1e-6, max.y - min.y);
      node.imageSurface.getTransform().setLocalScale(
        new vec3((extents.width * CM_PER_METER) / nativeW, (extents.height * CM_PER_METER) / nativeH, 1)
      );
      return;
    }
    if (node.kind === "panel") {
      const size = new vec2(extents.width * CM_PER_METER, extents.height * CM_PER_METER);
      const visit = (object: SceneObject): void => {
        const frame = object.getComponent(Frame.getTypeName()) as Frame | null;
        if (frame) frame.innerSize = size;
        for (const child of object.children) visit(child);
      };
      visit(node.object);
    }
  }

  setScroll(node: ViroSpecsLensNode, scroll: ViroSpecsScroll, rows?: ViroSpecsScrollRows): void {
    const width = scroll.width * CM_PER_METER;
    const height = scroll.height * CM_PER_METER;
    const contentHeight = Math.max(height, scroll.contentHeight * CM_PER_METER);
    let scrollWindow = node.scrollWindow;
    let content = node.contentParent;
    const fresh = !scrollWindow || isNull(scrollWindow) || !content || isNull(content);
    if (fresh) {
      const scrollObject = global.scene.createSceneObject("viro-scroll:" + node.id);
      scrollObject.setParent(node.object);
      scrollObject.layer = node.object.layer;
      const created = scrollObject.createComponent(ScrollWindow.getTypeName()) as ScrollWindow;
      created.vertical = true;
      created.horizontal = false;
      // Snapping is read when the window initializes and on every drag release.
      if (rows) {
        created.scrollSnapping = true;
        created.snapRegion = new vec2(0, rows.stepMeters * CM_PER_METER);
      }
      created.initialize();
      const anchor = global.scene.createSceneObject("viro-scroll-content:" + node.id);
      anchor.layer = node.object.layer;
      const existing = node.object.children.filter((child) => child !== scrollObject);
      created.addObject(anchor);
      for (const child of existing) child.setParent(anchor);
      node.scrollWindow = created;
      node.contentParent = anchor;
      scrollWindow = created;
      content = anchor;
    }
    if (!scrollWindow || !content) return;
    const keep = fresh ? new vec2(0, normalizedFromTop((rows?.initialOffsetMeters ?? 0) * CM_PER_METER, height, contentHeight)) : scrollWindow.scrollPositionNormalized;
    scrollWindow.windowSize = new vec2(width, height);
    scrollWindow.scrollDimensions = new vec2(width, contentHeight);
    if (rows) scrollWindow.snapRegion = new vec2(0, rows.stepMeters * CM_PER_METER);
    content.getTransform().setLocalPosition(new vec3(0, contentHeight / 2, 0));
    scrollWindow.scrollPositionNormalized = keep;
  }

  scrollBy(node: ViroSpecsLensNode, deltaMeters: number): void {
    const scroll = node.scrollWindow;
    if (!scroll || isNull(scroll)) throw new Error("Node " + node.id + " is not a scroll group.");
    const height = scroll.windowSize.y;
    const contentHeight = scroll.scrollDimensions.y;
    const range = contentHeight - height;
    if (range <= 0) return;
    // ScrollWindow's normalized y is 1 at the content top and -1 at the bottom.
    const offset = ((1 - scroll.scrollPositionNormalized.y) / 2) * range;
    const next = Math.min(range, Math.max(0, offset + deltaMeters * CM_PER_METER));
    scroll.scrollPositionNormalized = new vec2(0, normalizedFromTop(next, height, contentHeight));
  }

  setAsset(node: ViroSpecsLensNode, asset: ViroSpecsLensAsset): void {
    if (node.kind === "image") {
      if (!node.image) throw new Error("Image node " + node.id + " has no Image component.");
      if (!node.image.mainMaterial) throw new Error("Image node " + node.id + " has no material; set defaultImageMaterial.");
      node.image.mainPass.baseTex = asset as Texture;
      return;
    }
    if (node.kind === "model") {
      if (node.model && !isNull(node.model)) node.model.destroy();
      node.model = (asset as ObjectPrefab).instantiate(node.object);
      node.model.name = "viro-model:" + node.id;
      if (node.opacity !== undefined && node.opacity !== 1) this.setOpacity(node, node.opacity);
      return;
    }
    throw new Error("Assets are only valid on image and model nodes: " + node.id);
  }

  showPlaceholder(node: ViroSpecsLensNode, extents: ViroSpecsExtents): boolean {
    this.clearPlaceholder(node);
    const base = this.assets.placeholderMaterial ?? this.assets.defaultImageMaterial;
    if (!base) return false;
    const w = extents.width * CM_PER_METER;
    const h = extents.height * CM_PER_METER;
    const d = node.kind === "model" ? Math.min(w, h) : 1;
    const object = global.scene.createSceneObject("viro-placeholder:" + node.id);
    object.setParent(node.object);
    object.layer = node.object.layer;
    const visual = object.createComponent("Component.RenderMeshVisual") as RenderMeshVisual;
    visual.mesh = buildBoxMesh(w, h, d);
    const material = base.clone();
    material.name = "viro-owned:placeholder:" + node.id;
    material.mainPass.baseColor = PLACEHOLDER_TINT;
    visual.mainMaterial = material;
    node.placeholder = object;
    return true;
  }

  clearPlaceholder(node: ViroSpecsLensNode): void {
    if (node.placeholder && !isNull(node.placeholder)) node.placeholder.destroy();
    node.placeholder = undefined;
  }

  setMaterial(node: ViroSpecsLensNode, material: Material | null): void {
    this.applyMaterial(node, material);
    if (node.opacity !== undefined && node.opacity !== 1) this.setOpacity(node, node.opacity);
  }

  private applyMaterial(node: ViroSpecsLensNode, material: Material | null): void {
    const resolved = material ?? (node.kind === "image" ? this.assets.defaultImageMaterial ?? null : null);
    if (node.image) {
      if (resolved) {
        // The image writes baseTex and opacity into its material, so it gets
        // its own clone rather than the shared registry or cached material.
        const texture = node.image.mainMaterial ? node.image.mainPass.baseTex : null;
        const own = resolved.clone();
        own.name = nodeMaterialName(node);
        node.image.mainMaterial = own;
        if (texture) node.image.mainPass.baseTex = texture;
      }
      return;
    }
    if (node.text) {
      if (resolved) node.text.customMaterial = resolved;
      return;
    }
    if (node.model && !isNull(node.model) && resolved) {
      for (const visual of collectMeshVisuals(node.model)) visual.mainMaterial = resolved;
    }
  }

  loadAsset(kind: "image" | "model", source: string): ViroSpecsLensAsset | null {
    return kind === "image" ? this.assets.resolveImage(source) : this.assets.resolveModel(source);
  }

  resolveMaterial(id: string): Material | null {
    return this.assets.resolveMaterial(id);
  }

  createMaterial(definition: ViroSpecsDocumentMaterial, texture: ViroSpecsLensAsset | null): Material | null {
    const base = this.assets.resolveMaterial(definition.id) ?? this.assets.defaultMaterial ?? this.assets.defaultImageMaterial;
    if (!base) return null;
    const material = base.clone();
    material.name = "viro-owned:material:" + definition.id;
    const rgba = definition.color !== undefined ? parseViroSpecsColor(definition.color) : [1, 1, 1, 1];
    const alpha = (rgba[3] ?? 1) * (definition.opacity ?? 1);
    material.mainPass.baseColor = new vec4(rgba[0] ?? 1, rgba[1] ?? 1, rgba[2] ?? 1, alpha);
    if (texture) material.mainPass.baseTex = texture as Texture;
    return material;
  }

  disposeMaterial(_material: Material): void {
    // Lens Materials have no destroy(). Dropping the host's last reference
    // (the cache entry and every visual that used it) lets Lens free it.
  }

  hasFont(family: string): boolean {
    return this.assets.resolveFont(family) !== null;
  }

  createLight(light: ViroSpecsDocumentLight, parent: ViroSpecsLensNode): ViroSpecsLensNode {
    const object = global.scene.createSceneObject("viro-light:" + light.id);
    object.setParent(parent.contentParent ?? parent.object);
    const source = object.createComponent("Component.LightSource") as LightSource;
    source.lightType =
      light.type === "ambient" ? LightType.Ambient
      : light.type === "directional" ? LightType.Directional
      : light.type === "omni" ? LightType.Point
      : LightType.Spot;
    const rgb = light.color !== undefined ? parseViroSpecsColor(light.color) : [1, 1, 1, 1];
    source.color = new vec3(rgb[0] ?? 1, rgb[1] ?? 1, rgb[2] ?? 1);
    // Viro intensity is in lumens with 1000 as its default; Lens uses 1.
    source.intensity = (light.intensity ?? 1000) / 1000;
    const t = object.getTransform();
    if (light.type === "omni" || light.type === "spot") {
      t.setLocalPosition(new vec3(light.position[0] * CM_PER_METER, light.position[1] * CM_PER_METER, light.position[2] * CM_PER_METER));
    }
    if (light.type === "directional" || light.type === "spot") {
      const d = new vec3(light.direction[0], light.direction[1], light.direction[2]).normalize();
      const up = Math.abs(d.y) > 0.99 ? vec3.forward() : vec3.up();
      t.setLocalRotation(quat.lookAt(d, up));
    }
    if (light.type === "spot") {
      if (light.innerAngle !== undefined) source.innerConeAngleDegrees = light.innerAngle;
      if (light.outerAngle !== undefined) source.outerConeAngleDegrees = light.outerAngle;
    }
    return { id: light.id, kind: "light", object };
  }

  createPolyline(line: ViroSpecsDocumentPolyline, material: Material | null, parent: ViroSpecsLensNode): ViroSpecsLensNode {
    const root = global.scene.createSceneObject("viro-line:" + line.id);
    root.setParent(parent.object);
    const points = line.points.map((p, index) => {
      const point = global.scene.createSceneObject("viro-line-point:" + line.id + ":" + index);
      point.setParent(root);
      point.getTransform().setWorldPosition(new vec3(p[0] * CM_PER_METER, p[1] * CM_PER_METER, p[2] * CM_PER_METER));
      return point;
    });
    const component = root.createComponent(VolumetricLine.getTypeName()) as VolumetricLine;
    component.pathPoints = points;
    const lineMaterial = material ?? this.assets.defaultLineMaterial;
    if (lineMaterial) component.material = lineMaterial;
    component.radius = line.radiusMeters * CM_PER_METER;
    component.useWorldPosition = true;
    component.useRelativeToComponent = true;
    component.continuousUpdate = false;
    component.smoothUpdate = false;
    // Runtime-created script components can receive lifecycle callbacks
    // before their inputs are assigned; build the mesh a frame later.
    //
    // VolumetricLine's autoCorrectOffset setter logs through a logger it
    // creates in onAwake, and onAwake does not run under the disabled staging
    // root. One frame is not enough: while a slow asset holds the scene in
    // staging the root is still disabled, and the setter threw "Cannot read
    // property 'debug' of undefined" (Preview, viro_ws4_preferences). Wait,
    // frame by frame, until commit has enabled the root.
    const build = (): void => {
      if (isNull(root)) return;
      if (!root.isEnabledInHierarchy) {
        this.deferFrame(build);
        return;
      }
      component.autoCorrectOffset = false;
      if (root.getComponent("Component.RenderMeshVisual")) component.updateMesh();
      else component.onStart();
    };
    this.deferFrame(build);
    return { id: line.id, kind: "polyline", object: root };
  }

  bindInteraction(
    node: ViroSpecsLensNode,
    interaction: ViroSpecsDocumentInteraction,
    emit: (event: ViroSpecsBackendInteraction) => void
  ): ViroSpecsCancel {
    const target = findViroSpecsInteractionTarget(node.object);
    target.name = "viro-interactable:" + node.id;
    const unbind = bindViroSpecsSik(target, { manipulation: interaction.manipulation, root: node.object }, (event) => {
      if (event.phase.startsWith("hover") && !interaction.events.includes("hover")) return;
      if (event.phase === "drag" && !interaction.events.includes("drag")) return;
      emit(event);
    });
    // ScrollWindow caches the colliders it enables; a write to
    // scrollDimensions refreshes that cache so new targets clip correctly.
    let ancestor: SceneObject | null = node.object.getParent();
    while (ancestor) {
      const scroll = ancestor.getComponent(ScrollWindow.getTypeName()) as ScrollWindow | null;
      if (scroll) scroll.scrollDimensions = scroll.scrollDimensions;
      ancestor = ancestor.getParent();
    }
    return unbind;
  }

  playAnimation(node: ViroSpecsLensNode, plan: ViroSpecsNativeAnimationPlan, onComplete: () => void): ViroSpecsCancel {
    return this.animations.playOn(node.object, plan, onComplete);
  }

  captureUiState(node: ViroSpecsLensNode): ViroSpecsNodeUiState {
    const scroll = node.scrollWindow;
    if (!scroll || isNull(scroll)) return {};
    const p = scroll.scrollPositionNormalized;
    return { scrollNormalized: [p.x, p.y] };
  }

  restoreUiState(node: ViroSpecsLensNode, state: ViroSpecsNodeUiState): void {
    const scroll = node.scrollWindow;
    if (!scroll || isNull(scroll) || !state.scrollNormalized) return;
    scroll.scrollPositionNormalized = new vec2(state.scrollNormalized[0], state.scrollNormalized[1]);
  }
}

/** Name of a material clone that belongs to one node only. */
function nodeMaterialName(node: ViroSpecsLensNode): string {
  return "viro-node:" + node.id;
}

function collectMeshVisuals(root: SceneObject): RenderMeshVisual[] {
  return collectComponents<RenderMeshVisual>(root, "Component.RenderMeshVisual");
}

function collectComponents<T>(root: SceneObject, type: string): T[] {
  const out: T[] = [];
  const visit = (object: SceneObject): void => {
    for (const component of object.getComponents(type as keyof ComponentNameMap)) out.push(component as unknown as T);
    for (const child of object.children) visit(child);
  };
  visit(root);
  return out;
}

/** Axis-aligned box centred on the origin, centimeters. */
function buildBoxMesh(w: number, h: number, d: number): RenderMesh {
  const builder = new MeshBuilder([
    { name: "position", components: 3 },
    { name: "normal", components: 3, normalized: true },
    { name: "texture0", components: 2 },
  ]);
  builder.topology = MeshTopology.Triangles;
  builder.indexType = MeshIndexType.UInt16;
  const x = w / 2;
  const y = h / 2;
  const z = d / 2;
  const faces: [number[], number[][]][] = [
    [[0, 0, 1], [[-x, -y, z], [x, -y, z], [x, y, z], [-x, y, z]]],
    [[0, 0, -1], [[x, -y, -z], [-x, -y, -z], [-x, y, -z], [x, y, -z]]],
    [[1, 0, 0], [[x, -y, z], [x, -y, -z], [x, y, -z], [x, y, z]]],
    [[-1, 0, 0], [[-x, -y, -z], [-x, -y, z], [-x, y, z], [-x, y, -z]]],
    [[0, 1, 0], [[-x, y, z], [x, y, z], [x, y, -z], [-x, y, -z]]],
    [[0, -1, 0], [[-x, -y, -z], [x, -y, -z], [x, -y, z], [-x, -y, z]]],
  ];
  const uv = [[0, 0], [1, 0], [1, 1], [0, 1]];
  faces.forEach(([normal, corners], face) => {
    builder.appendVerticesInterleaved(corners.flatMap((c, i) => [...c, ...normal, ...(uv[i] ?? [0, 0])]));
    const b = face * 4;
    builder.appendIndices([b, b + 1, b + 2, b, b + 2, b + 3]);
  });
  builder.updateMesh();
  return builder.getMesh();
}

/**
 * ScrollWindow's normalized y for a content offset from the top, in the same
 * units as the window: 1 shows the content top, -1 its bottom.
 */
function normalizedFromTop(offset: number, windowHeight: number, contentHeight: number): number {
  const range = contentHeight - windowHeight;
  if (range <= 0) return 1;
  return 1 - (2 * Math.min(range, Math.max(0, offset))) / range;
}
