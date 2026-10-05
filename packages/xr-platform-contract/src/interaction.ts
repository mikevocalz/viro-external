/** Vendor-neutral XR interaction semantics shared by Viro, Specs/ESIK and Meta Display. */

export type XRUIInputSource =
  | "touch" | "gaze" | "pinch" | "dpad" | "controller"
  | "hand" | "voice" | "keyboard";

export type XRUIInteractionPhase =
  | "hover-enter" | "hover-move" | "hover-exit"
  | "focus-enter" | "focus-exit"
  | "select-start" | "select-end" | "press" | "long-press"
  | "drag-start" | "drag" | "drag-end" | "scroll" | "swipe"
  | "grab" | "release" | "cancel";

export type XRUIInteractionEvent = {
  source: XRUIInputSource;
  phase: XRUIInteractionPhase;
  targetId?: string;
  position?: [number, number, number];
  direction?: [number, number, number];
  delta?: [number, number];
  value?: number;
  timestampMs?: number;
};

export type XRUIInteractionCapabilities = {
  sources: readonly XRUIInputSource[];
  phases: readonly XRUIInteractionPhase[];
  focus: boolean;
  hover: boolean;
  manipulation: boolean;
  scroll: boolean;
};

export interface XRUIInteractionAdapter {
  readonly id: string;
  getCapabilities(): XRUIInteractionCapabilities;
  subscribe(listener: (event: XRUIInteractionEvent) => void): () => void;
  setInteractable?(targetId: string, enabled: boolean): Promise<void> | void;
  setManipulationEnabled?(targetId: string, enabled: boolean): Promise<void> | void;
  dispose(): Promise<void> | void;
}

export type XRUIActivationPolicy =
  | "select" | "press" | "pinch" | "dpad-confirm";

export type XRUIComponentInteraction = {
  activation?: XRUIActivationPolicy;
  preferredSource?: XRUIInputSource;
  focusable?: boolean;
  hoverable?: boolean;
  draggable?: boolean;
  scrollable?: boolean;
};
