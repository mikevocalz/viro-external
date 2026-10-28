import { findSceneObjectByName, sleep } from "Leaf.lspkg/Utils/common/Utils";
import { expect } from "Leaf.lspkg/Utils/common/Expect";
import { findInteractableByName } from "Leaf.lspkg/Interactors/InteractableUtils";
import type { Interactable } from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable";
import { ViroSpecsSceneControllerHost } from "../../ViroSpecs/lens/ViroSpecsSceneControllerHost";
import { ViroSpecsExperienceHost } from "../../ViroSpecs/lens/ViroSpecsExperienceLensView";
import { ViroSpecsActionRegistry, ViroSpecsActionRuntime } from "../../ViroSpecs/lens/ViroSpecsActionRuntime";
import type { ViroSpecsActionDeclaration, ViroSpecsSceneDocumentV2 } from "../../ViroSpecs/lens/ViroSpecsProtocol";
import type { ViroSpecsHostDiagnostic } from "../../ViroSpecs/lens/ViroSpecsHostDiagnostics";
import { viroRefAppScene, type ViroRefAppName } from "./ViroRefAppScenes";
import {
  VIRO_REF_DASHBOARD_HANDLERS,
  VIRO_REF_DASHBOARD_INITIAL,
  VIRO_REF_MODEL_HANDLERS,
  VIRO_REF_MODEL_INITIAL,
  VIRO_REF_PLACEMENT_HANDLERS,
  VIRO_REF_PLACEMENT_INITIAL,
  viewViroRefDashboard,
  viewViroRefModel,
  viewViroRefPlacement,
  type ViroRefHandler,
  type ViroRefPlacementState,
  type ViroRefSceneDocument,
} from "./ViroRefAppsLogic";

/**
 * Shared steps for the reference-app scenarios (viro_ref_*), written for the
 * Platform Lab Lens project (viro `examples/specs-platform-lab/lens`), which
 * already has the hosts these need:
 *
 * - "SceneHost": ViroSpecsSceneControllerHost, with shiba.glb registered as
 *   "examples/visionos-sweep/assets/shiba.glb" in "AssetRegistry".
 * - "ExperienceHost": ViroSpecsExperienceHost, disabled until a scenario
 *   enables it (placement and the error panel).
 * - "GeneratedHost": optional. When present, `stopRefApp` asks it to present
 *   the compiled Platform Lab scene again so the lab's own scenarios find it.
 *
 * Objects the scene controller creates per node: "viro:<id>" (renamed
 * "viro-interactable:<id>" when the node itself is the SIK target, as a
 * ViroText control is), "viro-interactable:<id>" on the part SIK binds,
 * "viro-model:<id>" for a loaded model and "viro-placeholder:<id>" for a
 * missing one. Node lookups go through `controllerHost().getNode(id)`, which
 * finds the node whatever it was renamed to.
 */
export const REF_HOSTS = { scene: "SceneHost", experience: "ExperienceHost", generated: "GeneratedHost" } as const;

/** Default parameters every reference-app scenario declares in the index. */
export const REF_PARAMETERS: Record<string, string> = { hold_ms: "0" };

export function controllerHost(): ViroSpecsSceneControllerHost {
  const object = findSceneObjectByName(REF_HOSTS.scene);
  expect(object).toBeTruthy();
  const host = (object as SceneObject).getComponent(ViroSpecsSceneControllerHost.getTypeName()) as ViroSpecsSceneControllerHost | null;
  expect(host).toBeTruthy();
  return host as ViroSpecsSceneControllerHost;
}

/** Polls `ready` every 50 ms until it holds or `timeoutMs` passes; returns the last answer. */
export async function waitFor(ready: () => boolean, timeoutMs: number = 3000): Promise<boolean> {
  for (let waited = 0; waited < timeoutMs; waited += 50) {
    if (ready()) return true;
    await sleep(50);
  }
  return ready();
}

/** One frame plus a margin, so commit and SIK binding settle. */
export async function settle(ms: number = 200): Promise<void> {
  await sleep(ms);
}

/** The SceneObject of a committed node, or null. */
export function nodeObject(id: string): SceneObject | null {
  return controllerHost().getNode(id);
}

/** Text of a committed text node. */
export function textOf(id: string): string | undefined {
  const object = nodeObject(id);
  const text = object ? (object.getComponent("Component.Text") as Text | null) : null;
  return text ? text.text : undefined;
}

/** The enabled Interactable SIK binds for a node's interaction. */
export function interactableOf(id: string): Interactable {
  const found = findInteractableByName("viro-interactable:" + id, undefined, true);
  expect(found).toBeTruthy();
  return found as Interactable;
}

/**
 * Hover then trigger, as a pinch. A pinch that replaces the scene can destroy
 * the target while LEAF's trigger is still finishing; that is swallowed only
 * when the target is already destroyed.
 */
