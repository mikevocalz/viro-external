/**
 * Lens side of the experience layer: draws the view from
 * {@linkcode ViroSpecsExperienceController}, feeds it the head ray for gaze
 * dwell, WorldQuery hits for placement and SIK pinches for confirm.
 *
 * Evidence: implemented. This file has not been compiled in Lens Studio or
 * run in Preview; the portable logic it calls is tested in
 * `scripts/experience.test.mjs`. Doc: `doc/Experience.md`.
 *
 * Rules this file keeps (Lens Studio compiler traps): result unions are
 * narrowed with `=== false`, and every package component (Interactable,
 * collider) is created under this component's own enabled overlay root, never
 * under the scene controller's disabled staging root.
 */
import {
  unrenderedViroSpecsComponentFeatures,
  resolveViroSpecsButtonVisual,
  stepViroSpecsMove,
  ViroSpecsButtonTracker,
  ViroSpecsExperienceController,
  ViroSpecsGazeDwell,
  type ViroSpecsExperienceView,
} from "./ViroSpecsExperience";
import {
  viroSpecsAngleToMeters,
  VIRO_SPECS_LENS_TEXT_EM_METERS_PER_SIZE,
  type ViroSpecsButtonAuthoredState,
  type ViroSpecsSpatialTokens,
} from "./ViroSpecsExperienceTokens";
import { InteractionManager, InteractorInputType, InteractorTriggerType } from "./ViroSpecsInteractionKit";
import { ViroSpecsPlacementSession, type ViroSpecsPlacementHit, type ViroSpecsReticleView } from "./ViroSpecsPlacement";
import { createViroSpecsHostDiagnostic } from "./ViroSpecsHostDiagnostics";
import type { ViroSpecsCapabilityState } from "./ViroSpecsProtocol";
import type { ViroSpecsHostScene } from "./ViroSpecsSceneDocument";
import { ViroSpecsSceneControllerHost } from "./ViroSpecsSceneControllerHost";
import { parseViroSpecsColor } from "./ViroSpecsSceneDocument";
import { bindViroSpecsSik } from "./ViroSpecsSikBinding";

const WorldQueryModule = require("LensStudio:WorldQueryModule") as WorldQueryModule;

const CM_PER_METER = 100;
/** Head-ray length for gaze targeting and WorldQuery, centimeters (the far edge of the comfort band). */
const RAY_CM = 300;

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

