import { useEffect, useRef } from "react";
import * as Viro from "@reactvision/react-viro";
import type { MusePenInputProps, MusePenSample } from "@viro-external/xr-contract";

// Fork-only API (moyodev viro, visionOS spatial-stylus bridge); absent in
// upstream v3.0.1, so probe instead of importing directly.
type SpatialStylusSample = {
  tracked: boolean;
  position: readonly [number, number, number] | null;
  headPosition: readonly [number, number, number] | null;
  tipPressed: boolean;
  primaryPressed: boolean;
  secondaryPressed: boolean;
  pressure: number;
};
const subscribeSpatialStylus = (
  Viro as {
    subscribeSpatialStylus?: (
      listener: (sample: SpatialStylusSample) => void
    ) => () => void;
  }
).subscribeSpatialStylus;

function toMuseSample(
  sample: SpatialStylusSample,
  previousPressed: boolean
): MusePenSample {
  const pressed =
    sample.tipPressed || sample.primaryPressed || sample.secondaryPressed;

  let phase: MusePenSample["phase"];
  if (!sample.tracked) {
    phase = "cancel";
  } else if (pressed && !previousPressed) {
    phase = "down";
  } else if (!pressed && previousPressed) {
    phase = "up";
  } else if (pressed) {
    phase = "move";
  } else {
    phase = "hover";
  }

  return {
    tracked: sample.tracked,
    phase,
    position: sample.position
      ? [sample.position[0], sample.position[1], sample.position[2]]
      : null,
    headPosition: sample.headPosition
      ? [sample.headPosition[0], sample.headPosition[1], sample.headPosition[2]]
      : null,
    tipPressed: sample.tipPressed,
    primaryPressed: sample.primaryPressed,
    secondaryPressed: sample.secondaryPressed,
    pressure: sample.pressure,
    timestamp: Date.now(),
    timestampMs: performance.now(),
  };
}

/**
 * Bridges Viro's native Logitech Muse stream to a renderer-independent
 * QuickDraw input callback. Viro owns the native GameController /
 * AccessoryTrackingProvider integration.
 */
export function MusePenInput({
  enabled = true,
  onSample,
}: MusePenInputProps): null {
  const callback = useRef(onSample);
  const pressed = useRef(false);
  callback.current = onSample;

  useEffect(() => {
    if (!enabled || !subscribeSpatialStylus) return;

    pressed.current = false;
    const unsubscribe = subscribeSpatialStylus((sample) => {
      const nextPressed =
        sample.tipPressed || sample.primaryPressed || sample.secondaryPressed;
      const wasPressed = pressed.current;

      callback.current(toMuseSample(sample, wasPressed));

      pressed.current = sample.tracked && nextPressed;
    });

    return () => {
      unsubscribe();
      pressed.current = false;
    };
  }, [enabled]);

  return null;
}
