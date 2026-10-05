import { useEffect, useRef } from "react";
import {
  subscribeSpatialStylus,
  type ViroSpatialStylusSample,
} from "@reactvision/react-viro";
import type { MusePenInputProps, MusePenSample } from "@viro-external/xr-contract";

function phaseFor(sample: ViroSpatialStylusSample): MusePenSample["phase"] {
  if (!sample.tracked) return "cancel";
  if (sample.tipPressed || sample.primaryPressed || sample.secondaryPressed) {
    return "move";
  }
  return "hover";
}

function toMuseSample(sample: ViroSpatialStylusSample): MusePenSample {
  return {
    tracked: sample.tracked,
    phase: phaseFor(sample),
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
  };
}

/**
 * Bridges Viro's native Logitech Muse stream to a renderer-independent
 * QuickDraw input callback. The native Muse SDK remains entirely below Viro.
 */
export function MusePenInput({
  enabled = true,
  onSample,
}: MusePenInputProps): null {
  const callback = useRef(onSample);
  callback.current = onSample;

  useEffect(() => {
    if (!enabled) return;
    const unsubscribe = subscribeSpatialStylus((sample) => {
      callback.current(toMuseSample(sample));
    });
    return unsubscribe;
  }, [enabled]);

  return null;
}