export async function pinch(
  interactor: { hover(target: Interactable, ms: number): Promise<void>; trigger(target: Interactable): Promise<void> },
  target: Interactable
): Promise<void> {
  await interactor.hover(target, 100);
  try {
    await interactor.trigger(target);
  } catch (error) {
    if (!isNull(target)) throw error;
  }
}

/** Collects host diagnostics while `body` runs. */
export async function diagnosticsDuring(body: () => Promise<void>): Promise<ViroSpecsHostDiagnostic[]> {
  const seen: ViroSpecsHostDiagnostic[] = [];
  const subscription = controllerHost().addOnDiagnosticListener((d) => seen.push(d));
  try {
    await body();
  } finally {
    subscription.remove();
  }
  return seen;
}

/**
 * Host diagnostics as "CODE@node", leaving out VS5008 (maxLines approximated,
 * raised once per PanelText) and VS5025 (premium feature not drawn yet,
 * raised for every ModelViewer's load ring). Both are notices about this
 * host, not about the app.
 */
export function findings(diagnostics: readonly ViroSpecsHostDiagnostic[]): string[] {
  return diagnostics
    .filter((d) => d.code !== "VS5008" && d.code !== "VS5025")
    .map((d) => d.code + (d.nodeId !== undefined ? "@" + d.nodeId : ""));
}

/**
 * Prints a marker and, when the run sets `hold_ms`, keeps the state on screen
 * that long so a capture can be taken from outside the Lens.
 */
export async function hold(config: { get(key: string): string | undefined } | undefined, label: string): Promise<void> {
  const ms = Number(config?.get("hold_ms") ?? "0");
  print("VIRO_REF_HOLD " + label + " " + ms);
  if (ms > 0) await sleep(ms);
}

// --- Running an app standalone ------------------------------------------------------

/** A reference app running on the scene controller with no phone. */
export type RefApp<S> = {
  readonly runtime: ViroSpecsActionRuntime<S>;
  /** Every action the controller delivered, as "actionId nodeId". */
  readonly actions: string[];
  stop(): Promise<void>;
};

type AppSpec<S> = {
  readonly initial: S;
  readonly handlers: Readonly<Record<string, ViroRefHandler<S>>>;
  readonly view: (base: ViroRefSceneDocument, state: S) => ViroRefSceneDocument;
};

function specFor(name: ViroRefAppName): AppSpec<unknown> {
  switch (name) {
    case "dashboard":
      return { initial: VIRO_REF_DASHBOARD_INITIAL, handlers: VIRO_REF_DASHBOARD_HANDLERS, view: viewViroRefDashboard } as unknown as AppSpec<unknown>;
    case "model-viewer":
      return { initial: VIRO_REF_MODEL_INITIAL, handlers: VIRO_REF_MODEL_HANDLERS, view: viewViroRefModel } as unknown as AppSpec<unknown>;
    case "world-placed-info":
      return { initial: VIRO_REF_PLACEMENT_INITIAL, handlers: VIRO_REF_PLACEMENT_HANDLERS, view: viewViroRefPlacement } as unknown as AppSpec<unknown>;
  }
}

/**
 * Starts one app: the compiled document through the action registry and
 * runtime, as a standalone Lens would. `edit` changes the base document first
 * (a missing asset, for example). Waits until the scene is committed and SIK
 * is bound; does not wait for assets.
 */
export async function startRefApp<S>(name: ViroRefAppName, edit?: (doc: ViroRefSceneDocument) => void): Promise<RefApp<S>> {
  const host = controllerHost();
  // A project with "GeneratedHost" presents its own scene shortly after each
  // Lens reset; wait for that first, or it replaces the app mid-scenario.
  if (findSceneObjectByName(REF_HOSTS.generated)) {
    await waitFor(() => host.committedScene !== null && host.lifecycle === "ready", 3000);
    await settle();
  }
  const base = viroRefAppScene(name) as ViroRefSceneDocument;
  if (edit) edit(base);
  const spec = specFor(name) as unknown as AppSpec<S>;
  const registry = new ViroSpecsActionRegistry<S>((base.actions ?? []) as ViroSpecsActionDeclaration[], host.diagnosticsChannel);
  for (const id of Object.keys(spec.handlers)) {
    const handler = spec.handlers[id];
    if (handler) registry.on(id, (state, payload) => handler(state, payload));
  }
  const runtime = new ViroSpecsActionRuntime<S>(host, {
    initialState: spec.initial,
    view: (state) => spec.view(base, state) as unknown as ViroSpecsSceneDocumentV2,
    registry,
    diagnostics: host.diagnosticsChannel,
    nowMs: () => getTime() * 1000,
  });
  const actions: string[] = [];
  const listening = host.addOnActionListener((event) => actions.push(event.actionId + " " + (event.nodeId ?? "")));
  const started = runtime.start();
  expect(started === null ? "null" : started.status === "rejected" ? "rejected" : "applied").toBe("applied");
  expect(await waitFor(() => host.committedScene?.route === base.route)).toBe(true);
  // SIK binds one frame after commit.
  await settle();
  return {
    runtime,
    actions,
    stop: async () => {
      listening.remove();
      runtime.dispose();
      await restoreLabScene();
    },
  };
}

