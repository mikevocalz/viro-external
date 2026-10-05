import React from "react";
import { ViroNode } from "@reactvision/react-viro";
import { PanelButton } from "./PanelButton";

export type SpatialMediaControl = {
  id: string;
  label: string;
  width?: number;
  disabled?: boolean;
  onPress: () => void;
};

export type SpatialMediaControlBarProps = {
  controls: SpatialMediaControl[];
  position?: [number, number, number];
  gap?: number;
};

export function SpatialMediaControlBar({
  controls,
  position = [0, 0, 0],
  gap = 0.025,
}: SpatialMediaControlBarProps): React.ReactElement {
  const widths = controls.map((control) => control.width ?? 0.22);
  const total = widths.reduce((sum, width) => sum + width, 0) + Math.max(0, controls.length - 1) * gap;
  let cursor = -total / 2;

  return (
    <ViroNode position={position}>
      {controls.map((control, index) => {
        const width = widths[index];
        const x = cursor + width / 2;
        cursor += width + gap;
        return (
          <PanelButton
            key={control.id}
            label={control.label}
            width={width}
            disabled={control.disabled}
            onPress={control.onPress}
            position={[x, 0, 0]}
          />
        );
      })}
    </ViroNode>
  );
}
