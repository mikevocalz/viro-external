import React, { useState } from "react";
import { ScaledViroText } from "./ScaledViroText";
import { ViroNode, ViroQuad } from "@reactvision/react-viro";
import type { Vec3 } from "@viro-external/core";
import { PANEL_TYPE } from "./layout";
import { PremiumMaterials, RenderOrder, registerPremiumMaterials } from "./materials";

export type PanelButtonProps = {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  width?: number;
  height?: number;
  position?: Vec3;
  fontSize?: number;
};

export function PanelButton({
  label,
  onPress,
  disabled = false,
  width = 0.18,
  height = 0.07,
  position,
  fontSize = PANEL_TYPE.label.fontSize,
}: PanelButtonProps): React.ReactElement {
  registerPremiumMaterials();
  const [hovered, setHovered] = useState(false);

  const material = disabled
    ? PremiumMaterials.buttonDisabled
    : hovered
      ? PremiumMaterials.buttonHover
      : PremiumMaterials.button;

  return (
    <ViroNode position={position}>
      <ViroQuad
        width={width}
        height={height}
        materials={[material]}
        renderingOrder={RenderOrder.backing}
        onHover={(value: boolean) => setHovered(value)}
        onClick={disabled ? undefined : onPress}
      />
      <ScaledViroText
        text={label}
        color="#F7F8FC"
        width={width * 0.9}
        // One line tall and centred on the quad: in a taller box Viro sits the
        // line toward the top even with textAlignVertical "center".
        height={Math.min(height, (fontSize / 1000) * 1.25)}
        position={[0, 0, 0.002]}
        style={{
          fontSize,
          textAlign: "center",
          textAlignVertical: "center",
          fontWeight: "600",
        }}
        ignoreEventHandling
      />
    </ViroNode>
  );
}
