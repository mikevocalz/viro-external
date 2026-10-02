import React, { useState } from "react";
import { ViroNode, ViroQuad, ViroText } from "@reactvision/react-viro";
import type { Vec3 } from "@viro-external/core";
import { PremiumMaterials, registerPremiumMaterials } from "./materials";

export type PanelButtonProps = {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  width?: number;
  height?: number;
  position?: Vec3;
};

export function PanelButton({
  label,
  onPress,
  disabled = false,
  width = 0.18,
  height = 0.07,
  position,
}: PanelButtonProps): React.ReactElement {
  registerPremiumMaterials();
  const [hovered, setHovered] = useState(false);

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
      <ViroQuad
        width={width}
        height={height}
        materials={[material]}
        onHover={(value: boolean) => setHovered(value)}
        onClick={disabled ? undefined : onPress}
      />
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
