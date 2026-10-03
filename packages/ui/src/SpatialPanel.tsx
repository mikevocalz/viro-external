import React, { useMemo, useState } from "react";
import {
  ViroGeometry,
  ViroNode,
  ViroQuad,
} from "@reactvision/react-viro";
import {
  MovableNode,
  type MovableProps,
  type Vec3,
} from "@viro-external/core";
import {
  buildCurvedPanelGeometry,
  buildRoundedPanelGeometry,
} from "./geometry";
import {
  PanelHeader,
  type PanelHeaderAction,
} from "./PanelHeader";
import {
  PremiumMaterials,
  RenderOrder,
  registerPremiumMaterials,
} from "./materials";
import { PANEL_HEADER_HEIGHT, panelBody, panelHasHeader } from "./layout";
import { PanelBodyContext } from "./PanelLayout";

export type SpatialPanelShape = "square" | "rounded" | "curved";
export type SpatialPanelVariant = "solid" | "glass";

export type SpatialPanelProps = MovableProps & {
  title?: string;
  subtitle?: string;
  shape?: SpatialPanelShape;
  variant?: SpatialPanelVariant;
  width?: number;
  height?: number;
  cornerRadius?: number;
  curvature?: number;
  segments?: number;
  draggable?: boolean;
  resizable?: boolean;
  defaultPinned?: boolean;
  headerActions?: PanelHeaderAction[];
  showPinAction?: boolean;
  showCloseAction?: boolean;
  onPinnedChange?: (pinned: boolean) => void;
  onClose?: () => void;
  position?: Vec3;
  rotation?: Vec3;
  scale?: Vec3;
  children?: React.ReactNode;
};

export function SpatialPanel({
  title,
  subtitle,
  shape = "rounded",
  variant = "solid",
  width = 1.6,
  height = 1,
  // Horizon OS system panels round about 2 cm.
  cornerRadius = 0.02,
  curvature = 0.32,
  segments = 36,
  draggable = true,
  resizable = true,
  defaultPinned = true,
  headerActions = [],
  showPinAction = true,
  showCloseAction = true,
  onPinnedChange,
  onClose,
  position,
  rotation,
  scale,
  children,
  movable,
  tag,
  dragType,
  dragPlane,
  axisLock,
  onMoveStart,
  onMove,
  onMoveEnd,
  pinchToScale,
}: SpatialPanelProps): React.ReactElement {
  registerPremiumMaterials();

  const [pinned, setPinned] = useState(defaultPinned);
  const [closed, setClosed] = useState(false);
  // Header sits inside the top edge, as on Specs (OBJECTIVE D2).
  const headerHeight = PANEL_HEADER_HEIGHT;
  const headerY = height / 2 - headerHeight / 2;
  const hasHeader = panelHasHeader({ title, subtitle, headerActions, showPinAction, showCloseAction });
  const body = panelBody(width, height, hasHeader);

  const rounded = useMemo(
    () =>
      shape === "rounded"
        ? buildRoundedPanelGeometry(
            width,
            height,
            Math.min(cornerRadius, Math.min(width, height) * 0.1),
            8
          )
        : null,
    [cornerRadius, height, shape, width]
  );

  const curved = useMemo(
    () =>
      shape === "curved"
        ? buildCurvedPanelGeometry(
            width,
            height,
            curvature,
            segments
          )
        : null,
    [curvature, height, segments, shape, width]
  );

  if (closed) return <ViroNode />;

  const actions: PanelHeaderAction[] = [
    ...headerActions,
    ...(showPinAction
      ? [
          {
            id: "pin",
            label: pinned ? "Follow" : "Pin",
            onPress: () => {
              const next = !pinned;
              setPinned(next);
              onPinnedChange?.(next);
            },
          },
        ]
      : []),
    ...(showCloseAction
      ? [
          {
            id: "close",
            label: "×",
            onPress: () => {
              setClosed(true);
              onClose?.();
            },
          },
        ]
      : []),
  ];

  const panelMaterial =
    variant === "glass"
      ? PremiumMaterials.panelGlass
      : PremiumMaterials.panel;

  return (
    <MovableNode
      movable={movable ?? draggable}
      tag={tag ?? "vxp-spatial-panel"}
      dragType={dragType}
      dragPlane={dragPlane}
      axisLock={axisLock}
      onMoveStart={onMoveStart}
      onMove={onMove}
      onMoveEnd={onMoveEnd}
      pinchToScale={pinchToScale ?? resizable}
      position={position}
      scale={scale}
    >
      <ViroNode
        rotation={rotation}
        transformBehaviors={pinned ? undefined : ["billboardY"]}
      >
        {shape === "square" ? (
          <ViroQuad
            width={width}
            height={height}
            materials={[panelMaterial]}
            renderingOrder={RenderOrder.panel}
          />
        ) : (
          <ViroGeometry
            vertices={(rounded ?? curved)!.vertices}
            normals={(rounded ?? curved)!.normals}
            texcoords={(rounded ?? curved)!.texcoords}
            triangleIndices={(rounded ?? curved)!.triangleIndices}
            materials={[panelMaterial]}
            renderingOrder={RenderOrder.panel}
          />
        )}

        {children ? (
          <ViroNode position={[0, 0, 0.012]}>
            <PanelBodyContext.Provider value={body}>
              {children}
            </PanelBodyContext.Provider>
          </ViroNode>
        ) : null}

        {(title || subtitle || actions.length > 0) ? (
          <PanelHeader
            width={width}
            height={headerHeight}
            title={title}
            subtitle={subtitle}
            actions={actions}
            position={[0, headerY, 0.008]}
          />
        ) : null}
      </ViroNode>
    </MovableNode>
  );
}
