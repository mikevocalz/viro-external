import type { Vec3 } from "@viro-external/core";

export type SpatialWorkspaceSlot = "left" | "center" | "right";
export type WorldSlotOptions = {
  /** Distance from the captured head pose (meters). */
  distanceM?: number;
  /** Angular offset for left/right slots (degrees). */
  sideAngleDeg?: number;
  /** Vertical offset relative to the captured head pose (meters). */
  verticalOffsetM?: number;
};
export type WorldSlotPlacement = {
  position: Vec3;
  rotation: Vec3;
  distanceM: number;
  bearingDeg: number;
};
export type NearestWorldSlot = {
  slot: SpatialWorkspaceSlot;
  placement: WorldSlotPlacement;
  distanceM: number;
};

const SLOTS: readonly SpatialWorkspaceSlot[] = ["left", "center", "right"];
const degToRad = (value: number): number => value * Math.PI / 180;
const radToDeg = (value: number): number => value * 180 / Math.PI;

/** Position a world-fixed slot in a viewer-facing arc around a captured pose. */
export function worldSlot(
  slot: SpatialWorkspaceSlot,
  headPosition: Vec3,
  headYawDeg: number,
  options: WorldSlotOptions = {}
): WorldSlotPlacement {
  const distanceM = options.distanceM ?? 2.6;
  const sideAngleDeg = options.sideAngleDeg ?? 28;
  const verticalOffsetM = options.verticalOffsetM ?? 0;
  if (!Number.isFinite(distanceM) || distanceM <= 0 ||
      !Number.isFinite(sideAngleDeg) || sideAngleDeg < 0 || sideAngleDeg > 90 ||
      !Number.isFinite(verticalOffsetM) || !Number.isFinite(headYawDeg) ||
      headPosition.some((value) => !Number.isFinite(value))) {
    throw new RangeError("worldSlot: expected finite pose, positive distance and side angle in [0, 90]");
  }

  // Viro forward is -Z. The viewer's left is a positive yaw offset.
  const slotOffsetDeg = slot === "left" ? sideAngleDeg :
    slot === "right" ? -sideAngleDeg : 0;
  const bearingDeg = headYawDeg + slotOffsetDeg;
  const bearingRad = degToRad(bearingDeg);
  const position: Vec3 = [
    headPosition[0] - Math.sin(bearingRad) * distanceM,
    headPosition[1] + verticalOffsetM,
    headPosition[2] - Math.cos(bearingRad) * distanceM,
  ];
  // Facing normal +Z points back toward the captured head position.
  const lookYawDeg = radToDeg(Math.atan2(
    headPosition[0] - position[0],
    headPosition[2] - position[2]
  ));
  return { position, rotation: [0, lookYawDeg, 0], distanceM, bearingDeg };
}

/** The nearest slot in 3D space, or null when released outside the threshold. */
export function nearestWorldSlot(
  worldPosition: Vec3,
  headPosition: Vec3,
  headYawDeg: number,
  options: WorldSlotOptions = {},
  maxDistanceM = 0.8
): NearestWorldSlot | null {
  if (!Number.isFinite(maxDistanceM) || maxDistanceM < 0 ||
      worldPosition.some((value) => !Number.isFinite(value))) {
    throw new RangeError("nearestWorldSlot: position and threshold must be finite; threshold >= 0");
  }
  let closest: NearestWorldSlot | null = null;
  for (const slot of SLOTS) {
    const placement = worldSlot(slot, headPosition, headYawDeg, options);
    const distanceM = Math.hypot(
      worldPosition[0] - placement.position[0],
      worldPosition[1] - placement.position[1],
      worldPosition[2] - placement.position[2]
    );
    if (closest === null || distanceM < closest.distanceM) {
      closest = { slot, placement, distanceM };
    }
  }
  return closest && closest.distanceM <= maxDistanceM ? closest : null;
}
