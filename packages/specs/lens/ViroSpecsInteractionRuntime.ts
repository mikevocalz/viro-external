import { bindViroSpecsSik, findViroSpecsInteractionTarget } from "./ViroSpecsSikBinding";
import type { ViroSpecsPortableInteraction } from "./ViroSpecsProtocol";
import { ViroSpecsRuntimeHost } from "./ViroSpecsRuntimeHost";

type InteractionRecord = {
  target: SceneObject;
  root: SceneObject;
  manipulation: boolean;
  /** Unbinds every SIK listener and releases interactors pointing here. */
  unbind: () => void;
};

/**
 * Legacy per-node SIK runtime used by ViroSpecsInteractionHost and the
 * presentation host. Forwards all seven phases through bindViroSpecsSik.
 * `source` keeps its protocol 1 values (`hand` for hover and drag, `pinch`
 * for select, cancel); `inputSource` says which hand, gaze or synthetic
 * input it was.
 */
export class ViroSpecsInteractionRuntime {
  private readonly records = new Map<string, InteractionRecord>();
  private readonly listeners = new Set<
    (event: ViroSpecsPortableInteraction) => void
  >();

  constructor(private readonly host: ViroSpecsRuntimeHost) {}

  subscribe(
    listener: (event: ViroSpecsPortableInteraction) => void
  ): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  setInteractable(nodeId: string, enabled: boolean): void {
    if (!enabled) {
      this.remove(nodeId);
      return;
    }
    this.ensureRecord(nodeId, this.records.get(nodeId)?.manipulation ?? false);
  }

  setManipulationEnabled(nodeId: string, enabled: boolean): void {
    const existing = this.records.get(nodeId);
    if (existing && existing.manipulation === enabled) return;
    this.remove(nodeId);
    this.ensureRecord(nodeId, enabled);
  }

  /** Unbinds one node. Unknown IDs are ignored. */
  remove(nodeId: string): void {
    const record = this.records.get(nodeId);
    if (!record) return;
    this.records.delete(nodeId);
    record.unbind();
  }

  /** Kept for ViroSpecsInteractionHost's UpdateEvent; drags stream from SIK now. */
  update(): void {}

  /** Keep subscribers, but dispose SIK bindings before replacing the scene. */
  resetTargets(): void {
    for (const nodeId of Array.from(this.records.keys())) this.remove(nodeId);
  }

  dispose(): void {
    this.resetTargets();
    this.listeners.clear();
  }

  private ensureRecord(nodeId: string, manipulation: boolean): InteractionRecord {
    const existing = this.records.get(nodeId);
    if (existing) return existing;
    const node = this.host.getNode(nodeId);
    if (!node) {
      throw new Error("Cannot attach Specs interaction to missing node: " + nodeId);
    }
    const target = findViroSpecsInteractionTarget(node);
    target.name = "viro-interactable:" + nodeId;
    const unbind = bindViroSpecsSik(target, { manipulation, root: node }, (event) => {
      const legacy = event.phase === "select-start" || event.phase === "select-end" || event.phase === "cancel" ? "pinch" : "hand";
      this.emit({
        source: legacy,
        inputSource: event.source,
        phase: event.phase,
        targetId: nodeId,
        ...(event.position ? { position: event.position } : {}),
        ...(event.normal ? { normal: event.normal } : {}),
        ...(event.direction ? { direction: event.direction } : {}),
      });
    });
    const record: InteractionRecord = { target, root: node, manipulation, unbind };
    this.records.set(nodeId, record);
    return record;
  }

  private emit(event: ViroSpecsPortableInteraction): void {
    const payload: ViroSpecsPortableInteraction = { ...event, timestampMs: getTime() * 1000 };
    for (const listener of this.listeners) {
      listener(payload);
    }
  }
}
