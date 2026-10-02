export type SpecsSurfaceClassification =
  | "floor"
  | "wall"
  | "ceiling"
  | "table"
  | "seat"
  | "unknown";

export type SpecsWorldQueryRequest = {
  origin: [number, number, number];
  direction: [number, number, number];
  maxDistance?: number;
  classifications?: readonly SpecsSurfaceClassification[];
};

export type SpecsWorldQueryHit = {
  position: [number, number, number];
  normal?: [number, number, number];
  distance: number;
  classification?: SpecsSurfaceClassification;
  confidence?: number;
};

export type SpecsARHitTestResult = {
  position: [number, number, number];
  normal?: [number, number, number];
  distance: number;
  surface: SpecsSurfaceClassification;
  confidence?: number;
};

export function normalizeSpecsWorldQueryHit(
  hit: SpecsWorldQueryHit
): SpecsARHitTestResult {
  if (!Number.isFinite(hit.distance) || hit.distance < 0) {
    throw new Error("Specs world-query hit distance must be finite and non-negative.");
  }

  return {
    position: hit.position,
    ...(hit.normal ? { normal: hit.normal } : {}),
    distance: hit.distance,
    surface: hit.classification ?? "unknown",
    ...(hit.confidence !== undefined
      ? { confidence: hit.confidence }
      : {}),
  };
}

export type SpecsSurfacePlacementMode =
  | "near-surface"
  | "horizontal"
  | "vertical";

export type SpecsPlacementPose = {
  position: [number, number, number];
  rotation: [number, number, number, number];
  surface?: SpecsSurfaceClassification;
};

export interface SpecsWorldRuntime {
  hitTest(
    request: SpecsWorldQueryRequest
  ): Promise<readonly SpecsARHitTestResult[]>;

  startPlacement(
    mode: SpecsSurfacePlacementMode,
    onPose: (pose: SpecsPlacementPose) => void
  ): Promise<() => void> | (() => void);
}

export const SPECS_WORLD_PACKAGES = [
  "WorldQueryHit",
  "SurfacePlacement",
] as const;
