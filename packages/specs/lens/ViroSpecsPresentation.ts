/**
 * ViroSpecsPresentation: protocol 1 pages with string actions, presented
 * through a {@linkcode ViroSpecsSceneController}.
 *
 * A page is a protocol 1 scene plus `targets` that map node IDs to action
 * strings. Each page becomes a protocol 2 document whose targets are
 * `select` interactions, and the controller presents it transactionally: the
 * page is staged under a disabled root and the previous page is retired only
 * after the new one is enabled. A rejected or failed page leaves the previous
 * page on screen with its targets live.
 *
 * Dependency-free and free of Lens globals. The Lens component is
 * ViroSpecsPresentationHost, which runs this on a
 * ViroSpecsSceneControllerHost.
 */
import type {
  ViroSpecsDocumentInteraction,
  ViroSpecsDocumentNode,
  ViroSpecsDocumentTextStyle,
  ViroSpecsHostInteraction,
  ViroSpecsSceneDocumentV2,
  ViroSpecsSceneSnapshot,
} from "./ViroSpecsProtocol";
import { formatViroSpecsHostDiagnostic, type ViroSpecsSubscription } from "./ViroSpecsHostDiagnostics";
import { readViroSpecsSceneInput, type ViroSpecsHostNode } from "./ViroSpecsSceneDocument";
import type { ViroSpecsCancel } from "./ViroSpecsSceneBackend";
import type { ViroSpecsApplyResult } from "./ViroSpecsSceneController";

/** A plain JSON page prepared by the phone/app host, not Lens React. */
export type ViroSpecsPresentationSnapshot = {
  scene: ViroSpecsSceneSnapshot;
  /** Nodes that fire `action` on a completed pinch. Each node at most once. */
  targets: { targetId: string; action: string }[];
};

/**
 * The scene owner a {@linkcode ViroSpecsPresentation} draws into. Both
 * {@linkcode ViroSpecsSceneController} and ViroSpecsSceneControllerHost
 * satisfy it.
 */
export interface ViroSpecsPresentationScene {
  present(input: unknown): ViroSpecsApplyResult;
  clear(): void;
  queueAction(action: () => void): ViroSpecsCancel;
  addOnInteractionListener(listener: (event: ViroSpecsHostInteraction) => void): ViroSpecsSubscription;
}

/**
 * Converts a presentation page to the protocol 2 document
 * {@linkcode ViroSpecsPresentation.present} hands to the controller.
 *
 * Protocol 1 `textStyle.size` becomes `style.fontSize` (the Lens backend
 * draws one Lens text size per point) and `textStyle.color` becomes an
 * `#RRGGBBAA` string. Every target becomes a `select` interaction without
 * manipulation.
 *
 * @throws Error naming every problem when the page is not a valid, non-empty
 * protocol 1 scene or a target is unknown, duplicated or has no action.
 */
export function toViroSpecsPresentationDocument(snapshot: ViroSpecsPresentationSnapshot): ViroSpecsSceneDocumentV2 {
  const scene = snapshot?.scene;
  if (!scene || scene.version !== 1 || !Array.isArray(scene.nodes) || scene.nodes.length === 0) {
    throw new Error("Specs presentation requires a non-empty version 1 scene.");
  }
  const read = readViroSpecsSceneInput(scene, 0);
  if (read.ok === false) {
    throw new Error("Invalid Specs scene: " + read.diagnostics.map(formatViroSpecsHostDiagnostic).join("; "));
  }
  const ids = new Set(read.scene.nodes.map((node) => node.id));
  const targets = Array.isArray(snapshot.targets) ? snapshot.targets : [];
  const seen = new Set<string>();
  const interactions: ViroSpecsDocumentInteraction[] = [];
  for (const target of targets) {
    const id = target?.targetId;
    if (typeof id !== "string" || !ids.has(id) || typeof target.action !== "string" ||
        target.action.trim() === "" || seen.has(id)) {
      throw new Error("Invalid or duplicate Specs action target: " + String(id));
    }
    seen.add(id);
    interactions.push({ nodeId: id, interactable: true, manipulation: false, events: ["select"] });
  }
  return {
    version: 2,
    nodes: read.scene.nodes.map(toDocumentNode),
    ...(interactions.length > 0 ? { interactions } : {}),
  };
}

