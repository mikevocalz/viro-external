import type { SpecsUpstreamPackageName } from "./upstream.js";

export type SpecsGeoCoordinate = {
  latitude: number;
  longitude: number;
  altitudeMeters?: number;
};

export type SpecsNavigationPlace = {
  id: string;
  name?: string;
  coordinate: SpecsGeoCoordinate;
};

export type SpecsNavigationRoute = {
  id: string;
  points: readonly SpecsGeoCoordinate[];
  destination?: SpecsNavigationPlace;
};

export type SpecsRouteLineStyle = {
  widthMeters: number;
  verticalOffsetMeters?: number;
  materialId?: string;
};

export type SpecsNavigationPlan = {
  route: SpecsNavigationRoute;
  line: SpecsRouteLineStyle;
  packages: readonly [
    Extract<SpecsUpstreamPackageName, "SpecsNavigationKit">,
    Extract<SpecsUpstreamPackageName, "VolumetricLine">,
  ];
};

function assertCoordinate(point: SpecsGeoCoordinate, index: number): void {
  if (
    !Number.isFinite(point.latitude) ||
    point.latitude < -90 ||
    point.latitude > 90
  ) {
    throw new Error(`Route point ${index} has an invalid latitude.`);
  }

  if (
    !Number.isFinite(point.longitude) ||
    point.longitude < -180 ||
    point.longitude > 180
  ) {
    throw new Error(`Route point ${index} has an invalid longitude.`);
  }

  if (
    point.altitudeMeters !== undefined &&
    !Number.isFinite(point.altitudeMeters)
  ) {
    throw new Error(`Route point ${index} has an invalid altitude.`);
  }
}

/**
 * Produces the Specs-side plan used by map/navigation integrations.
 *
 * Mapbox or another routing provider stays outside the renderer. Its route
 * geometry is normalized here and consumed by SpecsNavigationKit for location
 * semantics plus VolumetricLine for the world-space route visualization.
 */
export function compileSpecsNavigationPlan(
  route: SpecsNavigationRoute,
  line: SpecsRouteLineStyle = { widthMeters: 0.04 }
): SpecsNavigationPlan {
  if (route.points.length < 2) {
    throw new Error("Specs navigation routes require at least two points.");
  }

  route.points.forEach(assertCoordinate);

  if (!Number.isFinite(line.widthMeters) || line.widthMeters <= 0) {
    throw new Error("Specs route line width must be a positive finite number.");
  }

  if (
    line.verticalOffsetMeters !== undefined &&
    !Number.isFinite(line.verticalOffsetMeters)
  ) {
    throw new Error("Specs route vertical offset must be finite.");
  }

  return {
    route,
    line,
    packages: ["SpecsNavigationKit", "VolumetricLine"],
  };
}

export type SpecsWorldPolyline = {
  points: readonly [number, number, number][];
  widthMeters: number;
  materialId?: string;
};

export type SpecsVolumetricLinePlan = {
  primitive: "volumetric-line";
  backendPackage: Extract<SpecsUpstreamPackageName, "VolumetricLine">;
  points: readonly [number, number, number][];
  radiusMeters: number;
  materialId?: string;
};

/**
 * ViroPolyline-like local/world path compiler for Specs.
 */
export function compileSpecsPolyline(
  polyline: SpecsWorldPolyline
): SpecsVolumetricLinePlan {
  if (polyline.points.length < 2) {
    throw new Error("Specs polyline requires at least two points.");
  }

  if (!Number.isFinite(polyline.widthMeters) || polyline.widthMeters <= 0) {
    throw new Error("Specs polyline width must be a positive finite number.");
  }

  for (const [index, point] of polyline.points.entries()) {
    if (point.some((value) => !Number.isFinite(value))) {
      throw new Error(`Specs polyline point ${index} must be finite.`);
    }
  }

  return {
    primitive: "volumetric-line",
    backendPackage: "VolumetricLine",
    points: polyline.points,
    radiusMeters: polyline.widthMeters / 2,
    ...(polyline.materialId ? { materialId: polyline.materialId } : {}),
  };
}

export interface SpecsNavigationRuntime {
  presentRoute(plan: SpecsNavigationPlan): Promise<void> | void;
  presentPolyline?(plan: SpecsVolumetricLinePlan): Promise<void> | void;
  clearRoute?(): Promise<void> | void;
}
