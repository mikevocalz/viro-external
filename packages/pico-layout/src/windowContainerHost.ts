/**
 * App-level bridge into the verified @expo-pico/spatial WindowContainer API.
 *
 * PICO OS 6 opens an ACTIVITY-backed container, not one React element per
 * window. This host must never claim Subwindow/Augment support or present a
 * map/detail panel in another activity unless that native bridge exists.
 */
export interface PicoWindowContainerBridge {
  getLayoutBridgeStatus(): {
    sdkLinked: boolean;
    spatialPlatform: boolean;
    reason?: string | null;
  };
  openWindowContainer(
    id: string, options?: { tag?: string }
  ): { ok: true } | { ok: false; reason: string };
  closeWindowContainer(
    id: string, options?: { tag?: string }
  ): { ok: true } | { ok: false; reason: string };
}

export type PicoWindowContainerPresentation =
  | { kind: "requested"; id: string }
  | { kind: "fallback"; reason: string };

export class PicoWindowContainerHost {
  private requestedId: string | undefined;

  private readonly bridge: PicoWindowContainerBridge;

  constructor(bridge: PicoWindowContainerBridge) {
    this.bridge = bridge;
  }

  /** Only one activity-backed WindowContainer may be owned by this host. */
  open(id: string): PicoWindowContainerPresentation {
    if (!id.trim()) throw new RangeError("WindowContainer id must be non-empty");
    if (this.requestedId === id) return { kind: "requested", id };
    if (this.requestedId !== undefined) {
      return { kind: "fallback", reason: "ANOTHER_CONTAINER_ACTIVE" };
    }
    const status = this.bridge.getLayoutBridgeStatus();
    if (!status.sdkLinked || !status.spatialPlatform) {
      return { kind: "fallback", reason: status.reason ?? "PICO_SPATIAL_UNAVAILABLE" };
    }
    const result = this.bridge.openWindowContainer(id);
    if (!result.ok) return { kind: "fallback", reason: result.reason };
    this.requestedId = id;
    return { kind: "requested", id };
  }

  /** Return false on real native failure; preserve state so caller can retry. */
  close(): boolean {
    if (this.requestedId === undefined) return true;
    const result = this.bridge.closeWindowContainer(this.requestedId);
    if (!result.ok) return false;
    this.requestedId = undefined;
    return true;
  }

  /** Never silently forget a native container after failed close. */
  dispose(): boolean { return this.close(); }
}
