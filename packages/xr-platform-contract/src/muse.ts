export type MusePenPhase = "hover" | "down" | "move" | "up" | "cancel";

export type MusePenSample = {
  tracked: boolean;
  phase: MusePenPhase;
  position: readonly [number, number, number] | null;
  headPosition: readonly [number, number, number] | null;
  tipPressed: boolean;
  primaryPressed: boolean;
  secondaryPressed: boolean;
  /** Pressure as the stylus stream reports it. Passed through, never synthesized. */
  pressure: number;
  /** @deprecated Wall-clock milliseconds (`Date.now()`); can jump. Use `timestampMs`. */
  timestamp: number;
  /** Milliseconds on a monotonic clock (`performance.now()`), the clock board pointer events use. */
  timestampMs?: number;
};

export type MusePenInputProps = {
  enabled?: boolean;
  onSample: (sample: MusePenSample) => void;
};

/**
 * Platform-neutral contract for the Logitech Muse stream exposed by
 * @reactvision/react-viro on visionOS.
 *
 * The Viro native layer owns GameController/AccessoryTrackingProvider.
 * This package only translates that stream into QuickDraw-friendly phases.
 */
export type MusePenInputHandle = {
  dispose(): void;
};
