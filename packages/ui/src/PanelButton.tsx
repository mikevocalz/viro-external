import React, { useState } from "react";
import { ViroNode, ViroQuad, ViroText } from "@reactvision/react-viro";
import type { Vec3 } from "@viro-external/core";
import { PremiumMaterials, registerPremiumMaterials } from "./materials";
import { resolveVisualDepth, type XRVisualDepth } from "./visual-depth";

export type PanelButtonProps = {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  width?: number;
  height?: number;
  position?: Vec3;
  visualDepth?: XRVisualDepth;
};

export function PanelButton({
  label,
  onPress,
  disabled = false,
  width = 0.18,
  height = 0.07,
  position,
  visualDepth,
}: PanelButtonProps): React.ReactElement {
  registerPremiumMaterials();
  const [hovered, setHovered] = useState(false);

  const depth = resolveVisualDepth(visualDepth);
  const material = disabled
    ? PremiumMaterials.buttonDisabled
    : hovered
      ? PremiumMaterials.buttonHover
      : PremiumMaterials.button;

  return (
    <ViroNode
      position={position}
      dragType={"Gizmo" as never}
      onDrag={() => {}}
    >
      {depth.edge ? (
        <ViroQuad
          width={width * depth.edgeScale}
          height={height * depth.edgeScale}
          position={[0, 0, depth.edgeOffset]}
          materials={[PremiumMaterials.buttonEdge]}
          ignoreEventHandling
        />
      ) : null}
      <ViroQuad
        width={width}
        height={height}
        materials={[material]}
        onHover={(value: boolean) => setHovered(value)}
        onClick={disabled ? undefined : onPress}
      />
      {depth.highlight && !disabled ? (
        <ViroQuad
          width={width * 0.94}
          height={height * 0.16}
          position={[0, height * 0.32, 0.0015]}
          materials={[PremiumMaterials.buttonHighlight]}
          ignoreEventHandling
        />
      ) : null}
      <ViroText
        text={label}
        color="#F7F8FC"
        width={width * 0.9}
        height={height * 0.8}
        position={[0, 0, 0.002]}
        style={{
          textAlign: "center",
          textAlignVertical: "center",
          fontWeight: "600",
        }}
        ignoreEventHandling
      />
    </ViroNode>
  );
}
