import type {
  XRUIInteractionAdapter,
  XRUIInteractionCapabilities,
  XRUIInteractionEvent,
} from "@viro-external/xr-contract";
import type { SpecsInteractionRuntime, SpecsRawInteraction } from "./interaction.js";
import { normalizeSpecsInteraction } from "./interaction.js";

const CAPABILITIES: XRUIInteractionCapabilities = {
  sources: ["gaze", "hand", "pinch", "voice"],
  phases: [
    "hover-enter", "hover-move", "hover-exit",
    "select-start", "select-end",
    "drag-start", "drag", "drag-end",
    "cancel", "grab", "release",
  ],
  focus: true,
  hover: true,
  manipulation: true,
  scroll: false,
};

/**
 * Adapts the existing Specs interaction/ESIK runtime into the shared XR UI
 * behavior contract. SIK/ESIK remains the native implementation; this class
 * only normalizes its events for portable components.
 */
export class SpecsESIKUIAdapter implements XRUIInteractionAdapter {
  readonly id = "specs-esik";

  constructor(private readonly runtime: SpecsInteractionRuntime) {}

  getCapabilities(): XRUIInteractionCapabilities {
    return CAPABILITIES;
  }

  subscribe(listener: (event: XRUIInteractionEvent) => void): () => void {
    return this.runtime.subscribe((event) => listener(event));
  }

  normalize(raw: SpecsRawInteraction): XRUIInteractionEvent {
    return normalizeSpecsInteraction(raw);
  }

  setInteractable(targetId: string, enabled: boolean): Promise<void> | void {
    return this.runtime.setInteractable?.(targetId, enabled);
  }

  setManipulationEnabled(targetId: string, enabled: boolean): Promise<void> | void {
    return this.runtime.setManipulationEnabled?.(targetId, enabled);
  }

  dispose(): Promise<void> | void {}
}
