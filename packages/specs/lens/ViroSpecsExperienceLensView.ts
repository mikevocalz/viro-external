/**
 * Lens side of the experience layer: draws the view from
 * {@linkcode ViroSpecsExperienceController}, feeds it the head ray for gaze
 * dwell, WorldQuery hits for placement and SIK pinches for confirm.
 *
 * Evidence: preview-validated. Compiled in Lens Studio and driven by the
 * Platform Lab's viro_ws4_* LEAF scenarios in Preview; the layout it draws
 * from (panel rows, error rows, scroll buttons, loading ring) is tested in
 * `scripts/experience.test.mjs`. Doc: `doc/Experience.md`.
 *
 * Rules this file keeps (Lens Studio compiler traps): result unions are
 * narrowed with `=== false`, and every package component (Interactable,
 * collider) is created under this component's own enabled overlay root, never
 * under the scene controller's disabled staging root.
 */
import {
  estimateViroSpecsLines,
  layoutViroSpecsButtonError,
  layoutViroSpecsModelReset,
  layoutViroSpecsScrollButtons,
  layoutViroSpecsStatePanel,
  unrenderedViroSpecsComponentFeatures,
  resolveViroSpecsButtonVisual,
  stepViroSpecsMove,
  viroSpecsAutoRotateDegrees,
  viroSpecsShowModelRing,
  viroSpecsDiscGeometry,
  viroSpecsLoadingRing,
  viroSpecsResetProgress,
  viroSpecsRoundedRectGeometry,
  ViroSpecsButtonTracker,
  ViroSpecsExperienceController,
  ViroSpecsGazeDwell,
  type ViroSpecsExperienceView,
  type ViroSpecsFlatGeometry,
  type ViroSpecsLineMeasure,
  type ViroSpecsTextBlock,
} from "./ViroSpecsExperience";
import {
  viroSpecsAngleToMeters,
  VIRO_SPECS_LENS_TEXT_EM_METERS_PER_SIZE,
  type ViroSpecsButtonAuthoredState,
  type ViroSpecsSpatialTokens,
} from "./ViroSpecsExperienceTokens";
import { Interactable, InteractionManager, InteractorInputType, InteractorTriggerType } from "./ViroSpecsInteractionKit";
import { ViroSpecsPlacementSession, type ViroSpecsPlacementHit, type ViroSpecsReticleView } from "./ViroSpecsPlacement";
import { createViroSpecsHostDiagnostic } from "./ViroSpecsHostDiagnostics";
import { formatViroSpecsCopy } from "./ViroSpecsExperienceCopy";
import type { ViroSpecsCapabilityState } from "./ViroSpecsProtocol";
import type { ViroSpecsHostNode, ViroSpecsHostScene } from "./ViroSpecsSceneDocument";
import { ViroSpecsSceneControllerHost } from "./ViroSpecsSceneControllerHost";
import { parseViroSpecsColor } from "./ViroSpecsSceneDocument";
import { bindViroSpecsSik } from "./ViroSpecsSikBinding";

const WorldQueryModule = require("LensStudio:WorldQueryModule") as WorldQueryModule;

const CM_PER_METER = 100;
/** Head-ray length for gaze targeting and WorldQuery, centimeters (the far edge of the comfort band). */
const RAY_CM = 300;
/**
 * Draw order of the experience overlay. State panels, the reticle and the
 * dwell disc draw after scene content (render order 0) with
 * depth test off, so content nearer than the panel (a line at 1.38 m in front
 * of a panel at 1.47 m) never shows through it.
 */
const OVERLAY_ORDER = { backing: 100, control: 101, text: 102 } as const;
/**
 * How far a label sits in front of the backing it is drawn on, centimeters.
 * Content inside a PanelButton (its label, a card's PanelImage) sits at least
 * this far in front of the hovered backing.
 */
const LABEL_LIFT_CM = 0.2;
/**
 * Text layouts the line measure may run in one frame. Lens Studio throws "Per
 * frame rate limit exceeded" when a frame lays out many strings (nine error
 * lines arriving at once did); past the budget a row uses the estimate and
 * the panel is laid out again on the next frame.
 */
const MEASURES_PER_FRAME = 4;
/** Segments in the loading ring. */
const RING_SEGMENTS = 24;

/** Lens objects the experience layer adds to a committed premium node. */
type Decoration = {
  readonly type: "spatial-panel" | "panel-button" | "panel-text";
  /** The node object it was built on; a different object under the same ID means a new scene. */
  readonly object: SceneObject;
  readonly backing: RenderMeshVisual | null;
  readonly label: Text | null;
  /** SpatialPanel title, or the PanelButton error message under the button. */
  readonly extra: Text | null;
  /** PanelText size as compiled, before the runtime 1.2 degree clamp. */
  readonly authoredSize: number;
};

type Panel = {
  readonly root: SceneObject;
  readonly backing: RenderMeshVisual | null;
  /** Loading ring: a parent to rotate and its segments, track-tinted or lit. */
  readonly ring: { readonly root: SceneObject; readonly segments: RenderMeshVisual[] } | null;
  readonly title: Text;
  readonly body: Text;
  readonly detail: Text;
  readonly action: SceneObject;
  readonly actionText: Text;
  readonly actionBacking: RenderMeshVisual | null;
  actionHovered: boolean;
  actionPressed: boolean;
  unbind: (() => void) | null;
  shownAtMs: number;
};

/** A ModelViewer's host-drawn parts: its load ring, Reset model button and turntable state. */
type ModelDecoration = {
  readonly object: SceneObject;
  readonly ring: { readonly root: SceneObject; readonly segments: RenderMeshVisual[] } | null;
  readonly reset: ScrollButton | null;
  /** Authored local transform, Lens units (cm), from the committed node. */
  readonly authored: { readonly position: vec3; readonly rotation: quat; readonly scale: vec3 };
  /** Bottom of the model's bounds below its origin, meters (negative is below), once measured. */
  bottomMeters: number | undefined;
  /** A Reset in progress: when it started and the transform it started from. */
  resetting: { readonly startMs: number; readonly position: vec3; readonly rotation: quat; readonly scale: vec3 } | null;
  pendingSinceMs: number;
};

/** A PanelImage drawn on a rounded-rectangle mesh in place of its square Image quad. */
type RoundedImage = {
  readonly image: Image;
  readonly visual: RenderMeshVisual;
  /** Width, height (world cm) and radius the mesh was built for. */
  key: string;
};

/** A gaze Scroll up or Scroll down button on one scroll group. */
type ScrollButton = {
  readonly root: SceneObject;
  readonly backing: RenderMeshVisual | null;
  readonly label: Text;
  readonly unbind: () => void;
};

function rgba(hex: string, alpha = 1): vec4 {
  const [r, g, b] = parseViroSpecsColor(hex);
  return new vec4(r, g, b, alpha);
}

/**
 * Wraps `text` inside a box `widthCm` wide and `heightCm` tall centred on its
 * object, so a line never runs past the panel it sits on.
 */
function wrapText(text: Text, widthCm: number, heightCm: number): void {
  text.horizontalOverflow = HorizontalOverflow.Wrap;
  text.verticalOverflow = VerticalOverflow.Overflow;
  text.horizontalAlignment = HorizontalAlignment.Center;
  text.verticalAlignment = VerticalAlignment.Center;
  text.layoutRect = Rect.create(-widthCm / 2, widthCm / 2, -heightCm / 2, heightCm / 2);
}

/** A RenderMesh from portable flat geometry (position, normal, UV). */
function meshFrom(geometry: ViroSpecsFlatGeometry): RenderMesh {
  const builder = new MeshBuilder([
    { name: "position", components: 3 },
    { name: "normal", components: 3, normalized: true },
    { name: "texture0", components: 2 },
  ]);
  builder.topology = MeshTopology.Triangles;
  builder.indexType = MeshIndexType.UInt16;
  builder.appendVerticesInterleaved(geometry.vertices.slice());
  builder.appendIndices(geometry.indices.slice());
  builder.updateMesh();
  return builder.getMesh();
}

/** Lowest world Y (cm) of every mesh visual under `object`, or undefined when it draws none. */
function lowestPointCm(object: SceneObject): number | undefined {
  let lowest: number | undefined;
  const visit = (o: SceneObject): void => {
    const visuals = o.getComponents("Component.RenderMeshVisual") as RenderMeshVisual[];
    for (const visual of visuals) {
      const y = visual.worldAabbMin().y;
      if (lowest === undefined || y < lowest) lowest = y;
    }
    for (const child of o.children) visit(child);
  };
  visit(object);
  return lowest;
}

