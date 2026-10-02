import type {
  PortableXRInteraction,
  XRInteractionPhase,
  XRInteractionSource,
} from "@viro-external/xr-contract";

export type SpecsInteractionInput = Extract<
  XRInteractionSource,
  "gaze" | "hand" | "pinch" | "voice"
>;

export type SpecsInteractionKind = Extract<
  XRInteractionPhase,
  | "hover-enter"
  | "hover-move"
  | "hover-exit"
  | "select-start"
  | "select-end"
  | "drag"
  | "cancel"
>;

export type SpecsRawInteraction = {
  kind: SpecsInteractionKind;
  input: SpecsInteractionInput;
  targetId?: string;
  worldPosition?: [number, number, number];
  worldDirection?: [number, number, number];
  timestampMs?: number;
};

export function normalizeSpecsInteraction(
  event: SpecsRawInteraction
): PortableXRInteraction {
  return {
    source: event.input,
    phase: event.kind,
    ...(event.targetId ? { targetId: event.targetId } : {}),
    ...(event.worldPosition ? { position: event.worldPosition } : {}),
    ...(event.worldDirection ? { direction: event.worldDirection } : {}),
    ...(event.timestampMs !== undefined
      ? { timestampMs: event.timestampMs }
      : {}),
  };
}

export interface SpecsInteractionRuntime {
  subscribe(
    listener: (event: PortableXRInteraction) => void
  ): () => void;
  setInteractable?(nodeId: string, enabled: boolean): Promise<void> | void;
  setManipulationEnabled?(
    nodeId: string,
    enabled: boolean
  ): Promise<void> | void;
}

export const SPECS_INTERACTION_PACKAGES = [
  "SpecsInteractionKitExamples",
  "InteractableHelper",
] as const;
