import React, { createContext, useContext, useRef } from "react";
import { ViroNode } from "@reactvision/react-viro";
import type { Vec3 } from "@viro-external/core";
import { worldSlot } from "./world-slot";
import type { SpatialWorkspaceSlot, WorldSlotOptions } from "./world-slot";

export { worldSlot, nearestWorldSlot } from "./world-slot";
export type {
  SpatialWorkspaceSlot, WorldSlotOptions, WorldSlotPlacement, NearestWorldSlot,
} from "./world-slot";

/** Capture this pose once; changing head tracking does not drag the workspace. */
export type SpatialWorkspaceOrigin = {
  readonly headPosition: Vec3;
  readonly headYawDeg: number;
};

const OriginContext = createContext<SpatialWorkspaceOrigin | null>(null);

/**
 * World-locked workspace reference. To deliberately recenter, remount the
 * frame with a new React key and a new settled pose.
 */
export function SpatialWorkspaceFrame({
  headPosition, headYawDeg, children,
}: SpatialWorkspaceOrigin & { children?: React.ReactNode }): React.ReactElement {
  const originRef = useRef<SpatialWorkspaceOrigin | null>(null);
  if (originRef.current === null) {
    originRef.current = {
      headPosition: [...headPosition] as Vec3,
      headYawDeg,
    };
  }
  return (
    <OriginContext.Provider value={originRef.current}>
      {children}
    </OriginContext.Provider>
  );
}

export function useSpatialWorkspaceOrigin(): SpatialWorkspaceOrigin | null {
  return useContext(OriginContext);
}

export type SpatialWorkspaceSlotNodeProps = {
  slot: SpatialWorkspaceSlot;
  headPosition: Vec3;
  headYawDeg: number;
  options?: WorldSlotOptions;
  children?: React.ReactNode;
};

/**
 * Existing low-level carrier. For drag-to-snap panels instead use
 * SpatialWorkspaceFrame + SpatialPanel.snapTo to avoid nested transforms.
 */
export function SpatialWorkspaceSlotNode({
  slot, headPosition, headYawDeg, options, children,
}: SpatialWorkspaceSlotNodeProps): React.ReactElement {
  const placement = worldSlot(slot, headPosition, headYawDeg, options);
  return (
    <ViroNode position={placement.position} rotation={placement.rotation}>
      {children}
    </ViroNode>
  );
}