function toDocumentNode(node: ViroSpecsHostNode): ViroSpecsDocumentNode {
  if (node.kind !== "text" || node.legacyTextStyle === undefined) return node;
  const { legacyTextStyle, ...rest } = node;
  const style: ViroSpecsDocumentTextStyle = {};
  if (legacyTextStyle.size !== undefined) style.fontSize = legacyTextStyle.size;
  if (legacyTextStyle.color !== undefined) style.color = toHexColor(legacyTextStyle.color);
  return Object.keys(style).length > 0 ? { ...rest, style } : rest;
}

function toHexColor(rgba: readonly number[]): string {
  let out = "#";
  for (const channel of rgba) {
    const byte = Math.round(Math.min(1, Math.max(0, channel)) * 255);
    out += (byte < 16 ? "0" : "") + byte.toString(16);
  }
  return out;
}

/**
 * Presents protocol 1 pages on a scene controller and delivers their string
 * actions.
 *
 * @example
 * const presentation = new ViroSpecsPresentation(sceneHost);
 * const stop = presentation.subscribeAction((action) => app.onAction(action));
 * presentation.present({ scene, targets: [{ targetId: "go", action: "open:apollo" }] });
 * stop();
 * presentation.dispose();
 */
export class ViroSpecsPresentation {
  private readonly listeners = new Set<(action: string) => void>();
  private targets = new Map<string, string>();
  /** Revision of the page this presentation committed, 0 when none. */
  private revision = 0;
  private subscription: ViroSpecsSubscription | null = null;
  private disposed = false;

  constructor(private readonly scene: ViroSpecsPresentationScene) {}

  /**
   * Adds an action listener. Actions arrive one frame after the pinch, and
   * only while the page that showed the target is still presented.
   *
   * @returns Removes the listener. Idempotent.
   */
  subscribeAction(listener: (action: string) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Replaces the presented page transactionally. Until the new page is
   * enabled, the previous page and its targets stay live.
   *
   * @throws Error when the page is invalid or the controller rejects it. The
   * previous page is untouched in both cases.
   */
  present(snapshot: ViroSpecsPresentationSnapshot): void {
    if (this.disposed) throw new Error("ViroSpecsPresentation is disposed.");
    const document = toViroSpecsPresentationDocument(snapshot);
    // Subscribe on first use, not in the constructor: a Lens host may not
    // have built its controller yet when this object is created.
    if (this.subscription === null) {
      this.subscription = this.scene.addOnInteractionListener((event) => this.onInteraction(event));
    }
    const result = this.scene.present(document);
    if (result.status === "rejected") {
      const reasons = result.diagnostics.map(formatViroSpecsHostDiagnostic);
      throw new Error("Specs presentation rejected: " + (reasons.length > 0 ? reasons.join("; ") : "no diagnostics"));
    }
    const targets = new Map<string, string>();
    for (const target of snapshot.targets) targets.set(target.targetId, target.action);
    this.targets = targets;
    this.revision = result.revision;
  }

  /** Removes the presented page. Queued actions of the page are dropped. */
  clear(): void {
    if (this.revision === 0) return;
    this.revision = 0;
    this.targets = new Map();
    this.scene.clear();
  }

  /** Clears the page and drops every listener. Idempotent. */
  dispose(): void {
    if (this.disposed) return;
    this.clear();
    this.disposed = true;
    this.subscription?.remove();
    this.subscription = null;
    this.listeners.clear();
  }

  private onInteraction(event: ViroSpecsHostInteraction): void {
    if (event.phase !== "select-end" || this.revision === 0 || event.sceneRevision !== this.revision) return;
    const action = this.targets.get(event.nodeId);
    if (action === undefined) return;
    const revision = this.revision;
    // Listeners usually present the next page, which destroys the selected
    // Interactable. Doing that inside SIK's trigger dispatch leaves SIK
    // walking dead objects, so the action runs next frame. The controller
    // owns the queued work by page: replacing or clearing the page first
    // drops it. Every listener hears the action even when an earlier one
    // presents the next page; failures are rethrown together afterwards and
    // the controller reports them as VS5009.
    this.scene.queueAction(() => {
      if (revision !== this.revision) return;
      const failures: string[] = [];
      for (const listener of Array.from(this.listeners)) {
        try {
          listener(action);
        } catch (error) {
          failures.push(error instanceof Error ? error.message : String(error));
        }
      }
      if (failures.length > 0) throw new Error("action listener threw: " + failures.join("; "));
    });
  }
}