function rgba(hex: string, alpha = 1): vec4 {
  const [r, g, b] = parseViroSpecsColor(hex);
  return new vec4(r, g, b, alpha);
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
 * material for panel backings and the reticle. Without them panels are text
 * only and a warning is logged once.
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
  @hint("Unit plane (1 x 1 cm) for panel backings and the reticle disc")
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
    host.addOnInteractionListener((event) => this.tracker?.handle(event));
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
        extra = addText("errorMessage", -extentsH);
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
    this.tracker?.retain(new Set(host.nodeIds));
  }

  /** Applies token colors, button states and the text minimum to decorated nodes. Runs every frame. */
  private styleDecorations(tokens: ViroSpecsSpatialTokens): void {
    const host = this.host;
    const scene = host?.committedScene;
    const tracker = this.tracker;
    if (!host || !scene || !tracker) return;
    for (const node of scene.nodes) {
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
        }
        if (decoration.label) {
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
    const view = experience.view();
    // A replacement in the same lifecycle state fires no lifecycle event.
    if ((this.host?.committedScene ?? null) !== this.decoratedScene) this.decorate();
    this.styleDecorations(view.tokens);
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
      this.dwellDisc = this.makeBacking(object);
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
      const disc = this.makeBacking(root);
      const labelObject = global.scene.createSceneObject("ViroSpecsReticleLabel");
      labelObject.setParent(root);
      const label = labelObject.createComponent("Component.Text") as Text;
      label.depthTest = true;
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
      body: loading.line + (loading.progress !== undefined ? "  " + Math.round(loading.progress * 100) + "%" : ""),
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
    const line = (text: Text, value: string, deg: number, color: string, y: number) => {
      text.text = value;
      text.size = sizeFor(deg, d);
      text.textFill.color = rgba(color);
      text.getSceneObject().enabled = value !== "";
      text.getSceneObject().getTransform().setLocalPosition(new vec3(0, y, 0.6));
    };
    const step = viroSpecsAngleToMeters(tokens.type.bodyDeg * tokens.type.lineHeight, d) * CM_PER_METER;
    line(panel.title, content.title, tokens.type.bodyDeg, content.accent, step * 1.5);
    line(panel.body, content.body, tokens.type.bodyDeg, tokens.color.text, 0);
    line(panel.detail, content.detail, tokens.type.labelDeg, tokens.color.textMuted, -step * 1.5);
    if (panel.backing) {
      // 20 degrees wide (the handoff panel width) and tall enough for title,
      // body, detail and action rows.
      const bt = panel.backing.getSceneObject().getTransform();
      bt.setLocalScale(new vec3(viroSpecsAngleToMeters(20, d) * CM_PER_METER, step * 8, 1));
      bt.setLocalPosition(new vec3(0, -step * 0.5, 0));
      panel.backing.mainPass.baseColor = rgba(content.surface, tokens.opacity.surface);
    }
    panel.action.enabled = content.action !== null;
    if (content.action !== null) {
      // The action is a PanelButton: same seven-state visual, hover ring and
      // press-commits-on-release rule as scene buttons.
      const visual = resolveViroSpecsButtonVisual(content.action, "idle", { hovered: panel.actionHovered, pressed: panel.actionPressed }, tokens);
      panel.actionText.text = visual.labelText;
      panel.actionText.size = sizeFor(tokens.type.labelDeg, d);
      panel.actionText.textFill.color = rgba(visual.labelColor);
      panel.action.getTransform().setLocalPosition(new vec3(0, -step * 3, 0.6));
      if (panel.actionBacking) {
        const labelM = viroSpecsAngleToMeters(tokens.type.labelDeg, d);
        const h = labelM * tokens.type.lineHeight + 2 * viroSpecsAngleToMeters(tokens.space.smDeg, d);
        const w = Math.max(h * 2.5, content.action.length * 0.55 * labelM + 2 * viroSpecsAngleToMeters(tokens.space.mdDeg, d));
        const bt = panel.actionBacking.getSceneObject().getTransform();
        bt.setLocalScale(new vec3(w * CM_PER_METER * visual.scale, h * CM_PER_METER * visual.scale, 1));
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

  private createPanel(key: "loading" | "notice" | "error" | "permission"): Panel {
    const root = global.scene.createSceneObject("ViroSpecsExperience-" + key);
    if (this.overlay) root.setParent(this.overlay);
    const backing = this.makeBacking(root);
    const text = (name: string): Text => {
      const object = global.scene.createSceneObject(name);
      object.setParent(root);
      const t = object.createComponent("Component.Text") as Text;
      t.depthTest = true;
      return t;
    };
    const title = text("title");
    const body = text("body");
    const detail = text("detail");
    const action = global.scene.createSceneObject("action");
    action.setParent(root);
    const actionBacking = this.makeBacking(action);
    const actionLabel = global.scene.createSceneObject("label");
    actionLabel.setParent(action);
    actionLabel.getTransform().setLocalPosition(new vec3(0, 0, 0.6));
    const actionText = actionLabel.createComponent("Component.Text") as Text;
    actionText.depthTest = true;
    const panel: Panel = {
      root, backing, title, body, detail, action, actionText, actionBacking,
      actionHovered: false, actionPressed: false, unbind: null, shownAtMs: 0,
    };
    this.panels.set(key, panel);
    return panel;
  }

  private makeBacking(parent: SceneObject): RenderMeshVisual | null {
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
    visual.addMaterial(this.panelMaterial.clone());
    return visual;
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
    for (const panel of this.panels.values()) panel.unbind?.();
    this.panels.clear();
    this.hitSession?.stop();
    this.hitSession = null;
    this.experience?.dispose();
    this.experience = null;
    this.placementListeners.clear();
    this.retryListeners.clear();
    this.decorations.clear();
  }
}