/**
 * Presents the Platform Lab's compiled scene again through "GeneratedHost"
 * when the project has one, so scenarios that expect it still find it;
 * otherwise clears the controller.
 */
export async function restoreLabScene(): Promise<void> {
  const generated = findSceneObjectByName(REF_HOSTS.generated);
  if (generated) {
    for (const script of generated.getComponents("Component.ScriptComponent")) {
      const candidate = script as unknown as { restartGeneratedScene?: () => void };
      if (typeof candidate.restartGeneratedScene === "function") {
        candidate.restartGeneratedScene();
        await settle(300);
        return;
      }
    }
  }
  controllerHost().clear();
  await settle();
}

// --- Experience layer ----------------------------------------------------------------

/** Enables ExperienceHost and waits until its controller is attached. */
export async function startExperience(): Promise<ViroSpecsExperienceHost> {
  const object = findSceneObjectByName(REF_HOSTS.experience) as SceneObject;
  expect(object).toBeTruthy();
  object.enabled = true;
  const lookup = (): ViroSpecsExperienceHost | null =>
    object.getComponent(ViroSpecsExperienceHost.getTypeName()) as ViroSpecsExperienceHost | null;
  expect(await waitFor(() => lookup()?.controller !== null && lookup()?.controller !== undefined)).toBe(true);
  return lookup() as ViroSpecsExperienceHost;
}

export function stopExperience(): void {
  const object = findSceneObjectByName(REF_HOSTS.experience);
  if (object) object.enabled = false;
}

/** One of the experience layer's panels, or null before it first opened. */
export function experiencePanel(key: "loading" | "notice" | "error" | "permission"): SceneObject | null {
  return findSceneObjectByName("ViroSpecsExperience-" + key) ?? null;
}

/** Text of a panel row ("title", "body", "detail", or the action "label"). */
export function panelText(key: "loading" | "notice" | "error" | "permission", row: "title" | "body" | "detail" | "label"): string {
  const root = experiencePanel(key);
  expect(root).toBeTruthy();
  const find = (object: SceneObject): Text | null => {
    for (let i = 0; i < object.getChildrenCount(); i++) {
      const child = object.getChild(i);
      if (child.name === row) return child.getComponent("Component.Text") as Text | null;
      const nested = find(child);
      if (nested) return nested;
    }
    return null;
  };
  const text = find(root as SceneObject);
  return text ? text.text : "";
}

type HitCallback = (result: WorldQueryHitTestResult | null) => void;

/**
 * Replaces the experience host's WorldQuery session with one that reports
 * `hit` (world centimeters) on every test, or nothing when `hit` is null.
 * Preview has no SPECS depth, so placement scenarios inject the hit. Call it
 * after `startPlacement`, which creates the real session.
 */
export function injectWorldQuery(host: ViroSpecsExperienceHost, hit: { position: vec3; normal: vec3 } | null): void {
  const stub = {
    hitTest: (_start: vec3, _end: vec3, callback: HitCallback): void => {
      callback(hit ? ({ position: hit.position, normal: hit.normal } as unknown as WorldQueryHitTestResult) : null);
    },
    start: (): void => undefined,
    stop: (): void => undefined,
  };
  (host as unknown as { hitSession: unknown }).hitSession = stub;
}

/** The scene camera's world position, centimeters. */
export function cameraPosition(): vec3 {
  const camera = findSceneObjectByName("Camera Object");
  expect(camera).toBeTruthy();
  return (camera as SceneObject).getTransform().getWorldPosition();
}

/**
 * The app glue for World-placed info: entering "placing" starts a placement
 * on the experience host, and a confirmed placement comes back as the typed
 * action placement.confirm with the pose in meters.
 */
export function wirePlacement(host: ViroSpecsExperienceHost, app: RefApp<ViroRefPlacementState>): { remove(): void } {
  const state = app.runtime.addOnStateListener((next) => {
    if (next.phase === "placing") host.startPlacement();
  });
  const placement = host.addOnPlacementListener((pose) => {
    app.runtime.dispatch("placement.confirm", { x: pose.position[0], y: pose.position[1], z: pose.position[2] });
  });
  return {
    remove: () => {
      state.remove();
      placement.remove();
    },
  };
}
