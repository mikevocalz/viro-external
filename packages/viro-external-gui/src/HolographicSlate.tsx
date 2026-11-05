import React from "react";
import type { Vec3, MovableProps } from "react-native-viro-mux";
import {
  SpatialPanel,
  registerPanelSurfaceMaterial,
  type SpatialPanelShape,
  type SpatialWorkspaceSlot,
  type WorldSlotOptions,
  type SpatialWorkspaceOrigin,
} from "@viro-external/ui";

/**
 * @deprecated Use SpatialPanel from @viro-external/ui directly.
 *
 * This is a thin backwards-compatible prop adapter, NOT a second renderer.
 * The former glow plates, duplicate title bar, resize gizmos and local
 * pin/close state have been removed in favor of the canonical premium panel.
 */
export interface HolographicSlateProps extends MovableProps {
  title?: string;
  /** @deprecated The unified panel owns its typography. */
  titleFontFamily?: string;
  /** @deprecated Chrome dimensions are derived from panel size. */
  titleBarHeight?: number;
  /** @deprecated Chrome spacing is derived from panel size. */
  titleBarMargin?: number;
  dimensions?: { width: number; height: number };
  /** @deprecated Was never enforced by the original implementation. */
  minDimensions?: { width: number; height: number };
  /** @deprecated Was never applied by the original implementation. */
  renderingGroupId?: number;
  /** Registered Viro material for the content-facing panel surface. */
  contentMaterialName?: string;
  opacity?: number;
  defaultPinned?: boolean;
  onClose?: () => void;
  position?: Vec3;
  rotation?: Vec3;
  scale?: Vec3;
  children?: React.ReactNode;
  /** New unified surface controls, supported without another panel root. */
  shape?: SpatialPanelShape;
  curvature?: number;
  snapTo?: SpatialWorkspaceSlot;
  snapOnRelease?: boolean;
  snapDistanceM?: number;
  snapOptions?: WorldSlotOptions;
  worldOrigin?: SpatialWorkspaceOrigin;
  onSnap?: (slot: SpatialWorkspaceSlot) => void;
}

/**
 * Legacy entry point, canonical implementation. Use @viro-external/ui for
 * new code to avoid pulling the retired GUI material/header tree.
 */
export function HolographicSlate({
  title,
  dimensions,
  contentMaterialName,
  opacity,
  defaultPinned,
  onClose,
  position,
  rotation,
  scale,
  children,
  shape = "curved",
  curvature = 0.28,
  snapTo,
  snapOnRelease,
  snapDistanceM,
  snapOptions,
  worldOrigin,
  onSnap,
  movable,
  tag,
  dragType,
  dragPlane,
  axisLock,
  onMoveStart,
  onMove,
  onMoveEnd,
  pinchToScale,
}: HolographicSlateProps): React.ReactElement {
  // Preserve the old external-texture contract: legacy callers may pass a
  // name expecting the slate to register it before the first Viro frame.
  // The single canonical SpatialPanel still owns the visible geometry.
  if (contentMaterialName) {
    registerPanelSurfaceMaterial(contentMaterialName);
  }
  return (
    <SpatialPanel
      title={title}
      width={dimensions?.width}
      height={dimensions?.height}
      surfaceMaterial={contentMaterialName}
      opacity={opacity}
      shape={shape}
      curvature={curvature}
      snapTo={snapTo}
      snapOnRelease={snapOnRelease}
      snapDistanceM={snapDistanceM}
      snapOptions={snapOptions}
      worldOrigin={worldOrigin}
      onSnap={onSnap}
      defaultPinned={defaultPinned}
      onClose={onClose}
      showCloseAction={onClose !== undefined}
      position={position}
      rotation={rotation}
      scale={scale}
      movable={movable}
      tag={tag}
      dragType={dragType}
      dragPlane={dragPlane}
      axisLock={axisLock}
      onMoveStart={onMoveStart}
      onMove={onMove}
      onMoveEnd={onMoveEnd}
      pinchToScale={pinchToScale}
    >
      {children}
    </SpatialPanel>
  );
}
