import React, { useCallback } from "react";
import type { MovableProps, Vec3 } from "react-native-viro-mux";
import {
  SpatialPanel,
  type SpatialWorkspaceSlot,
  type SpatialWorkspaceOrigin,
  type WorldSlotOptions,
} from "@viro-external/ui";
import defaults from "../config/defaults.json";
import { Container3D, type ArrangedChild } from "./Container3D";
import { MovablePanelContext } from "./MovablePanelContext";

/** @deprecated Use SpatialPanel with a curved layout for new experiences. */
export type VolumeOrientation =
  | "FACEORIGIN_ORIENTATION"
  | "FACEORIGIN_REVERSED"
  | "FACEFORWARD_ORIENTATION"
  | "FACEFORWARD_REVERSED";

export interface CylinderPanelProps extends MovableProps {
  radius?: number;
  margin?: number;
  columns?: number;
  rows?: number;
  orientation?: VolumeOrientation;
  itemWidth?: number;
  itemHeight?: number;
  blockLayout?: boolean;
  title?: string;
  /** @deprecated Typography is owned by the canonical panel header. */
  titleFontFamily?: string;
  onClose?: () => void;
  defaultPinned?: boolean;
  position?: Vec3;
  rotation?: Vec3;
  scale?: Vec3;
  children: React.ReactNode;
  /** The new snapping API, forwarded to the one canonical panel owner. */
  snapTo?: SpatialWorkspaceSlot;
  snapOnRelease?: boolean;
  snapDistanceM?: number;
  snapOptions?: WorldSlotOptions;
  worldOrigin?: SpatialWorkspaceOrigin;
  onSnap?: (slot: SpatialWorkspaceSlot) => void;
}

const degrees = (radians: number) => radians * 180 / Math.PI;
const radians = (degreesValue: number) => degreesValue * Math.PI / 180;

export interface ArcLayout {
  arcDegrees: number;
  stepDegrees: number;
}

/** Retained for existing grid users. Native chrome/snap state is no longer duplicated. */
export function deriveCylinderArc(opts: {
  radius: number;
  itemWidth: number;
  columns: number;
  marginRadians: number;
}): ArcLayout {
  const { radius, itemWidth, columns, marginRadians } = opts;
  if (!Number.isFinite(radius) || radius <= 0 ||
      !Number.isFinite(itemWidth) || itemWidth <= 0 ||
      !Number.isInteger(columns) || columns <= 0 ||
      !Number.isFinite(marginRadians) || marginRadians < 0 ||
      itemWidth >= 2 * radius) {
    throw new RangeError("CylinderPanel: expected positive radius, valid item width, columns and margin");
  }
  const stepRad = 2 * Math.asin(itemWidth / (2 * radius)) + marginRadians;
  const stepDegrees = degrees(stepRad);
  const arcDegrees = columns * stepDegrees;
  if (arcDegrees > 360) {
    throw new RangeError(
      `CylinderPanel: ${columns} columns need ${arcDegrees.toFixed(1)}° (max 360°)`
    );
  }
  return { arcDegrees, stepDegrees };
}

/**
 * @deprecated Backwards-compatible curved-grid adapter to SpatialPanel.
 *
 * All panel geometry, header, close/pin, drag, snap, and scaling now live in
 * @viro-external/ui's SpatialPanel. This component only computes child poses.
 * No second header, material registry, MovableNode or local UI store is made.
 */
export function CylinderPanel({
  radius = defaults.cylinderPanel.radius,
  margin = defaults.cylinderPanel.margin,
  columns = defaults.cylinderPanel.columns,
  rows = defaults.cylinderPanel.rows,
  orientation = defaults.cylinderPanel.orientation as VolumeOrientation,
  itemWidth = defaults.button.widthMeters,
  itemHeight = defaults.button.heightMeters,
  blockLayout,
  title,
  onClose,
  defaultPinned,
  position,
  rotation,
  scale,
  children,
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
}: CylinderPanelProps): React.ReactElement {
  if (!Number.isInteger(rows) || rows <= 0 || !Number.isFinite(itemHeight) ||
      itemHeight <= 0 || !Number.isFinite(margin) || margin < 0) {
    throw new RangeError("CylinderPanel: expected positive rows, item height and nonnegative margin");
  }

  const { arcDegrees, stepDegrees } = deriveCylinderArc({
    radius,
    itemWidth,
    columns,
    marginRadians: margin / radius,
  });

  // The canonical curved panel currently covers at most 120 degrees. Refuse
  // layouts it cannot actually wrap, instead of leaving invisible off-panel
  // controls / a mismatched collision surface.
  if (arcDegrees > 120) {
    throw new RangeError(
      `CylinderPanel: ${arcDegrees.toFixed(1)}° exceeds the 120° unified panel. Increase radius or use fewer columns.`
    );
  }

  const arcRadians = radians(arcDegrees);
  const panelWidth = 2 * radius * Math.sin(arcRadians / 2);
  const panelHeight = rows * itemHeight + Math.max(0, rows - 1) * margin;
  const curvature = Math.max(0.001, arcDegrees / 120);

  const arrange = useCallback((kids: React.ReactNode[]): ArrangedChild[] => {
    const placed: ArrangedChild[] = [];
    for (let i = 0; i < Math.min(kids.length, columns * rows); i += 1) {
      const col = i % columns;
      const row = Math.floor(i / columns);
      const thetaDeg = -arcDegrees / 2 + (col + 0.5) * stepDegrees;
      const theta = radians(thetaDeg);
      const y = ((rows - 1) / 2 - row) * (itemHeight + margin);
      // Match buildCurvedPanelGeometry's visible arc exactly. SpatialPanel
      // already offsets its children 12 mm forward, so no extra Z offset.
      const x = radius * Math.sin(theta);
      const z = radius * (Math.cos(arcRadians / 2) - Math.cos(theta));
      const yaw = orientation === "FACEORIGIN_ORIENTATION"
        ? -thetaDeg
        : orientation === "FACEORIGIN_REVERSED"
          ? -thetaDeg + 180
          : orientation === "FACEFORWARD_REVERSED" ? 180 : 0;
      placed.push({
        child: kids[i],
        position: [x, y, z],
        rotation: [0, yaw, 0],
      });
    }
    return placed;
  }, [arcDegrees, arcRadians, columns, rows, radius, itemHeight, margin, orientation, stepDegrees]);

  return (
    <SpatialPanel
      title={title}
      shape="curved"
      curvature={curvature}
      width={panelWidth}
      height={panelHeight}
      // Old children were at z = -radius * cos(theta). New arc vertices
      // are z = radius * (cos(halfArc) - cos(theta)); shift the entire
      // canonical surface by -radius * cos(halfArc) to preserve that pose.
      // Snapped panels anchor directly to their captured world slot instead.
      surfaceOffset={
        snapTo === undefined && snapOnRelease !== true
          ? [0, 0, -radius * Math.cos(arcRadians / 2)]
          : undefined
      }
      snapTo={snapTo}
      snapOnRelease={snapOnRelease}
      snapDistanceM={snapDistanceM}
      snapOptions={snapOptions}
      worldOrigin={worldOrigin}
      onSnap={onSnap}
      defaultPinned={defaultPinned}
      showCloseAction={onClose !== undefined}
      onClose={onClose}
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
      <MovablePanelContext.Provider value={!!movable}>
        <Container3D blockLayout={blockLayout} arrange={arrange}>
          {children}
        </Container3D>
      </MovablePanelContext.Provider>
    </SpatialPanel>
  );
}