/** Lens Text size whose em is `angleDeg` tall at `distanceMeters`. */
function sizeFor(angleDeg: number, distanceMeters: number): number {
  return Math.ceil((viroSpecsAngleToMeters(angleDeg, distanceMeters) / VIRO_SPECS_LENS_TEXT_EM_METERS_PER_SIZE) * 10) / 10;
}

/**
 * Draws the loading panel, degraded notice, error and permission panels, the
 * placement reticle and the gaze dwell around a {@linkcode ViroSpecsSceneControllerHost}.
 *
 * Inputs: the host, the camera, and optionally a unit plane mesh plus a
 * material for panel backings, the reticle and the dwell disc. Without them
 * panels are text only and a warning is logged once. It also draws the
 * ModelViewer load ring, Reset model button and turntable, rounds PanelImage
 * corners, and holds drags in the comfort band through the scene
 * controller's drag constraint.
 */
@component
export class ViroSpecsExperienceHost extends BaseScriptComponent {
  @input
  @hint("SceneObject with ViroSpecsSceneControllerHost")
  sceneHostObject: SceneObject;

  @input
  @hint("The camera; panels open 1.5 m along its view")
  cameraObject: SceneObject;

  @input
  @allowUndefined
  @hint("Unit plane (1 x 1 cm) for panel backings; the reticle and dwell disc build their own disc mesh")
  panelMesh: RenderMesh | null = null;

  @input
  @allowUndefined
  @hint("Unlit material tinted from the tokens; cloned per visual")
  panelMaterial: Material | null = null;

  @input
  @hint("The scene places content on surfaces")
  placementScene: boolean = false;

  @input
  @hint("Every function has a gaze path (dwell, step buttons)")
  gazeOnly: boolean = true;

  @input
  @hint("Show unverified notices and diagnostic lines (debug builds)")
  builderMode: boolean = false;

  @input
  highContrast: boolean = false;

  @input
  reducedMotion: boolean = false;

