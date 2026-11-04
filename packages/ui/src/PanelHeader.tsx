import React, { useMemo } from "react";
import { ViroGeometry, ViroNode, ViroQuad, ViroText } from "@reactvision/react-viro";
import type { Vec3 } from "@viro-external/core";
import { PanelButton } from "./PanelButton";
import { buildCurvedPanelGeometry, curvedPanelPoseAtX } from "./geometry";
import { PremiumMaterials, registerPremiumMaterials } from "./materials";

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
  /** Same curvature as the owning SpatialPanel (0 means flat). */
  curvature?: number;
  segments?: number;
};

export function PanelHeader({
  width,
  height = 0.12,
  title,
  subtitle,
  actions = [],
  position,
  curvature = 0,
  segments = 36,
}: PanelHeaderProps): React.ReactElement {
  registerPremiumMaterials();
  const curved = curvature > 0;
  const arc = useMemo(
    () => curved ? buildCurvedPanelGeometry(width, height, curvature, segments) : null,
    [width, height, curvature, segments, curved]
  );
  const pose = (x: number): { position: Vec3; rotation: Vec3 } =>
    curved ? curvedPanelPoseAtX(width, curvature, x) : {
      position: [x, 0, 0],
      rotation: [0, 0, 0],
    };

  const buttonWidth = Math.min(0.18, width * 0.13);
  const gap = 0.012;
  const actionSpan =
    actions.length * buttonWidth + Math.max(0, actions.length - 1) * gap;
  const titleWidth = Math.max(0.15, width - actionSpan - 0.12);
  // A long flat text box would pass through the cylindrical surface.
  // Keep the title tangent in one readable section of a curved header.
  const visibleTitleWidth = curved ? Math.min(titleWidth, 0.42) : titleWidth;
  const titleX = -width / 2 + 0.04 + visibleTitleWidth / 2;
  const titlePose = pose(titleX);

  return (
    <ViroNode position={position}>
      {arc ? (
        <ViroGeometry
          vertices={arc.vertices}
          normals={arc.normals}
          texcoords={arc.texcoords}
          triangleIndices={arc.triangleIndices}
          materials={[PremiumMaterials.header]}
        />
      ) : (
        <ViroQuad
          width={width}
          height={height}
          materials={[PremiumMaterials.header]}
        />
      )}
      <ViroNode
        position={[
          titlePose.position[0],
          titlePose.position[1],
          titlePose.position[2] + 0.008,
        ]}
        rotation={titlePose.rotation}
      >
        {title ? (
          <ViroText
            text={title}
            color="#F7F8FC"
            width={visibleTitleWidth}
            height={subtitle ? height * 0.48 : height * 0.7}
            position={[0, subtitle ? height * 0.16 : 0, 0]}
            style={{
              textAlign: "left",
              textAlignVertical: "center",
              fontWeight: "700",
            }}
          />
        ) : null}
        {subtitle ? (
          <ViroText
            text={subtitle}
            color="#B7BFCE"
            width={visibleTitleWidth}
            height={height * 0.34}
            position={[0, -height * 0.22, 0]}
            style={{
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
        const buttonPose = pose(x);
        return (
          <ViroNode
            key={action.id}
            position={[
              buttonPose.position[0],
              buttonPose.position[1],
              buttonPose.position[2] + 0.008,
            ]}
            rotation={buttonPose.rotation}
          >
            <PanelButton
              label={action.label}
              disabled={action.disabled}
              width={buttonWidth}
              height={height * 0.72}
              onPress={action.onPress}
            />
          </ViroNode>
        );
      })}
    </ViroNode>
  );
}
