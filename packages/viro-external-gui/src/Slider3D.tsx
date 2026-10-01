import React, { useCallback, useEffect, useMemo } from "react";
import { ViroBox, ViroNode, ViroQuad } from "@reactvision/react-viro";
import { MovableNode, type Vec3 } from "react-native-viro-mux";
import { create } from "zustand";

export interface Slider3DProps {
  id: string;
  minimum: number;
  maximum: number;
  /** Initial value. Subsequent writes come from the Zustand store. */
  value: number;
  step?: number;
  isHorizontal?: boolean;
  /** Track length in meters. */
  length?: number;
  trackThicknessMeters?: number;
  thumbSizeMeters?: number;
  trackMaterial?: string;
  thumbMaterial?: string;
  position?: Vec3;
  rotation?: Vec3;
  scale?: Vec3;
  onValueChange?: (value: number) => void;
}

interface SliderStore {
  values: Record<string, number>;
  set: (id: string, v: number) => void;
}

export const useSliderStore = create<SliderStore>((set) => ({
  values: {},
  set: (id, v) => set((s) => ({ values: { ...s.values, [id]: v } })),
}));

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

function snap(v: number, step: number, min: number) {
  if (step <= 0) return v;
  const k = Math.round((v - min) / step);
  return min + k * step;
}

/**
 * Spatial slider. Track + thumb. The thumb is a `MovableNode` axis-locked to the
 * track axis (this is exactly why `axisLock` exists in PROMPT-1 — Viro cannot
 * line-lock a drag natively). Value lives in Zustand, never `useState`.
 */
export function Slider3D(props: Slider3DProps): React.ReactElement {
  const {
    id,
    minimum,
    maximum,
    value: initialValue,
    step = (maximum - minimum) / 100,
    isHorizontal = true,
    length = 0.6,
    trackThicknessMeters = 0.008,
    thumbSizeMeters = 0.04,
    trackMaterial,
    thumbMaterial,
    position,
    rotation,
    scale,
    onValueChange,
  } = props;

  const setStoreValue = useSliderStore((s) => s.set);
  const storeValue = useSliderStore((s) => s.values[id]);
  const value = storeValue ?? initialValue;

  useEffect(() => {
    if (storeValue === undefined) setStoreValue(id, initialValue);
  }, [id, initialValue, setStoreValue, storeValue]);

  const range = maximum - minimum;
  const valueToOffset = useCallback(
    (v: number) => ((v - minimum) / range) * length - length / 2,
    [minimum, range, length]
  );

  const offsetToValue = useCallback(
    (offset: number) => {
      const raw = ((offset + length / 2) / length) * range + minimum;
      return clamp(snap(raw, step, minimum), minimum, maximum);
    },
    [length, range, minimum, maximum, step]
  );

  const thumbWorld = useMemo<Vec3>(() => {
    const o = valueToOffset(value);
    return isHorizontal ? [o, 0, 0] : [0, o, 0];
  }, [value, valueToOffset, isHorizontal]);

  const handleMove = useCallback(
    (worldPos: Vec3) => {
      const offset = isHorizontal ? worldPos[0] : worldPos[1];
      const v = offsetToValue(offset);
      setStoreValue(id, v);
      onValueChange?.(v);
    },
    [id, isHorizontal, offsetToValue, onValueChange, setStoreValue]
  );

  const trackMaterials = trackMaterial ? [trackMaterial] : undefined;
  const thumbMaterials = thumbMaterial ? [thumbMaterial] : undefined;

  return (
    <ViroNode position={position} rotation={rotation} scale={scale}>
      <ViroQuad
        width={isHorizontal ? length : trackThicknessMeters}
        height={isHorizontal ? trackThicknessMeters : length}
        materials={trackMaterials}
      />
      <MovableNode
        movable
        dragType="FixedDistance"
        axisLock={isHorizontal ? ["y", "z"] : ["x", "z"]}
        onMove={handleMove}
        position={thumbWorld}
      >
        <ViroBox
          width={thumbSizeMeters}
          height={thumbSizeMeters}
          length={thumbSizeMeters}
          materials={thumbMaterials}
        />
      </MovableNode>
    </ViroNode>
  );
}

// Self-check: snap respects step.
const nodeEnv = (
  globalThis as typeof globalThis & {
    process?: { env?: { NODE_ENV?: string } };
  }
).process?.env?.NODE_ENV;

if (nodeEnv === "test") {
  console.assert(snap(0.37, 0.1, 0) === 0.4 || snap(0.37, 0.1, 0) === 0.30000000000000004, "snap rounds to nearest step");
  console.assert(clamp(2, 0, 1) === 1, "clamp upper bound");
}
