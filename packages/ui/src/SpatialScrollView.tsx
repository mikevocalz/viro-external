import React, { useEffect, useMemo, useState } from "react";
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
  step = 1,
  showRail = true,
  onIndexChange,
}: SpatialScrollViewProps): React.ReactElement {
  registerPremiumMaterials();

  const items = useMemo(() => React.Children.toArray(children), [children]);
  const visibleCount = Math.max(1, Math.floor(height / itemHeight));
  const maxStart = Math.max(0, items.length - visibleCount);
  const [start, setStart] = useState(0);

  useEffect(() => {
    if (start <= maxStart) return;
    setStart(maxStart);
    onIndexChange?.(maxStart);
  }, [maxStart, onIndexChange, start]);

  const commit = (next: number) => {
    const value = Math.max(0, Math.min(maxStart, next));
    setStart(value);
    onIndexChange?.(value);
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
    <ViroNode position={position}>
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
        onPress={() => commit(start - step)}
      />
      <PanelButton
        label="▼"
        width={buttonSize}
        height={buttonSize}
        position={[railX, -height / 2 + buttonSize / 2, 0.006]}
        disabled={start >= maxStart}
        onPress={() => commit(start + step)}
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
