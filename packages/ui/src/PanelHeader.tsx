import React from "react";
import { ScaledViroText } from "./ScaledViroText";
import { ViroNode, ViroQuad } from "@reactvision/react-viro";
import type { Vec3 } from "@viro-external/core";
import { PanelButton } from "./PanelButton";
import { PANEL_HEADER_HEIGHT, PANEL_TYPE, headerTextOffsets } from "./layout";
import { PremiumMaterials, RenderOrder, registerPremiumMaterials } from "./materials";

export type PanelHeaderAction = {
  id: string;
  label: string;
  onPress: () => void;
  disabled?: boolean;
};

export type PanelHeaderProps = {
  width: number;
  height?: number;
  title?: string;
  subtitle?: string;
  actions?: PanelHeaderAction[];
  position?: Vec3;
};

export function PanelHeader({
  width,
  height = PANEL_HEADER_HEIGHT,
  title,
  subtitle,
  actions = [],
  position,
}: PanelHeaderProps): React.ReactElement {
  registerPremiumMaterials();

  const buttonWidth = Math.min(0.2, width * 0.15);
  const gap = 0.012;
  const actionSpan =
    actions.length * buttonWidth + Math.max(0, actions.length - 1) * gap;
  const titleWidth = Math.max(0.15, width - actionSpan - 0.12);

  return (
    <ViroNode position={position}>
      <ViroQuad
        width={width}
        height={height}
        materials={[PremiumMaterials.header]}
        renderingOrder={RenderOrder.backing}
      />
      <ViroNode position={[-width / 2 + 0.04, 0, 0.003]}>
        {title ? (
          <ScaledViroText
            text={title}
            color="#F7F8FC"
            width={titleWidth}
            height={PANEL_TYPE.title.lineHeight}
            position={[titleWidth / 2, subtitle ? headerTextOffsets().titleY : 0, 0]}
            style={{
              fontSize: PANEL_TYPE.title.fontSize,
              textAlign: "left",
              textAlignVertical: "center",
              fontWeight: "700",
            }}
          />
        ) : null}
        {subtitle ? (
          <ScaledViroText
            text={subtitle}
            color="#B7BFCE"
            width={titleWidth}
            height={PANEL_TYPE.caption.lineHeight}
            position={[titleWidth / 2, headerTextOffsets().subtitleY, 0]}
            style={{
              fontSize: PANEL_TYPE.caption.fontSize,
              textAlign: "left",
              textAlignVertical: "center",
            }}
          />
        ) : null}
      </ViroNode>

      {actions.map((action, index) => {
        const x =
          width / 2 -
          actionSpan +
          buttonWidth / 2 +
          index * (buttonWidth + gap) -
          0.025;
        return (
          <PanelButton
            key={action.id}
            label={action.label}
            disabled={action.disabled}
            width={buttonWidth}
            height={height * 0.72}
            position={[x, 0, 0.004]}
            onPress={action.onPress}
          />
        );
      })}
    </ViroNode>
  );
}
