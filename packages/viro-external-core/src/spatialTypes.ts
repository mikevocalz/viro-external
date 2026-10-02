export type Vec3 = [number, number, number];
export type AxisLock = "x" | "y" | "z";

export type ViroDragType =
  | "FixedDistance"
  | "FixedDistanceOrigin"
  | "FixedToWorld"
  | "FixedToPlane";

export type ViroDragPlane = {
  planePoint: Vec3;
  planeNormal: Vec3;
  maxDistance: number;
};

export interface MovableProps {
  movable?: boolean;
  tag?: string;
  dragType?: ViroDragType;
  dragPlane?: ViroDragPlane;
  axisLock?: AxisLock[];
  onMoveStart?: () => void;
  onMove?: (worldPos: Vec3) => void;
  onMoveEnd?: (worldPos: Vec3) => void;
  pinchToScale?: boolean;
}

/**
 * Provider-neutral external texture metadata.
 *
 * Registration is intentionally not owned by this package anymore. Future
 * direct ViroCore/Eskiu texture import can preserve this public shape without
 * forcing consumers through Nitro.
 */
export interface ExternalTextureHandle {
  readonly id: number;
  readonly kind:
    | "iosurface"
    | "gl-2d"
    | "gl-external-oes"
    | "surface-producer"
    | "viro-native";
  readonly width: number;
  readonly height: number;
  readonly colorSpace: "srgb" | "linear";
  readonly nativeToken?: number;
}