  private host: ViroSpecsSceneControllerHost | null = null;
  private experience: ViroSpecsExperienceController | null = null;
  private tracker: ViroSpecsButtonTracker | null = null;
  private dwell: ViroSpecsGazeDwell | null = null;
  private overlay: SceneObject | null = null;
  private panels = new Map<"loading" | "notice" | "error" | "permission", Panel>();
  private reticle: { root: SceneObject; disc: RenderMeshVisual | null; label: Text } | null = null;
  private models = new Map<string, ModelDecoration>();
  private roundedImages = new Map<string, RoundedImage>();
  /** Model nodes the wearer is holding or dragging; their turntable pauses. */
  private readonly heldModels = new Set<string>();
  private discMesh: RenderMesh | null = null;
  private placement: ViroSpecsPlacementSession | null = null;
  private hitSession: HitTestSession | null = null;
  private probe: Probe | null = null;
  private decorations = new Map<string, Decoration>();
  private dwellRoot: SceneObject | null = null;
  private lastRendered: ViroSpecsExperienceView | null = null;
  private decoratedScene: ViroSpecsHostScene | null = null;
  private reportedUnrendered = new Set<string>();
  private pinchOnInteractable = false;
  private dwellDisc: RenderMeshVisual | null = null;
  private wasTriggering = false;
  private warnedNoMesh = false;
  private scrollButtons = new Map<string, { up: ScrollButton; down: ScrollButton }>();
  /** Invisible Text the overlay lays strings out in to count their lines. */
  private measureText: Text | null = null;
  private readonly measuredLines = new Map<string, number>();
  /** Measurements left this frame; Lens limits how often a frame may lay out text. */
  private measureBudget = MEASURES_PER_FRAME;
  /** A row used the estimate because the budget ran out or layout threw; re-render next frame. */
  private measureDeferred = false;
  private readonly placementListeners = new Set<(pose: { position: [number, number, number]; normal: [number, number, number] }) => void>();
  private readonly retryListeners = new Set<(nodeIds: readonly string[]) => void>();

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => this.start());
    this.createEvent("UpdateEvent").bind(() => this.update());
    this.createEvent("OnDestroyEvent").bind(() => this.dispose());
    // Disabled, the experience layer stops gating the scene; enabled again,
    // the last view applies.
    this.createEvent("OnDisableEvent").bind(() => this.setContentVisible(true));
    this.createEvent("OnEnableEvent").bind(() => {
      if (this.lastRendered) this.setContentVisible(this.lastRendered.sceneVisible);
    });
  }

  /** The portable controller, for app code and LEAF scenarios. Null until start. */
  get controller(): ViroSpecsExperienceController | null {
    return this.experience;
  }

  /** Capability report from the runtime; switches input mode without a restart. */
  setCapabilities(report: Readonly<Record<string, ViroSpecsCapabilityState>>): void {
    this.experience?.setCapabilities(report);
  }

  /** High contrast and reduced motion, from an app setting. */
  setPreferences(highContrast: boolean, reducedMotion: boolean): void {
    this.highContrast = highContrast;
    this.reducedMotion = reducedMotion;
    this.experience?.setPreferences({ highContrast, reducedMotion });
  }

  /** Starts a placement attempt (Placement scene, or "Place again"). */
  startPlacement(): void {
    const view = this.experience?.view();
    if (!view || view.hidden.placement) return;
    if (!this.placement) {
      this.placement = new ViroSpecsPlacementSession({ tokens: view.tokens, reducedMotion: this.reducedMotion });
    } else {
      this.placement.restart();
    }
    if (!this.hitSession) {
      const options = HitTestSessionOptions.create();
      options.filter = true;
      this.hitSession = WorldQueryModule.createHitTestSessionWithOptions(options);
      this.hitSession.start();
    }
  }

  /** Pinch or "Place here": places at the current valid hit. */
  confirmPlacement(): boolean {
    const result = this.placement?.pinch();
    if (!result || result.placed === false) return false;
    const relative = this.experience?.clampToComfortBand("placement", result.position) ?? result.position;
    // Listeners get world meters: the wearer-relative pose plus the head position.
    const head = this.headRay()?.start ?? vec3.zero();
    const position: [number, number, number] = [
      relative[0] + head.x / CM_PER_METER,
      relative[1] + head.y / CM_PER_METER,
      relative[2] + head.z / CM_PER_METER,
    ];
    for (const listener of Array.from(this.placementListeners)) listener({ position, normal: result.normal });
    return true;
  }

  /** Receives each confirmed placement pose, in meters. */
  addOnPlacementListener(listener: (pose: { position: [number, number, number]; normal: [number, number, number] }) => void): { remove(): void } {
    this.placementListeners.add(listener);
    return { remove: () => this.placementListeners.delete(listener) };
  }

  /** Receives the node IDs a Retry asks to reload. */
  addOnRetryListener(listener: (nodeIds: readonly string[]) => void): { remove(): void } {
    this.retryListeners.add(listener);
    return { remove: () => this.retryListeners.delete(listener) };
  }

  /** Gaze Move button: steps a node 10 cm and keeps it in the comfort band. */
  moveNode(nodeId: string, direction: "left" | "right" | "closer" | "away"): void {
    const object = this.host?.getNode(nodeId) ?? null;
    const experience = this.experience;
    if (!object || !experience) return;
    const head = this.headRay()?.start ?? vec3.zero();
    const p = object.getTransform().getWorldPosition().sub(head);
    const next = stepViroSpecsMove([p.x / CM_PER_METER, p.y / CM_PER_METER, p.z / CM_PER_METER], direction, experience.view().tokens.input.gazeStepMeters);
    const clamped = experience.clampToComfortBand(nodeId, next);
    object.getTransform().setWorldPosition(head.add(new vec3(clamped[0] * CM_PER_METER, clamped[1] * CM_PER_METER, clamped[2] * CM_PER_METER)));
  }

  /**
   * The scene host's drag constraint: keeps a dragged node inside the comfort
   * band around the wearer's head. SIK manipulation has already moved the
   * node this frame; a position past the band is pulled back to its edge,
   * `VS5023` is reported once per excursion, and the returned position (world
   * meters) is the one every drag listener receives.
   */
  private holdInComfortBand(nodeId: string, reported: [number, number, number]): [number, number, number] {
    const object = this.host?.getNode(nodeId) ?? null;
    const experience = this.experience;
    if (!object || !experience) return reported;
    const head = this.headRay()?.start ?? vec3.zero();
    const p = object.getTransform().getWorldPosition().sub(head);
    const position: [number, number, number] = [p.x / CM_PER_METER, p.y / CM_PER_METER, p.z / CM_PER_METER];
    const clamped = experience.clampToComfortBand(nodeId, position);
    if (clamped === position) return reported;
    const world = head.add(new vec3(clamped[0] * CM_PER_METER, clamped[1] * CM_PER_METER, clamped[2] * CM_PER_METER));
    object.getTransform().setWorldPosition(world);
    return [world.x / CM_PER_METER, world.y / CM_PER_METER, world.z / CM_PER_METER];
  }

  private start(): void {
    const host = this.sceneHostObject
      ? (this.sceneHostObject.getComponent(ViroSpecsSceneControllerHost.getTypeName()) as ViroSpecsSceneControllerHost | null)
      : null;
    if (!host || host.isReady === false) {
      console.error("[viro-specs-experience] error: ViroSpecsExperienceHost needs a ready ViroSpecsSceneControllerHost on sceneHostObject.");
      return;
    }
    this.host = host;
    this.overlay = global.scene.createSceneObject("ViroSpecsExperienceOverlay");
    this.overlay.setParent(this.getSceneObject());
    const experience = new ViroSpecsExperienceController({
      requirements: { placement: this.placementScene, gazeOnly: this.gazeOnly },
      diagnostics: host.diagnosticsChannel,
      nowMs: () => getTime() * 1000,
      builderMode: this.builderMode,
      preferences: { highContrast: this.highContrast, reducedMotion: this.reducedMotion },
    });
    this.experience = experience;
    experience.attach(host);

    const authored = (id: string): ViroSpecsButtonAuthoredState | undefined => {
      const node = host.committedScene?.nodes.find((n) => n.id === id);
      return node?.component?.type === "panel-button" ? node.component.state : undefined;
    };
    this.tracker = new ViroSpecsButtonTracker(authored);
    host.addOnInteractionListener((event) => {
      this.tracker?.handle(event);
      if (event.phase === "select-start" || event.phase === "drag") this.heldModels.add(event.nodeId);
      else if (event.phase === "select-end" || event.phase === "cancel") this.heldModels.delete(event.nodeId);
    });
    // Hand drags stay in the comfort band, like gaze Move and placement. The
    // constraint runs before every listener, so app drag listeners get the
    // clamped position.
    host.setDragConstraint((nodeId, position) => this.holdInComfortBand(nodeId, position));
    this.dwell = new ViroSpecsGazeDwell(
      () => experience.view().tokens.input.gazeDwellMs,
      (id) => {
        const state = authored(id);
        return state === undefined || (state !== "disabled" && state !== "loading");
      },
      (id) => this.selectByGaze(id)
    );
    this.probe = Physics.createGlobalProbe();
    experience.addOnViewListener((view) => this.render(view));
    // Decorate after each commit or patch: nodes are live (never under the
    // disabled staging root) by the time the lifecycle listener runs.
    host.addOnLifecycleListener(() => this.decorate());
    this.decorate();
  }

  /** Adds backings and labels to committed premium nodes, and drops decorations of removed nodes. */
  private decorate(): void {
    const host = this.host;
    const scene = host?.committedScene ?? null;
    this.decoratedScene = scene;
    if (!host || !scene) return;
    const live = new Set<string>();
    for (const node of scene.nodes) {
      const component = node.component;
      if (!component) continue;
      const missing = unrenderedViroSpecsComponentFeatures(component);
      if (missing.length > 0 && !this.reportedUnrendered.has(node.id + ":" + component.type)) {
        this.reportedUnrendered.add(node.id + ":" + component.type);
        host.diagnosticsChannel.report(
          createViroSpecsHostDiagnostic("VS5025", "experience", node.id + " (" + component.type + "): not drawn yet: " + missing.join(", ") + ".", { nodeId: node.id })
        );
      }
      if (component.type === "model-viewer" || component.type === "panel-image") {
        const object = host.getNode(node.id);
        if (!object) continue;
        live.add(node.id);
        if (component.type === "model-viewer" && this.models.get(node.id)?.object !== object) {
          this.removeModel(node.id);
          this.models.set(node.id, this.createModel(node, object, component.resettable));
        }
        continue;
      }
      if (component.type !== "spatial-panel" && component.type !== "panel-button" && component.type !== "panel-text") continue;
      const object = host.getNode(node.id);
      if (!object) continue;
      live.add(node.id);
      // Same ID on a new SceneObject (navigation replaced the scene): rebuild.
      if (this.decorations.get(node.id)?.object === object) continue;
      let backing: RenderMeshVisual | null = null;
      let label: Text | null = null;
      let extra: Text | null = null;
      const addText = (name: string, y: number): Text => {
        const child = global.scene.createSceneObject(name);
        child.setParent(object);
        child.getTransform().setLocalPosition(new vec3(0, y, 0.6));
        const text = child.createComponent("Component.Text") as Text;
        text.depthTest = true;
        return text;
      };
      // The backing goes first. SIK binds a node's interaction a frame after
      // commit, on the node's first drawing child, so a button's target is
      // its backing (sized to the button) and never its title or error line.
      if (component.type !== "panel-text") {
        backing = this.makeBacking(object);
        const extents = node.kind === "panel" ? node.extents : undefined;
        if (backing && extents) {
          backing.getSceneObject().getTransform().setLocalScale(new vec3(extents.width * CM_PER_METER, extents.height * CM_PER_METER, 1));
        }
      }
      const extentsH = node.kind === "panel" && node.extents ? node.extents.height * CM_PER_METER : 0;
      if (component.type === "spatial-panel" && component.title !== undefined) {
        extra = addText("title", extentsH / 2 - 4);
        extra.text = component.title;
      }
      if (component.type === "panel-button" && component.errorMessage !== undefined) {
        // Positioned and wrapped at the button width in styleDecorations.
        extra = addText("errorMessage", 0);
        extra.text = component.errorMessage;
      }
      if (component.type === "panel-button") {
        const labelObject = global.scene.createSceneObject("label");
        labelObject.setParent(object);
        labelObject.getTransform().setLocalPosition(new vec3(0, 0, 0.6));
        label = labelObject.createComponent("Component.Text") as Text;
        label.depthTest = true;
      }
      const textComponent = component.type === "panel-text" ? (object.getComponent("Component.Text") as Text | null) : null;
      this.decorations.set(node.id, { type: component.type, object, backing, label, extra, authoredSize: textComponent ? textComponent.size : 0 });
    }
    for (const id of Array.from(this.decorations.keys())) {
      if (!live.has(id)) this.decorations.delete(id);
    }
    for (const id of Array.from(this.models.keys())) {
      if (!live.has(id)) this.removeModel(id);
    }
    for (const [id, rounded] of Array.from(this.roundedImages)) {
      if (!live.has(id) || isNull(rounded.image)) {
        if (!isNull(rounded.visual)) rounded.visual.getSceneObject().destroy();
        this.roundedImages.delete(id);
      }
    }
    this.tracker?.retain(new Set(host.nodeIds));
  }

  /** Applies token colors, button states and the text minimum to decorated nodes. Runs every frame. */
  private styleDecorations(tokens: ViroSpecsSpatialTokens): void {
    const host = this.host;
    const scene = host?.committedScene;
    const tracker = this.tracker;
    if (!host || !scene || !tracker) return;
    for (const node of scene.nodes) {
      if (node.component?.type === "panel-image") this.roundImage(node, tokens);
      const decoration = this.decorations.get(node.id);
      const component = node.component;
      if (!decoration || !component) continue;
      const object = host.getNode(node.id);
      if (!object) continue;
      const distance = this.distanceToWearer(object);
      if (component.type === "spatial-panel") {
        if (decoration.backing) decoration.backing.mainPass.baseColor = rgba(tokens.color.surface, tokens.opacity.surface);
        if (decoration.extra) {
          decoration.extra.size = sizeFor(tokens.type.titleDeg, distance);
          decoration.extra.textFill.color = rgba(tokens.color.text);
          if (node.kind === "panel" && node.extents) {
            const em = viroSpecsAngleToMeters(tokens.type.titleDeg, distance);
            const wrap = node.extents.width - 2 * viroSpecsAngleToMeters(tokens.space.mdDeg, distance);
            wrapText(decoration.extra, wrap * CM_PER_METER, em * tokens.type.lineHeight * CM_PER_METER);
          }
        }
      } else if (component.type === "panel-button") {
        const label = node.label ?? "";
        const visual = resolveViroSpecsButtonVisual(label, component.state, tracker.interactionOf(node.id), tokens);
        if (decoration.backing) {
          decoration.backing.mainPass.baseColor = rgba(visual.fill);
          // Hover scale and depth go on the backing, never on the node, so the
          // authored node transform is untouched.
          if (node.kind === "panel" && node.extents) {
            const t = decoration.backing.getSceneObject().getTransform();
            t.setLocalScale(new vec3(node.extents.width * CM_PER_METER * visual.scale, node.extents.height * CM_PER_METER * visual.scale, 1));
            t.setLocalPosition(new vec3(0, 0, visual.depthMeters * CM_PER_METER));
          }
        }
        if (decoration.extra) {
          decoration.extra.getSceneObject().enabled = component.state === "error";
          decoration.extra.size = sizeFor(tokens.type.labelDeg, distance);
          decoration.extra.textFill.color = rgba(tokens.color.error);
          if (node.kind === "panel" && node.extents) {
            // A row under the button, across the SpatialPanel it sits on;
            // the scene leaves that row free (viro's gallery layout test
            // checks it).
            const parent = node.parentId !== undefined ? scene.nodes.find((n) => n.id === node.parentId) : undefined;
            const panel =
              parent && parent.kind === "panel" && parent.extents && parent.component?.type === "spatial-panel"
                ? { width: parent.extents.width, buttonX: node.position?.[0] ?? 0 }
                : undefined;
            const block = layoutViroSpecsButtonError(tokens, node.extents, decoration.extra.text, distance, panel, this.measureLines);
            wrapText(decoration.extra, block.wrapWidthMeters * CM_PER_METER, block.heightMeters * CM_PER_METER);
            decoration.extra.getSceneObject().getTransform().setLocalPosition(new vec3(block.x * CM_PER_METER, block.y * CM_PER_METER, 0.6));
          }
        }
        if (decoration.label) {
          // In front of the backing in every state: hover raises it to depth.hover.
          decoration.label.getSceneObject().getTransform().setLocalPosition(new vec3(0, 0, tokens.depth.hoverMeters * CM_PER_METER + LABEL_LIFT_CM));
          decoration.label.text = (visual.glyph === "check" ? "\u2713 " : visual.glyph === "error" ? "! " : "") + visual.labelText;
          decoration.label.size = sizeFor(tokens.type.labelDeg, distance);
          decoration.label.textFill.color = rgba(visual.labelColor);
        }
      } else if (component.type === "panel-text") {
        const text = object.getComponent("Component.Text") as Text | null;
        if (!text) continue;
        text.textFill.color = rgba(component.tone === "muted" ? tokens.color.textMuted : tokens.color.text);
        // Clamp from the compiled size, so text shrinks back when it comes closer.
        const size = this.experience?.minimumTextSize(node.id, decoration.authoredSize, distance) ?? decoration.authoredSize;
        if (size !== text.size) text.size = size;
      }
    }
  }

  private update(): void {
    const experience = this.experience;
    if (!experience) return;
    experience.tick();
    this.measureBudget = MEASURES_PER_FRAME;
    if (this.measureDeferred && this.lastRendered) {
      this.measureDeferred = false;
      this.render(this.lastRendered);
    }
    const view = experience.view();
    // A replacement in the same lifecycle state fires no lifecycle event.
    if ((this.host?.committedScene ?? null) !== this.decoratedScene) this.decorate();
    this.styleDecorations(view.tokens);
    this.drawScrollButtons(view);
    this.drawModels(view);
    // A spinning ring (unknown progress) moves without a view change.
    const loadingPanel = this.panels.get("loading");
    if (loadingPanel && loadingPanel.root.enabled && view.loading.visible === true && view.loading.indicator === "ring-spin") {
      const ring = layoutViroSpecsStatePanel(view.tokens, { title: view.loading.title, body: view.loading.line, detail: "", action: null, ring: true }, view.tokens.distance.defaultMeters, this.measureLines).ring;
      this.drawRing(loadingPanel, ring, view.tokens);
    }
    const ray = this.headRay();
    if (!ray) return;
    if (view.inputMode === "gaze") this.gazeTarget(ray.start, ray.end);
    else {
      this.dwell?.reset();
      this.drawDwell(null);
    }
    this.updatePlacement(ray.start, ray.end, view);
  }

  /** Distance from the wearer's head to `object`, meters. */
  private distanceToWearer(object: SceneObject): number {
    const head = this.headRay()?.start ?? vec3.zero();
    return Math.max(object.getTransform().getWorldPosition().distance(head) / CM_PER_METER, 0.01);
  }

  private headRay(): { start: vec3; end: vec3 } | null {
    if (!this.cameraObject) return null;
    const t = this.cameraObject.getTransform();
    const start = t.getWorldPosition();
    // Lens cameras look down local -Z.
    const forward = t.getWorldRotation().multiplyVec3(new vec3(0, 0, -1));
    return { start, end: start.add(forward.uniformScale(RAY_CM)) };
  }

  private gazeTarget(start: vec3, end: vec3): void {
    const probe = this.probe;
    const host = this.host;
    if (!probe || !host) return;
    probe.rayCast(start, end, (hit: RayCastHit | null) => {
      const now = getTime() * 1000;
      let object: SceneObject | null = hit ? hit.collider.getSceneObject() : null;
      const byObject = new Map<SceneObject, string>();
      for (const id of host.nodeIds) {
        const node = host.getNode(id);
        if (node) byObject.set(node, id);
      }
      for (const [key, panel] of this.panels) {
        if (panel.root.enabled) byObject.set(panel.action, "experience:" + key);
      }
      for (const [id, buttons] of this.scrollButtons) {
        if (buttons.up.root.enabled) byObject.set(buttons.up.root, "experience:scroll-up:" + id);
        if (buttons.down.root.enabled) byObject.set(buttons.down.root, "experience:scroll-down:" + id);
      }
      for (const [id, model] of this.models) {
        if (model.reset && model.reset.root.enabled) byObject.set(model.reset.root, "experience:reset:" + id);
      }
      let target: string | undefined;
      while (object && target === undefined) {
        target = byObject.get(object);
        object = object.getParent();
      }
      const dwell = this.dwell?.update(target, now);
      this.drawDwell(hit && dwell && dwell.progress > 0 && dwell.progress < 1 ? { point: hit.position, toward: start, progress: dwell.progress } : null);
    });
  }

  /**
   * Gaze dwell feedback: a `color.focus` disc on the gazed control that grows
   * to `input.reticleDeg` as the dwell fills, so the wearer sees a selection
   * coming and can look away to stop it. Growth, not movement, so it stays
   * under reduced motion.
   */
  private drawDwell(state: { point: vec3; toward: vec3; progress: number } | null): void {
    const view = this.experience?.view();
    if (!this.overlay || !view) return;
    if (!this.dwellDisc) {
      const object = global.scene.createSceneObject("ViroSpecsDwell");
      object.setParent(this.overlay);
      this.dwellDisc = this.makeDisc(object, OVERLAY_ORDER.control);
      this.dwellDisc?.getSceneObject().getTransform().setLocalPosition(new vec3(0, 0, 0));
      this.dwellRoot = object;
    }
    const root = this.dwellRoot;
    if (!root) return;
    if (!state) {
      root.enabled = false;
      return;
    }
    root.enabled = true;
    const direction = state.toward.sub(state.point).normalize();
    const t = root.getTransform();
    // 1 cm toward the wearer so the disc never z-fights the control.
    t.setWorldPosition(state.point.add(direction.uniformScale(1)));
    t.setWorldRotation(quat.lookAt(direction, vec3.up()));
    const distance = Math.max(state.point.sub(state.toward).length / CM_PER_METER, 0.01);
    const diameter = viroSpecsAngleToMeters(view.tokens.input.reticleDeg, distance) * CM_PER_METER * state.progress;
    if (this.dwellDisc) {
      this.dwellDisc.getSceneObject().getTransform().setLocalScale(new vec3(diameter, diameter, 1));
      this.dwellDisc.mainPass.baseColor = rgba(view.tokens.color.focus, 0.85);
    }
  }

  private selectByGaze(id: string): void {
    if (id.startsWith("experience:reset:")) {
      this.resetModel(id.slice("experience:reset:".length));
      return;
    }
    if (id.startsWith("experience:scroll-up:")) {
      this.scrollGroup(id.slice("experience:scroll-up:".length), -1);
      return;
    }
    if (id.startsWith("experience:scroll-down:")) {
      this.scrollGroup(id.slice("experience:scroll-down:".length), 1);
      return;
    }
    if (id.startsWith("experience:")) {
      this.activatePanel(id.slice("experience:".length) as "loading" | "notice" | "error" | "permission");
      return;
    }
    this.host?.dispatchInteraction({ nodeId: id, phase: "select-start", source: "gaze" });
    this.host?.dispatchInteraction({ nodeId: id, phase: "select-end", source: "gaze" });
  }

  private updatePlacement(start: vec3, end: vec3, view: ViroSpecsExperienceView): void {
    const placement = this.placement;
    const session = this.hitSession;
    if (!placement || !session || view.hidden.placement) {
      this.drawReticle(undefined, view.tokens);
      return;
    }
    session.hitTest(start, end, (result: WorldQueryHitTestResult | null) => {
      const now = getTime() * 1000;
      let hit: ViroSpecsPlacementHit | null = null;
      if (result) {
        // Relative to the wearer: the comfort band and the floor height are
        // measured from the head, not from where the Lens started.
        const p = result.position.sub(start);
        const n = result.normal;
        hit = { position: [p.x / CM_PER_METER, p.y / CM_PER_METER, p.z / CM_PER_METER], normal: [n.x, n.y, n.z] };
      }
      placement.update(hit, now);
      this.drawReticle(placement.view(), view.tokens, start);
    });
    // Pinch release confirms (hands mode). Gaze mode uses "Place here".
    let triggering = false;
    for (const interactor of InteractionManager.getInstance().getInteractorsByType(InteractorInputType.All)) {
      if (interactor.currentTrigger !== InteractorTriggerType.None) {
        triggering = true;
        // A pinch on a button or panel action is that control's, not a placement.
        if (interactor.currentInteractable) this.pinchOnInteractable = true;
      }
    }
    if (this.wasTriggering && !triggering && view.inputMode === "hands" && !this.pinchOnInteractable) this.confirmPlacement();
    if (!triggering) this.pinchOnInteractable = false;
    this.wasTriggering = triggering;
  }

  private drawReticle(reticle: ViroSpecsReticleView | undefined, tokens: ViroSpecsSpatialTokens, wearer?: vec3): void {
    if (!this.overlay) return;
    if (!this.reticle) {
      const root = global.scene.createSceneObject("ViroSpecsReticle");
      root.setParent(this.overlay);
      const disc = this.makeDisc(root, OVERLAY_ORDER.control);
      const labelObject = global.scene.createSceneObject("ViroSpecsReticleLabel");
      labelObject.setParent(root);
      const label = this.overlayText(labelObject);
      this.reticle = { root, disc, label };
    }
    const r = this.reticle;
    if (!reticle || reticle.visible === false || !reticle.position) {
      r.root.enabled = false;
      return;
    }
    r.root.enabled = true;
    const [x, y, z] = reticle.position;
    const origin = wearer ?? vec3.zero();
    r.root.getTransform().setWorldPosition(origin.add(new vec3(x * CM_PER_METER, y * CM_PER_METER, z * CM_PER_METER)));
    const distance = Math.max(Math.hypot(x, y, z), 0.01);
    const diameterCm = reticle.diameterMeters * CM_PER_METER;
    if (r.disc) {
      r.disc.getSceneObject().getTransform().setLocalScale(new vec3(diameterCm, diameterCm, 1));
      r.disc.mainPass.baseColor = reticle.tintColor !== undefined ? rgba(reticle.tintColor, reticle.tintOpacity) : rgba(reticle.ringColor, 0.6);
    }
    r.label.text = reticle.hint !== undefined ? reticle.label + "\n" + reticle.hint : reticle.label;
    r.label.size = sizeFor(tokens.type.labelDeg, distance);
    r.label.textFill.color = rgba(tokens.color.text);
    r.label.getSceneObject().getTransform().setLocalPosition(new vec3(0, diameterCm + viroSpecsAngleToMeters(tokens.space.smDeg, distance) * CM_PER_METER, 0));
  }

  /**
   * Counts the lines `text` wraps to in a Lens Text `wrapWidthMeters` wide at
   * the size the panels use for `emMeters`: one highlight rectangle per
   * line, read from a laid-out Text that draws nothing. Falls back to the
   * estimate when the overlay is not built yet or layout reports nothing.
   * Results are cached per string, size and width.
   */
  private readonly measureLines: ViroSpecsLineMeasure = (text, emMeters, wrapWidthMeters) => {
    if (text === "") return 0;
    const size = Math.ceil((emMeters / VIRO_SPECS_LENS_TEXT_EM_METERS_PER_SIZE) * 10) / 10;
    const wrapCm = wrapWidthMeters * CM_PER_METER;
    const key = size + "|" + wrapCm.toFixed(3) + "|" + text;
    const cached = this.measuredLines.get(key);
    if (cached !== undefined) return cached;
    const t = this.measuringText();
    if (!t) return estimateViroSpecsLines(text, emMeters, wrapWidthMeters);
    if (this.measureBudget <= 0) {
      this.measureDeferred = true;
      return estimateViroSpecsLines(text, emMeters, wrapWidthMeters);
    }
    this.measureBudget -= 1;
    const rows = new Set<number>();
    try {
      t.size = size;
      t.text = text;
      t.layoutRect = Rect.create(-wrapCm / 2, wrapCm / 2, -1000, 1000);
      for (const rect of t.getHighlightRects(0, text.length)) {
        if (rect.right - rect.left > 0) rows.add(Math.round(((rect.top + rect.bottom) / 2) * 10));
      }
    } catch (_error) {
      this.measureBudget = 0;
      this.measureDeferred = true;
      return estimateViroSpecsLines(text, emMeters, wrapWidthMeters);
    }
    const lines = rows.size > 0 ? rows.size : estimateViroSpecsLines(text, emMeters, wrapWidthMeters);
    this.measuredLines.set(key, lines);
    return lines;
  };

  private measuringText(): Text | null {
    if (this.measureText) return this.measureText;
    if (!this.overlay) return null;
    const object = global.scene.createSceneObject("ViroSpecsTextMeasure");
    object.setParent(this.overlay);
    const text = object.createComponent("Component.Text") as Text;
    text.horizontalOverflow = HorizontalOverflow.Wrap;
    text.verticalOverflow = VerticalOverflow.Overflow;
    text.horizontalAlignment = HorizontalAlignment.Center;
    text.verticalAlignment = VerticalAlignment.Center;
    // Laid out, never seen: fully transparent and far below the wearer.
    text.textFill.color = new vec4(0, 0, 0, 0);
    object.getTransform().setLocalPosition(new vec3(0, -100000, 0));
    this.measureText = text;
    return text;
  }

  private render(view: ViroSpecsExperienceView): void {
    this.lastRendered = view;
    const t = view.tokens;
    if (this.overlay) this.overlay.enabled = true;
    // A-check L4: scene content and its interactables appear only once the
    // scene is ready to use. Hiding the controller's content root disables
    // every node under it, SIK targets included; loading continues.
    this.setContentVisible(view.sceneVisible);
    const loading = view.loading;
    this.showPanel("loading", loading.visible === false ? null : {
      title: loading.title,
      // The ring shows the fraction; the line keeps the counts.
      body: loading.line,
      detail: "",
      action: null,
      surface: t.color.surface,
      accent: t.color.focus,
    }, t);
    this.showPanel("notice", view.notice ? {
      title: "",
      body: view.notice.message,
      detail: view.notice.builderLine ?? "",
      action: view.notice.dismissLabel,
      surface: t.color.degradedSurface,
      accent: t.color.degraded,
    } : null, t);
    this.showPanel("error", view.errorPanel ? {
      title: view.errorPanel.title,
      body: view.errorPanel.message,
      detail: view.errorPanel.diagnosticLines.join("\n"),
      action: view.errorPanel.actionLabel,
      surface: t.color.errorSurface,
      accent: t.color.error,
    } : null, t);
    this.showPanel("permission", view.permissionPanel ? {
      title: view.permissionPanel.title,
      body: view.permissionPanel.body,
      detail: "",
      action: view.permissionPanel.actionLabel,
      surface: t.color.surface,
      accent: t.color.focus,
    } : null, t);
  }

  private showPanel(
    key: "loading" | "notice" | "error" | "permission",
    content: { title: string; body: string; detail: string; action: string | null; surface: string; accent: string } | null,
    tokens: ViroSpecsSpatialTokens
  ): void {
    if (!content) {
      const existing = this.panels.get(key);
      if (existing) existing.root.enabled = false;
      return;
    }
    const panel = this.panels.get(key) ?? this.createPanel(key);
    const opening = panel.root.enabled === false || panel.shownAtMs === 0;
    panel.root.enabled = true;
    if (opening) {
      panel.shownAtMs = getTime() * 1000;
      this.placeInView(panel.root, tokens.distance.defaultMeters + (key === "loading" ? 0 : -tokens.depth.overlayMeters));
    }
    const d = tokens.distance.defaultMeters;
    const layout = layoutViroSpecsStatePanel(tokens, { ...content, ring: key === "loading" }, d, this.measureLines);
    const wrapCm = layout.wrapWidthMeters * CM_PER_METER;
    const line = (text: Text, value: string, block: ViroSpecsTextBlock | undefined, color: string) => {
      text.getSceneObject().enabled = block !== undefined;
      if (!block) return;
      text.text = value;
      text.size = Math.ceil((block.emMeters / VIRO_SPECS_LENS_TEXT_EM_METERS_PER_SIZE) * 10) / 10;
      text.textFill.color = rgba(color);
      wrapText(text, wrapCm, block.heightMeters * CM_PER_METER);
      text.getSceneObject().getTransform().setLocalPosition(new vec3(0, block.y * CM_PER_METER, 0.6));
    };
    line(panel.title, content.title, layout.title, content.accent);
    line(panel.body, content.body, layout.body, tokens.color.text);
    line(panel.detail, content.detail, layout.detail, tokens.color.textMuted);
    if (panel.backing) {
      // Opaque, sized to the rows: nothing runs past it and nothing behind
      // it shows through (it draws after content, depth test off).
      const bt = panel.backing.getSceneObject().getTransform();
      bt.setLocalScale(new vec3(layout.widthMeters * CM_PER_METER, layout.heightMeters * CM_PER_METER, 1));
      bt.setLocalPosition(vec3.zero());
      panel.backing.mainPass.baseColor = rgba(content.surface, 1);
    }
    this.drawRing(panel, layout.ring, tokens);
    panel.action.enabled = layout.action !== undefined && content.action !== null;
    if (layout.action && content.action !== null) {
      // The action is a PanelButton: same seven-state visual, hover ring and
      // press-commits-on-release rule as scene buttons.
      const visual = resolveViroSpecsButtonVisual(content.action, "idle", { hovered: panel.actionHovered, pressed: panel.actionPressed }, tokens);
      panel.actionText.text = visual.labelText;
      panel.actionText.size = sizeFor(tokens.type.labelDeg, d);
      panel.actionText.textFill.color = rgba(visual.labelColor);
      wrapText(panel.actionText, layout.action.widthMeters * CM_PER_METER, layout.action.heightMeters * CM_PER_METER);
      panel.action.getTransform().setLocalPosition(new vec3(0, layout.action.y * CM_PER_METER, 0.6));
      if (panel.actionBacking) {
        const bt = panel.actionBacking.getSceneObject().getTransform();
        bt.setLocalScale(new vec3(layout.action.widthMeters * CM_PER_METER * visual.scale, layout.action.heightMeters * CM_PER_METER * visual.scale, 1));
        bt.setLocalPosition(new vec3(0, 0, visual.depthMeters * CM_PER_METER));
        panel.actionBacking.mainPass.baseColor = rgba(visual.ring ? visual.border : visual.fill);
      }
      if (!panel.unbind) {
        panel.unbind = bindViroSpecsSik(panel.action, { manipulation: false, root: panel.action }, (event) => {
          if (event.phase === "hover-enter") panel.actionHovered = true;
          else if (event.phase === "hover-exit") panel.actionHovered = false;
          else if (event.phase === "select-start") panel.actionPressed = true;
          else if (event.phase === "cancel") panel.actionPressed = false;
          else if (event.phase === "select-end") {
            const commit = panel.actionPressed;
            panel.actionPressed = false;
            if (commit) this.activatePanel(key);
          }
          if (this.lastRendered) this.render(this.lastRendered);
        });
      }
    }
  }

  /**
   * The loading ring: `RING_SEGMENTS` quads on a circle, lit in `color.focus`
   * by {@linkcode viroSpecsLoadingRing} over a `color.border` track. Static
   * under reduced motion; only unknown progress without reduced motion spins.
   */
  private drawRing(panel: Panel, ring: { readonly y: number; readonly diameterMeters: number; readonly thicknessMeters: number } | undefined, tokens: ViroSpecsSpatialTokens): void {
    if (!panel.ring) return;
    panel.ring.root.enabled = ring !== undefined;
    const view = this.lastRendered?.loading;
    if (!ring || !view || view.visible === false) return;
    const state = viroSpecsLoadingRing(view.indicator, view.progress, RING_SEGMENTS, getTime() * 1000 - panel.shownAtMs, tokens);
    const rt = panel.ring.root.getTransform();
    rt.setLocalPosition(new vec3(0, ring.y * CM_PER_METER, 0.6));
    rt.setLocalRotation(quat.angleAxis(-state.turns * 2 * Math.PI, vec3.forward()));
    this.drawRingSegments(panel.ring, ring, state, tokens);
  }

  /** Lays `RING_SEGMENTS` quads on a circle under `target.root`, lit per `state`. The caller turns the root. */
  private drawRingSegments(
    target: { readonly root: SceneObject; readonly segments: RenderMeshVisual[] },
    ring: { readonly diameterMeters: number; readonly thicknessMeters: number },
    state: { readonly lit: readonly boolean[] },
    tokens: ViroSpecsSpatialTokens
  ): void {
    const radiusCm = ((ring.diameterMeters - ring.thicknessMeters) / 2) * CM_PER_METER;
    const lengthCm = ((Math.PI * ring.diameterMeters) / RING_SEGMENTS) * CM_PER_METER * 0.8;
    target.segments.forEach((segment, i) => {
      // Segment 0 at the top, then clockwise as seen by the wearer.
      const angle = Math.PI / 2 - (i / RING_SEGMENTS) * 2 * Math.PI;
      const t = segment.getSceneObject().getTransform();
      t.setLocalPosition(new vec3(Math.cos(angle) * radiusCm, Math.sin(angle) * radiusCm, 0));
      t.setLocalRotation(quat.angleAxis(angle + Math.PI / 2, vec3.forward()));
      t.setLocalScale(new vec3(lengthCm, ring.thicknessMeters * CM_PER_METER, 1));
      segment.mainPass.baseColor = state.lit[i] ? rgba(tokens.color.focus) : rgba(tokens.color.border);
    });
  }

  /**
   * Gaze Scroll up and Scroll down under every committed scroll group while
   * input is gaze-only (`gazeControls.scrollButtons`). Dwell on one scrolls
   * the list one row through `scrollByRows`; a pinch does the same when
   * hands come back. They follow the group's world transform each frame.
   */
  private drawScrollButtons(view: ViroSpecsExperienceView): void {
    const host = this.host;
    const scene = host?.committedScene ?? null;
    const live = new Set<string>();
    if (host && scene && view.gazeControls.scrollButtons && view.sceneVisible) {
      const d = view.tokens.distance.defaultMeters;
      for (const node of scene.nodes) {
        if (node.kind !== "group" || node.scroll === undefined) continue;
        const object = host.getNode(node.id);
        if (!object || !object.isEnabledInHierarchy) continue;
        live.add(node.id);
        const buttons = this.scrollButtons.get(node.id) ?? this.createScrollButtons(node.id);
        const layout = layoutViroSpecsScrollButtons(view.tokens, node.scroll, d);
        const world = object.getTransform();
        const place = (button: ScrollButton, at: { x: number; y: number }, label: string) => {
          button.root.enabled = true;
          const t = button.root.getTransform();
          t.setWorldPosition(world.getWorldTransform().multiplyPoint(new vec3(at.x * CM_PER_METER, at.y * CM_PER_METER, 0.6)));
          t.setWorldRotation(world.getWorldRotation());
          button.label.text = label;
          button.label.size = sizeFor(view.tokens.type.labelDeg, d);
          button.label.textFill.color = rgba(view.tokens.color.text);
          wrapText(button.label, layout.widthMeters * CM_PER_METER, layout.heightMeters * CM_PER_METER);
          if (button.backing) {
            button.backing.getSceneObject().getTransform().setLocalScale(new vec3(layout.widthMeters * CM_PER_METER, layout.heightMeters * CM_PER_METER, 1));
            button.backing.mainPass.baseColor = rgba(view.tokens.color.surfaceRaised);
          }
        };
        place(buttons.up, layout.up, formatViroSpecsCopy("gaze.scrollUp"));
        place(buttons.down, layout.down, formatViroSpecsCopy("gaze.scrollDown"));
      }
    }
    for (const [id, buttons] of this.scrollButtons) {
      if (live.has(id)) continue;
      buttons.up.root.enabled = false;
      buttons.down.root.enabled = false;
    }
  }

  private createScrollButtons(nodeId: string): { up: ScrollButton; down: ScrollButton } {
    const make = (direction: "up" | "down"): ScrollButton =>
      this.makeSceneButton("ViroSpecsScroll-" + direction + ":" + nodeId, () => this.scrollGroup(nodeId, direction === "up" ? -1 : 1));
    const buttons = { up: make("up"), down: make("down") };
    this.scrollButtons.set(nodeId, buttons);
    return buttons;
  }

  /**
   * A host-drawn button that belongs with scene content (gaze Scroll, Reset
   * model): a backing and a label under the overlay, depth-tested with the
   * scene so an open notice or error panel covers it like the rest of the
   * scene. A pinch released on it runs `onSelect`.
   */
  private makeSceneButton(name: string, onSelect: () => void): ScrollButton {
    const root = global.scene.createSceneObject(name);
    if (this.overlay) root.setParent(this.overlay);
    const backing = this.makeBacking(root);
    const labelObject = global.scene.createSceneObject("label");
    labelObject.setParent(root);
    labelObject.getTransform().setLocalPosition(new vec3(0, 0, 0.6));
    const label = labelObject.createComponent("Component.Text") as Text;
    label.depthTest = true;
    const unbind = bindViroSpecsSik(root, { manipulation: false, root }, (event) => {
      if (event.phase === "select-end") onSelect();
    });
    return { root, backing, label, unbind };
  }

  private createModel(node: ViroSpecsHostNode, object: SceneObject, resettable: boolean): ModelDecoration {
    const [px, py, pz] = node.position ?? [0, 0, 0];
    const [rx, ry, rz, rw] = node.rotation ?? [0, 0, 0, 1];
    const [sx, sy, sz] = node.scale ?? [1, 1, 1];
    let ring: ModelDecoration["ring"] = null;
    if (this.overlay && this.panelMesh && this.panelMaterial) {
      const root = global.scene.createSceneObject("ViroSpecsModelRing:" + node.id);
      root.setParent(this.overlay);
      const segments: RenderMeshVisual[] = [];
      for (let i = 0; i < RING_SEGMENTS; i++) {
        const visual = this.makeBacking(root, OVERLAY_ORDER.control);
        if (visual) segments.push(visual);
      }
      root.enabled = false;
      ring = { root, segments };
    }
    const reset = resettable ? this.makeSceneButton("ViroSpecsModelReset:" + node.id, () => this.resetModel(node.id)) : null;
    if (reset) reset.root.enabled = false;
    return {
      object,
      ring,
      reset,
      authored: {
        position: new vec3(px * CM_PER_METER, py * CM_PER_METER, pz * CM_PER_METER),
        // Portable quaternions are [x, y, z, w]; the Lens constructor is (w, x, y, z).
        rotation: new quat(rw, rx, ry, rz),
        scale: new vec3(sx, sy, sz),
      },
      bottomMeters: undefined,
      resetting: null,
      pendingSinceMs: getTime() * 1000,
    };
  }

  private removeModel(id: string): void {
    const model = this.models.get(id);
    if (!model) return;
    this.models.delete(id);
    this.heldModels.delete(id);
    model.reset?.unbind();
    if (model.reset && !isNull(model.reset.root)) model.reset.root.destroy();
    if (model.ring && !isNull(model.ring.root)) model.ring.root.destroy();
  }

  /** Starts returning a ModelViewer to its authored transform over `motion.base`. */
  resetModel(nodeId: string): void {
    const model = this.models.get(nodeId);
    if (!model || isNull(model.object)) return;
    const t = model.object.getTransform();
    model.resetting = { startMs: getTime() * 1000, position: t.getLocalPosition(), rotation: t.getLocalRotation(), scale: t.getLocalScale() };
  }

  /**
   * ModelViewer parts, every frame: the load ring at the model's origin while
   * its asset loads, the Reset model button under its authored bounds, a
   * Reset in progress, and the `autoRotate` turntable.
   */
  private drawModels(view: ViroSpecsExperienceView): void {
    const host = this.host;
    const scene = host?.committedScene ?? null;
    const drawn = new Set<string>();
    const now = getTime() * 1000;
    const head = this.headRay()?.start ?? vec3.zero();
    for (const node of host && scene ? scene.nodes : []) {
      const component = node.component;
      if (!host || component?.type !== "model-viewer") continue;
      const model = this.models.get(node.id);
      if (!model || isNull(model.object)) continue;
      drawn.add(node.id);
      const t = model.object.getTransform();
      const world = t.getWorldPosition();
      const distance = Math.max(world.distance(head) / CM_PER_METER, 0.01);
      const pending = host.isAssetPending(node.id);
      if (model.ring) {
        const showRing = viroSpecsShowModelRing(view.loading, pending);
        model.ring.root.enabled = showRing;
        if (showRing) {
          const bodyEm = viroSpecsAngleToMeters(view.tokens.type.bodyDeg, distance);
          const ring = { diameterMeters: 3 * bodyEm, thicknessMeters: viroSpecsAngleToMeters(view.tokens.shape.borderWidthFocusDeg, distance) * 2 };
          const state = viroSpecsLoadingRing(view.preferences.reducedMotion ? "dots" : "ring-spin", undefined, RING_SEGMENTS, now - model.pendingSinceMs, view.tokens);
          const rt = model.ring.root.getTransform();
          rt.setWorldPosition(world);
          // Faces the wearer (local +Z toward the head), spinning about its own axis.
          const toward = head.sub(world).normalize();
          rt.setWorldRotation(quat.lookAt(toward, vec3.up()).multiply(quat.angleAxis(-state.turns * 2 * Math.PI, vec3.forward())));
          this.drawRingSegments(model.ring, ring, state, view.tokens);
        }
      }
      if (!pending && model.bottomMeters === undefined && view.sceneVisible) {
        const bottom = lowestPointCm(model.object);
        if (bottom !== undefined) model.bottomMeters = (bottom - world.y) / CM_PER_METER;
      }
      if (model.resetting) {
        const k = viroSpecsResetProgress(now - model.resetting.startMs, view.tokens, view.preferences.reducedMotion);
        t.setLocalPosition(vec3.lerp(model.resetting.position, model.authored.position, k));
        t.setLocalRotation(quat.slerp(model.resetting.rotation, model.authored.rotation, k));
        t.setLocalScale(vec3.lerp(model.resetting.scale, model.authored.scale, k));
        if (k >= 1) model.resetting = null;
      } else if (component.autoRotate && !pending && view.sceneVisible) {
        const degrees = viroSpecsAutoRotateDegrees(getDeltaTime(), { reducedMotion: view.preferences.reducedMotion, held: this.heldModels.has(node.id) });
        if (degrees !== 0) t.setLocalRotation(t.getLocalRotation().multiply(quat.angleAxis((degrees * Math.PI) / 180, vec3.up())));
      }
      if (model.reset) {
        const show = view.sceneVisible && model.object.isEnabledInHierarchy && model.bottomMeters !== undefined;
        model.reset.root.enabled = show;
        if (show && model.bottomMeters !== undefined) {
          const layout = layoutViroSpecsModelReset(view.tokens, { bottomMeters: model.bottomMeters }, distance);
          // Under the authored origin, turned like the model's parent (the
          // panel it sits on), or facing the wearer at the scene root.
          const parent = model.object.getParent();
          const parentWorld = parent ? parent.getTransform() : null;
          const rotation = parentWorld ? parentWorld.getWorldRotation() : null;
          const origin = parentWorld ? parentWorld.getWorldTransform().multiplyPoint(model.authored.position) : model.authored.position;
          const at = origin.add((rotation ? rotation.multiplyVec3(vec3.up()) : vec3.up()).uniformScale(layout.y * CM_PER_METER));
          const rt = model.reset.root.getTransform();
          rt.setWorldPosition(at);
          rt.setWorldRotation(rotation ?? quat.lookAt(head.sub(at).normalize(), vec3.up()));
          const label = model.reset.label;
          label.text = formatViroSpecsCopy("modelViewer.reset");
          label.size = sizeFor(view.tokens.type.labelDeg, distance);
          label.textFill.color = rgba(view.tokens.color.text);
          wrapText(label, layout.widthMeters * CM_PER_METER, layout.heightMeters * CM_PER_METER);
          if (model.reset.backing) {
            model.reset.backing.getSceneObject().getTransform().setLocalScale(new vec3(layout.widthMeters * CM_PER_METER, layout.heightMeters * CM_PER_METER, 1));
            model.reset.backing.mainPass.baseColor = rgba(view.tokens.color.surfaceRaised);
          }
        }
      }
    }
    // Models of a scene that is gone, or not committed yet: nothing shows.
    for (const [id, model] of this.models) {
      if (drawn.has(id)) continue;
      if (model.ring) model.ring.root.enabled = false;
      if (model.reset) model.reset.root.enabled = false;
    }
  }

  /**
   * Draws a PanelImage with `radius.card` corners (capped at a quarter of the
   * shorter side): a rounded-rectangle mesh
   * over the Image's own quad, sharing its material (texture and opacity),
   * with the square Image switched off. Rebuilt when the image's size or the
   * radius changes; hidden while the image has no texture (the placeholder
   * box shows instead).
   */
  private roundImage(node: ViroSpecsHostNode, tokens: ViroSpecsSpatialTokens): void {
    const object = this.host?.getNode(node.id) ?? null;
    if (!object) return;
    let surface: SceneObject | null = null;
    for (const child of object.children) if (child.name === "viro-image:" + node.id) surface = child;
    const image = surface ? (surface.getComponent("Component.Image") as Image | null) : null;
    if (!surface || !image) return;
    let rounded = this.roundedImages.get(node.id);
    if (rounded && (isNull(rounded.visual) || isNull(rounded.image) || !rounded.image.isSame(image))) {
      if (!isNull(rounded.visual)) rounded.visual.getSceneObject().destroy();
      this.roundedImages.delete(node.id);
      rounded = undefined;
    }
    const material = image.mainMaterial;
    const textured = material ? Boolean(material.mainPass.baseTex) : false;
    if (!rounded) {
      const child = global.scene.createSceneObject("viro-image-rounded:" + node.id);
      child.setParent(surface);
      child.layer = surface.layer;
      const visual = child.createComponent("Component.RenderMeshVisual") as RenderMeshVisual;
      rounded = { image, visual, key: "" };
      this.roundedImages.set(node.id, rounded);
    }
    const min = image.localAabbMin();
    const max = image.localAabbMax();
    const scale = surface.getTransform().getLocalScale();
    const widthCm = (max.x - min.x) * scale.x;
    const heightCm = (max.y - min.y) * scale.y;
    // radius.card, but never more than a quarter of the shorter side: a
    // 4 cm thumbnail keeps its square shape instead of turning into a circle.
    const radiusCm = Math.min(viroSpecsAngleToMeters(tokens.shape.radiusCardDeg, this.distanceToWearer(object)) * CM_PER_METER, Math.min(widthCm, heightCm) / 4);
    const key = widthCm.toFixed(2) + "x" + heightCm.toFixed(2) + "r" + radiusCm.toFixed(2);
    if (rounded.key !== key && widthCm > 0 && heightCm > 0) {
      // Built in world centimetres, then divided by the surface scale so the
      // corners stay round when the extents scale the surface unevenly.
      const geometry = viroSpecsRoundedRectGeometry(widthCm, heightCm, radiusCm);
      const cx = (min.x + max.x) / 2;
      const cy = (min.y + max.y) / 2;
      const vertices = geometry.vertices.slice();
      for (let i = 0; i < vertices.length; i += 8) {
        vertices[i] = vertices[i] / scale.x + cx;
        vertices[i + 1] = vertices[i + 1] / scale.y + cy;
      }
      rounded.visual.mesh = meshFrom({ vertices, indices: geometry.indices });
      rounded.key = key;
    }
    const current = rounded.visual.mainMaterial;
    if (material && (!current || !current.isSame(material))) rounded.visual.mainMaterial = material;
    rounded.visual.enabled = textured;
    image.enabled = !textured;
  }

  /** One row up (-1) or down (+1) on a committed scroll group. */
  private scrollGroup(nodeId: string, rows: number): void {
    this.host?.scrollByRows(nodeId, rows);
  }

  private createPanel(key: "loading" | "notice" | "error" | "permission"): Panel {
    const root = global.scene.createSceneObject("ViroSpecsExperience-" + key);
    if (this.overlay) root.setParent(this.overlay);
    const backing = this.makeBacking(root, OVERLAY_ORDER.backing);
    // The backing stops hand and gaze rays, so nothing behind an open panel
    // can be hovered, pinched or dwelled on through it.
    if (backing) this.blockRays(backing.getSceneObject());
    const text = (name: string): Text => {
      const object = global.scene.createSceneObject(name);
      object.setParent(root);
      return this.overlayText(object);
    };
    const title = text("title");
    const body = text("body");
    const detail = text("detail");
    let ring: Panel["ring"] = null;
    if (key === "loading" && this.panelMesh && this.panelMaterial) {
      const ringRoot = global.scene.createSceneObject("ring");
      ringRoot.setParent(root);
      const segments: RenderMeshVisual[] = [];
      for (let i = 0; i < RING_SEGMENTS; i++) {
        const visual = this.makeBacking(ringRoot, OVERLAY_ORDER.control);
        if (visual) segments.push(visual);
      }
      ring = { root: ringRoot, segments };
    }
    const action = global.scene.createSceneObject("action");
    action.setParent(root);
    const actionBacking = this.makeBacking(action, OVERLAY_ORDER.control);
    const actionLabel = global.scene.createSceneObject("label");
    actionLabel.setParent(action);
    actionLabel.getTransform().setLocalPosition(new vec3(0, 0, 0.6));
    const actionText = this.overlayText(actionLabel);
    const panel: Panel = {
      root, backing, ring, title, body, detail, action, actionText, actionBacking,
      actionHovered: false, actionPressed: false, unbind: null, shownAtMs: 0,
    };
    this.panels.set(key, panel);
    return panel;
  }

  /** Text on the overlay: drawn after its backing, never hidden by scene depth. */
  private overlayText(object: SceneObject): Text {
    const text = object.createComponent("Component.Text") as Text;
    text.depthTest = false;
    text.renderOrder = OVERLAY_ORDER.text;
    return text;
  }

  /**
   * A unit-plane visual under `parent` with a clone of the panel material.
   * With `overlayOrder`, it draws at that render order with depth test off
   * (experience overlay); without, it depth-tests with the scene (node
   * backings).
   */
  private makeBacking(parent: SceneObject, overlayOrder?: number): RenderMeshVisual | null {
    if (!this.panelMesh || !this.panelMaterial) {
      if (!this.warnedNoMesh) {
        this.warnedNoMesh = true;
        console.warn("[viro-specs-experience] warning: panelMesh or panelMaterial is not set; panels draw text only.");
      }
      return null;
    }
    const object = global.scene.createSceneObject("backing");
    object.setParent(parent);
    const visual = object.createComponent("Component.RenderMeshVisual") as RenderMeshVisual;
    visual.mesh = this.panelMesh;
    visual.clearMaterials();
    const material = this.panelMaterial.clone();
    if (overlayOrder !== undefined) {
      material.mainPass.depthTest = false;
      material.mainPass.depthWrite = false;
      visual.renderOrder = overlayOrder;
    }
    visual.addMaterial(material);
    return visual;
  }

  /** Like {@linkcode makeBacking}, on a disc of diameter 1 cm instead of the unit plane. */
  private makeDisc(parent: SceneObject, overlayOrder?: number): RenderMeshVisual | null {
    const visual = this.makeBacking(parent, overlayOrder);
    if (!visual) return null;
    if (!this.discMesh) this.discMesh = meshFrom(viroSpecsDiscGeometry());
    visual.mesh = this.discMesh;
    return visual;
  }

  /**
   * Gives `object` a collider the size of its unit-plane visual and an
   * Interactable with no listeners. Gaze stops at the collider; SIK targets
   * the nearest Interactable on the ray, so this one hides every scene
   * target behind it. Controls in front of it stay reachable.
   */
  private blockRays(object: SceneObject): void {
    const collider = object.createComponent("ColliderComponent") as ColliderComponent;
    const shape = Shape.createBoxShape();
    shape.size = new vec3(1, 1, 0.5);
    collider.shape = shape;
    collider.fitVisual = false;
    collider.intangible = false;
    object.createComponent(Interactable.getTypeName());
  }

  /** World-placed at `meters` along the head ray when it opens; not head-locked. */
  private placeInView(object: SceneObject, meters: number): void {
    const ray = this.headRay();
    if (!ray) return;
    const direction = ray.end.sub(ray.start).normalize();
    const position = ray.start.add(direction.uniformScale(meters * CM_PER_METER));
    const t = object.getTransform();
    t.setWorldPosition(position);
    t.setWorldRotation(quat.lookAt(direction.uniformScale(-1), vec3.up()));
  }

  private activatePanel(key: "loading" | "notice" | "error" | "permission"): void {
    const experience = this.experience;
    if (!experience) return;
    if (key === "notice") experience.dismissNotice();
    else if (key === "permission") experience.closePermissionPanel();
    else if (key === "error") {
      const result = experience.activateErrorAction();
      if (result && result.action === "retry") {
        for (const listener of Array.from(this.retryListeners)) listener(result.nodeIds);
      }
    }
  }

  private setContentVisible(visible: boolean): void {
    const root = this.host?.root ?? null;
    if (root && !isNull(root) && root.enabled !== visible) root.enabled = visible;
  }

  private dispose(): void {
    this.setContentVisible(true);
    this.host?.setDragConstraint(undefined);
    for (const panel of this.panels.values()) panel.unbind?.();
    this.panels.clear();
    for (const buttons of this.scrollButtons.values()) {
      buttons.up.unbind();
      buttons.down.unbind();
    }
    this.scrollButtons.clear();
    for (const id of Array.from(this.models.keys())) this.removeModel(id);
    this.roundedImages.clear();
    this.heldModels.clear();
    this.hitSession?.stop();
    this.hitSession = null;
    this.experience?.dispose();
    this.experience = null;
    this.placementListeners.clear();
    this.retryListeners.clear();
    this.decorations.clear();
  }
}
