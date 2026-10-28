import {
  Interactable,
  InteractableManipulation,
  InteractionManager,
  InteractorInputType,
  type Interactor,
  type InteractorEvent,
} from "./ViroSpecsInteractionKit";
import type {
  ViroSpecsHostInteractionSource,
  ViroSpecsInteractionPhase,
  ViroSpecsVec3,
} from "./ViroSpecsProtocol";

/** One SIK event, normalized. Positions in meters, world space. */
export type ViroSpecsSikEvent = {
  phase: ViroSpecsInteractionPhase;
  source: ViroSpecsHostInteractionSource;
  position?: ViroSpecsVec3;
  normal?: ViroSpecsVec3;
  direction?: ViroSpecsVec3;
};

/** Options for {@linkcode bindViroSpecsSik}. */
export type ViroSpecsSikBindingOptions = {
  /** Adds InteractableManipulation with translate-only drag on `root`. */
  manipulation: boolean;
  /** Object whose world position `drag` events report. */
  root: SceneObject;
};

/** What SIK reports as the interactor, mapped to the portable source. */
export function viroSpecsSourceOf(interactor: Interactor | null | undefined): ViroSpecsHostInteractionSource {
  if (!interactor) return "synthetic";
  if (interactor.inputType === InteractorInputType.LeftHand) return "hand-left";
  if (interactor.inputType === InteractorInputType.RightHand) return "hand-right";
  // Mouse (Lens Studio preview), mobile controller and custom interactors
  // are not hands. Spectacles has no SIK gaze interactor; gaze arrives
  // through ViroSpecsSceneController.dispatchInteraction.
  return "synthetic";
}

function toVec3(v: vec3, scale: number): ViroSpecsVec3 {
  return [v.x * scale, v.y * scale, v.z * scale];
}

function fromEvent(phase: ViroSpecsInteractionPhase, event: InteractorEvent | undefined): ViroSpecsSikEvent {
  const interactor = event?.interactor ?? null;
  const out: ViroSpecsSikEvent = { phase, source: viroSpecsSourceOf(interactor) };
  if (interactor) {
    const hit = interactor.targetHitInfo?.hit ?? null;
    // Lens world units are centimeters; portable events are meters.
    if (interactor.targetHitPosition) out.position = toVec3(interactor.targetHitPosition, 0.01);
    if (hit) out.normal = toVec3(hit.normal, 1);
    if (interactor.direction) out.direction = toVec3(interactor.direction, 1);
  }
  return out;
}

function ensureCollider(object: SceneObject): void {
  if (object.getComponent("ColliderComponent")) return;
  const collider = object.createComponent("ColliderComponent") as ColliderComponent;
  if (hasVisual(object)) {
    collider.fitVisual = true;
  } else {
    const shape = Shape.createBoxShape();
    shape.size = new vec3(10, 10, 10);
    collider.shape = shape;
    collider.fitVisual = false;
  }
  collider.intangible = false;
}

function hasVisual(object: SceneObject): boolean {
  return Boolean(
    object.getComponent("Component.RenderMeshVisual") ||
      object.getComponent("Component.Image") ||
      object.getComponent("Component.Text")
  );
}

/** The object SIK should target: the node itself if it draws, else its first drawing descendant. */
export function findViroSpecsInteractionTarget(root: SceneObject): SceneObject {
  if (root.getComponent(Interactable.getTypeName()) || hasVisual(root)) return root;
  for (const child of root.children) {
    const target = findViroSpecsInteractionTarget(child);
    if (target !== child || hasVisual(child) || child.getComponent(Interactable.getTypeName())) return target;
  }
  return root;
}

/**
 * Binds every SIK phase on `target`: hover-enter, hover-move (onHoverUpdate),
 * hover-exit, select-start, select-end, drag (onDragStart/Update/End or
 * manipulation updates) and cancel (onTriggerCanceled, onTriggerEndOutside).
 * Returns an unbind that removes every listener, disables the components,
 * and releases interactors still pointing at the Interactable, so SIK never
 * reads a destroyed object. Unbinding twice is harmless.
 */
export function bindViroSpecsSik(
  target: SceneObject,
  options: ViroSpecsSikBindingOptions,
  emit: (event: ViroSpecsSikEvent) => void
): () => void {
  ensureCollider(target);
  let interactable = target.getComponent(Interactable.getTypeName()) as Interactable | null;
  if (!interactable) interactable = target.createComponent(Interactable.getTypeName()) as Interactable;
  const bound = interactable;
  bound.enabled = true;
  const removers: (() => void)[] = [];
  const track = (maybe: unknown): void => {
    if (typeof maybe === "function") removers.push(maybe as () => void);
  };
  const on = (phase: ViroSpecsInteractionPhase) => (event: InteractorEvent) => emit(fromEvent(phase, event));

  track(bound.onHoverEnter.add(on("hover-enter")));
  track(bound.onHoverUpdate.add(on("hover-move")));
  track(bound.onHoverExit.add(on("hover-exit")));
  track(bound.onTriggerStart.add(on("select-start")));
  track(bound.onTriggerEnd.add(on("select-end")));
  track(bound.onTriggerCanceled.add(on("cancel")));
  track(bound.onTriggerEndOutside.add(on("cancel")));

  const dragFrom = (event: InteractorEvent | undefined): void => {
    const sample = fromEvent("drag", event);
    // A drag reports where the node is, like Viro's onDrag(dragToPos).
    sample.position = toVec3(options.root.getTransform().getWorldPosition(), 0.01);
    emit(sample);
  };

  let manipulation: InteractableManipulation | null = null;
  if (options.manipulation) {
    manipulation = target.getComponent(InteractableManipulation.getTypeName()) as InteractableManipulation | null;
    if (!manipulation) {
      manipulation = target.createComponent(InteractableManipulation.getTypeName()) as InteractableManipulation;
      manipulation.setManipulateRoot(options.root.getTransform());
      manipulation.setCanRotate(false);
      manipulation.setCanScale(false);
      // Portable drag positions are linear world translations; SIK's depth
      // amplification would change Z on lateral motion.
      manipulation.enableStretchZ = false;
    }
    manipulation.enabled = true;
    track(manipulation.onManipulationStart.add(() => dragFrom(undefined)));
    track(manipulation.onManipulationUpdate.add(() => dragFrom(undefined)));
    track(manipulation.onManipulationEnd.add(() => dragFrom(undefined)));
  } else {
    track(bound.onDragStart.add((e: InteractorEvent) => dragFrom(e)));
    track(bound.onDragUpdate.add((e: InteractorEvent) => dragFrom(e)));
    track(bound.onDragEnd.add((e: InteractorEvent) => dragFrom(e)));
  }

  let active = true;
  return () => {
    if (!active) return;
    active = false;
    for (const interactor of InteractionManager.getInstance().getInteractorsByType(InteractorInputType.All)) {
      if (interactor.currentInteractable === bound) interactor.clearCurrentInteractable();
    }
    for (const remove of removers) remove();
    removers.length = 0;
    if (!isNull(target)) {
      bound.enabled = false;
      if (manipulation) manipulation.enabled = false;
    }
  };
}
