import React, { useEffect, useMemo, useRef, useState } from "react";
import { Platform } from "react-native";
import { ViroNode, ViroQuad } from "@reactvision/react-viro";
import type { Vec3 } from "@viro-external/core";
import { PanelButton } from "./PanelButton";
import { PremiumMaterials, registerPremiumMaterials } from "./materials";

export type SpatialScrollViewProps = {
  width: number;
  height: number;
  itemHeight: number;
  children: React.ReactNode;
  position?: Vec3;
  /** Index of the first visible item on mount, clamped to the valid range. */
  initialIndex?: number;
  step?: number;
  showRail?: boolean;
  onIndexChange?: (index: number) => void;
};

export function SpatialScrollView({
  width,
  height,
  itemHeight,
  children,
  position,
  initialIndex = 0,
  step = 1,
  showRail = true,
  onIndexChange,
}: SpatialScrollViewProps): React.ReactElement {
  registerPremiumMaterials();

  const items = useMemo(() => React.Children.toArray(children), [children]);
  const visibleCount = Math.max(1, Math.floor(height / itemHeight));
  const maxStart = Math.max(0, items.length - visibleCount);
  const [start, setStart] = useState(() =>
    Math.max(0, Math.min(maxStart, Math.floor(initialIndex))),
  );
  // Mirrors `start` synchronously. Wheel events arrive from a native DOM
  // listener, so React may not re-render between two events of one fast
  // spin; reading `start` from the render closure would drop steps.
  const startRef = useRef(start);
  const webScrollAccumulator = useRef(0);

  useEffect(() => {
    if (start <= maxStart) return;
    startRef.current = maxStart;
    setStart(maxStart);
    onIndexChange?.(maxStart);
  }, [maxStart, onIndexChange, start]);

  const commit = (next: number) => {
    const value = Math.max(0, Math.min(maxStart, next));
    if (value === startRef.current) return;
    startRef.current = value;
    setStart(value);
    onIndexChange?.(value);
  };

  const handleWebScroll = (scrollPos: Vec3) => {
    if (Platform.OS !== "web" || maxStart === 0) return;

    // Trackpads emit many small deltas; mouse wheels emit fewer large ones.
    // Accumulate both into deterministic item steps so a single gesture does
    // not skip an unpredictable number of spatial rows.
    webScrollAccumulator.current += scrollPos[1];
    const threshold = 24;
    if (Math.abs(webScrollAccumulator.current) < threshold) return;

    const direction = webScrollAccumulator.current > 0 ? 1 : -1;
    webScrollAccumulator.current = 0;
    commit(startRef.current + direction * step);
  };

  const visible = items.slice(start, start + visibleCount);
  const railX = width / 2 + 0.055;
  const buttonSize = Math.min(0.09, itemHeight * 0.72);
  const trackHeight = Math.max(0.05, height - buttonSize * 2.4);
  const thumbFraction =
    items.length === 0 ? 1 : Math.min(1, visibleCount / items.length);
  const thumbHeight = Math.max(0.035, trackHeight * thumbFraction);
  const travel = Math.max(0, trackHeight - thumbHeight);
  const progress = maxStart === 0 ? 0 : start / maxStart;
  const thumbY = trackHeight / 2 - thumbHeight / 2 - progress * travel;

  return (
    <ViroNode
      position={position}
      onScroll={Platform.OS === "web" ? handleWebScroll : undefined}
    >
      {visible.map((child, index) => {
        const y =
          height / 2 -
          itemHeight / 2 -
          index * itemHeight;
        return (
          <ViroNode key={index} position={[0, y, 0.004]}>
            {child}
          </ViroNode>
        );
      })}

      <PanelButton
        label="▲"
        width={buttonSize}
        height={buttonSize}
        position={[railX, height / 2 - buttonSize / 2, 0.006]}
        disabled={start === 0}
        onPress={() => commit(startRef.current - step)}
      />
      <PanelButton
        label="▼"
        width={buttonSize}
        height={buttonSize}
        position={[railX, -height / 2 + buttonSize / 2, 0.006]}
        disabled={start >= maxStart}
        onPress={() => commit(startRef.current + step)}
      />

      {showRail ? (
        <ViroNode position={[railX, 0, 0.004]}>
          <ViroQuad
            width={0.014}
            height={trackHeight}
            materials={[PremiumMaterials.rail]}
          />
          <ViroQuad
            width={0.025}
            height={thumbHeight}
            position={[0, thumbY, 0.002]}
            materials={[PremiumMaterials.thumb]}
          />
        </ViroNode>
      ) : null}
    </ViroNode>
  );
}
