import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { useStore } from "zustand";
import { createPanelStore } from "./panel-store";
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
  registerPremiumMaterials,
} from "./materials";
import { resolveVisualDepth } from "./visual-depth";
import {
  nearestWorldSlot, worldSlot,
  type SpatialWorkspaceSlot, type WorldSlotOptions,
} from "./world-slot";
import { useSpatialWorkspaceOrigin, type SpatialWorkspaceOrigin } from "./SpatialWorkspace";

export type SpatialPanelShape = "square" | "rounded" | "curved";
export type SpatialPanelVariant = "solid" | "glass";

export type SpatialPanelProps = MovableProps & {
  title?: string;
  subtitle?: string;
  shape?: SpatialPanelShape;
  /** Shortcut for shape="curved" when shape is omitted. */
  curved?: boolean;
  /** Initial left/center/right world slot. */
  snapTo?: SpatialWorkspaceSlot;
  /** Auto-snap on drag release (defaults to true when snapTo is provided). */
  snapOnRelease?: boolean;
  /** Maximum snap radius in meters (default 0.8). */
  snapDistanceM?: number;
  snapOptions?: WorldSlotOptions;
  /** Explicit alternative to the SpatialWorkspaceFrame origin. */
  worldOrigin?: SpatialWorkspaceOrigin;
  onSnap?: (slot: SpatialWorkspaceSlot) => void;
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
  visualDepth?: import("./visual-depth").XRVisualDepth;
};

export function SpatialPanel({
  title,
  subtitle,
  shape,
  curved: curvedProp = false,
  snapTo,
  snapOnRelease,
  snapDistanceM = 0.8,
  snapOptions,
  worldOrigin,
  onSnap,
  variant = "solid",
  width = 1.6,
  height = 1,
  cornerRadius = 0.06,
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
  visualDepth,
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
  const depth = resolveVisualDepth(visualDepth);
  const resolvedShape: SpatialPanelShape = shape ?? (curvedProp ? "curved" : "rounded");
  const frameOrigin = useSpatialWorkspaceOrigin();
  const origin = worldOrigin ?? frameOrigin;
  if ((snapTo !== undefined || snapOnRelease === true) && origin === null) {
    throw new Error("SpatialPanel: snapTo/snapOnRelease requires SpatialWorkspaceFrame or worldOrigin");
  }

  // Drag-released placement overrides initial slot without fighting live head
  // tracking. Changing the authored slot / captured pose resets the override.
  const initialPlacement = origin && snapTo
    ? worldSlot(snapTo, origin.headPosition, origin.headYawDeg, snapOptions)
    : null;
  const storeRef = useRef<ReturnType<typeof createPanelStore> | null>(null);
  if (storeRef.current === null) storeRef.current = createPanelStore({ defaultPinned, position, rotation });
  const store = storeRef.current;
  const releasedPlacement = useStore(store, (state) => state.releasedPlacement);
  const pinned = useStore(store, (state) => state.pinned);
  const closed = useStore(store, (state) => state.closed);
  const setReleasedPlacement = store.getState().setReleasedPlacement;
  useEffect(() => {
    setReleasedPlacement(null);
  }, [
    setReleasedPlacement, snapTo, origin?.headPosition[0], origin?.headPosition[1], origin?.headPosition[2],
    origin?.headYawDeg, snapOptions?.distanceM, snapOptions?.sideAngleDeg,
    snapOptions?.verticalOffsetM,
  ]);
  useEffect(() => {
    store.getState().syncAuthoredPose({ position, rotation, initialPlacement });
  }, [
    store, position?.[0], position?.[1], position?.[2],
    rotation?.[0], rotation?.[1], rotation?.[2],
  ]);
  const resolvedPlacement = releasedPlacement ?? initialPlacement;

  const handleMoveEnd = useCallback((worldPos: Vec3) => {
    onMoveEnd?.(worldPos);
    if (!origin) return;

    if (snapOnRelease ?? snapTo !== undefined) {
      const nearest = nearestWorldSlot(
        worldPos, origin.headPosition, origin.headYawDeg, snapOptions, snapDistanceM
      );
      if (nearest) {
        setReleasedPlacement({
          position: nearest.placement.position,
          rotation: nearest.placement.rotation,
        }, worldPos);
        onSnap?.(nearest.slot);
        return;
      }
    }

    // Outside the snap radius: leave it world-fixed where it was released.
    setReleasedPlacement({
      position: [...worldPos] as Vec3,
      rotation: resolvedPlacement?.rotation ?? rotation ?? [0, 0, 0],
    }, worldPos);
  }, [
    onMoveEnd, origin, snapOnRelease, snapTo, snapOptions, snapDistanceM,
    onSnap, resolvedPlacement, rotation, setReleasedPlacement,
  ]);

  const headerHeight = Math.max(0.1, height * 0.11);
  const headerY = height / 2 + headerHeight / 2 + 0.015;

  const rounded = useMemo(
    () =>
      resolvedShape === "rounded"
        ? buildRoundedPanelGeometry(
            width,
            height,
            cornerRadius,
            14
          )
        : null,
    [cornerRadius, height, resolvedShape, width]
  );

  const curved = useMemo(
    () =>
      resolvedShape === "curved"
        ? buildCurvedPanelGeometry(
            width,
            height,
            curvature,
            segments
          )
        : null,
    [curvature, height, segments, resolvedShape, width]
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
              const next = !store.getState().pinned;
              store.setState({ pinned: next });
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
              store.setState({ closed: true });
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
      onMoveEnd={origin ? handleMoveEnd : onMoveEnd}
      pinchToScale={pinchToScale ?? resizable}
      position={resolvedPlacement?.position ?? position}
      scale={scale}
    >
      <ViroNode
        rotation={resolvedPlacement?.rotation ?? rotation}
        transformBehaviors={pinned ? undefined : ["billboardY"]}
      >
        {depth.edge ? (
          resolvedShape === "square" ? (
            <ViroQuad width={width * depth.edgeScale} height={height * depth.edgeScale} position={[0, 0, depth.edgeOffset]} materials={[PremiumMaterials.panelEdge]} ignoreEventHandling />
          ) : (
            <ViroGeometry
              vertices={(rounded ?? curved)!.vertices.map(([x,y,z]) => [x * depth.edgeScale, y * depth.edgeScale, z + depth.edgeOffset] as [number,number,number])}
              normals={(rounded ?? curved)!.normals}
              texcoords={(rounded ?? curved)!.texcoords}
              triangleIndices={(rounded ?? curved)!.triangleIndices}
              materials={[PremiumMaterials.panelEdge]}
              ignoreEventHandling
            />
          )
        ) : null}
        {resolvedShape === "square" ? (
          <ViroQuad
            width={width}
            height={height}
            materials={[panelMaterial]}
          />
        ) : (
          <ViroGeometry
            vertices={(rounded ?? curved)!.vertices}
            normals={(rounded ?? curved)!.normals}
            texcoords={(rounded ?? curved)!.texcoords}
            triangleIndices={(rounded ?? curved)!.triangleIndices}
            materials={[panelMaterial]}
          />
        )}

        {children ? (
          <ViroNode position={[0, 0, 0.012]}>
            {children}
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
