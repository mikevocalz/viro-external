import React from "react";
import { ViroNode } from "@reactvision/react-viro";
import type { Vec3 } from "@viro-external/core";

export type SpatialWorkspaceSlot = "left" | "center" | "right";

export type WorldSlotOptions = {
  /** Comfortable default distance from the settled head pose. */
  distanceM?: number;
  /** Horizontal arc angle between center and each side panel. */
  sideAngleDeg?: number;
  /** Vertical offset relative to the settled head pose. */
  verticalOffsetM?: number;
};

export type WorldSlotPlacement = {
  position: Vec3;
  rotation: Vec3;
  distanceM: number;
  bearingDeg: number;
};

const DEFAULT_DISTANCE_M = 2.6;
const DEFAULT_SIDE_ANGLE_DEG = 28;

function degToRad(value: number): number {
  return (value * Math.PI) / 180;
}

function radToDeg(value: number): number {
  return (value * 180) / Math.PI;
}

/**
 * Resolve LEFT / CENTER / RIGHT onto a comfortable world-space arc around a
 * settled head pose. The returned rotation faces the carrier back toward the
 * head position, so the same transform can own visual content and interaction
 * surfaces without drift.
 */
export function worldSlot(
  slot: SpatialWorkspaceSlot,
  headPosition: Vec3,
  headYawDeg: number,
  options: WorldSlotOptions = {}
): WorldSlotPlacement {
  const distanceM = options.distanceM ?? DEFAULT_DISTANCE_M;
  const sideAngleDeg = options.sideAngleDeg ?? DEFAULT_SIDE_ANGLE_DEG;
  const verticalOffsetM = options.verticalOffsetM ?? 0;

  const slotOffsetDeg =
    slot === "left" ? -sideAngleDeg : slot === "right" ? sideAngleDeg : 0;
  const bearingDeg = headYawDeg + slotOffsetDeg;
  const bearingRad = degToRad(bearingDeg);

  const position: Vec3 = [
    headPosition[0] + Math.sin(bearingRad) * distanceM,
    headPosition[1] + verticalOffsetM,
    headPosition[2] - Math.cos(bearingRad) * distanceM,
  ];

  // Viro panels at zero rotation face +Z. Aim that front normal at the
  // settled head position rather than assuming a particular slot angle.
  const lookYawDeg = radToDeg(
    Math.atan2(
      headPosition[0] - position[0],
      headPosition[2] - position[2]
    )
  );

  return {
    position,
    rotation: [0, lookYawDeg, 0],
    distanceM,
    bearingDeg,
  };
}

export type SpatialWorkspaceSlotNodeProps = {
  slot: SpatialWorkspaceSlot;
  headPosition: Vec3;
  headYawDeg: number;
  options?: WorldSlotOptions;
  children?: React.ReactNode;
};

/**
 * One carrier transform for a spatial slot.
 *
 * Put the panel, pointer surface, toolbar/chrome, and drag affordances under
 * this node so visual and interaction planes always move together.
 */
export function SpatialWorkspaceSlotNode({
  slot,
  headPosition,
  headYawDeg,
  options,
  children,
}: SpatialWorkspaceSlotNodeProps): React.ReactElement {
  const placement = worldSlot(slot, headPosition, headYawDeg, options);

  return (
    <ViroNode position={placement.position} rotation={placement.rotation}>
      {children}
    </ViroNode>
  );
}
