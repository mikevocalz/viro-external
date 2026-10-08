/**
 * AR coordinate contract (Harlem Might prompt §6A.1): the single input every
 * AR surface consumes. The map layer produces it; AR never geocodes, searches
 * or routes on its own, and reports back only through {@linkcode ArStoreEvent}.
 * Geo-to-local projection happens natively, once per anchor.
 *
 * Proposed in the nitro-mapbox-ar audit (AR_AUDIT.md §9, typechecked there
 * with `--strict --exactOptionalPropertyTypes`).
 */

/** WGS84 longitude/latitude in degrees, GeoJSON order. */
export type LngLat = readonly [longitudeDeg: number, latitudeDeg: number];

/** A WGS84 position. Ellipsoidal height is a separate, explicit variant. */
export type Wgs84Position =
  | { readonly kind: "surface"; readonly lngLat: LngLat }
  | {
      readonly kind: "ellipsoidal";
      readonly lngLat: LngLat;
      /** Metres above the WGS84 ellipsoid (what ARCore Geospatial reports). */
      readonly ellipsoidHeightM: number;
    };

/** Ranked significance; drives trigger radius and conflict resolution. */
export type SignificanceTier = "major" | "notable" | "minor";

/** Where the user is. Each source carries only the fields it really has. */
export type ArOrigin =
  | {
      readonly source: "device-location";
      readonly position: Wgs84Position;
      readonly horizontalAccuracyM: number;
      /** Compass heading, degrees clockwise from true north; absent when the OS has none. */
      readonly headingDeg?: number;
      readonly headingAccuracyDeg?: number;
      readonly timestampMs: number;
    }
  | {
      readonly source: "geospatial-pose";
      readonly position: Extract<Wgs84Position, { kind: "ellipsoidal" }>;
      readonly horizontalAccuracyM: number;
      readonly verticalAccuracyM: number;
      readonly headingDeg: number;
      readonly headingAccuracyDeg: number;
      readonly timestampMs: number;
    };

/** The same place object Place Detail renders, reduced to what AR needs. */
export interface ArSelectedPlace {
  /** Matches the app store's selected place id. */
  readonly placeId: string;
  readonly position: Wgs84Position;
  /** Entrance or public viewpoint when known; anchors prefer it over the centroid. */
  readonly anchorPosition?: Wgs84Position;
  readonly category: string;
  readonly tier: SignificanceTier;
}

/** Kind of a route maneuver. */
export type ManeuverKind =
  | "depart"
  | "turn"
  | "continue"
  | "fork"
  | "roundabout"
  | "arrive";

/** One maneuver on an {@linkcode ArRoute}. */
export interface ArManeuver {
  readonly kind: ManeuverKind;
  readonly position: Wgs84Position;
  /** Bearing after the maneuver, degrees clockwise from true north. */
  readonly bearingAfterDeg: number;
  /** Distance along the route from its start. */
  readonly distanceAlongRouteM: number;
  readonly instruction: string;
}

/** A walking route fetched once by the map layer. */
export interface ArRoute {
  readonly routeId: string;
  readonly geometry: {
    readonly type: "LineString";
    readonly coordinates: readonly LngLat[];
  };
  readonly maneuvers: readonly ArManeuver[];
  readonly distanceM: number;
  readonly durationS: number;
}

/** Media attached to an {@linkcode ArLandmark}. */
export type ArMediaRef =
  | { readonly kind: "image"; readonly uri: string; readonly attribution: string }
  | { readonly kind: "audio-story"; readonly uri: string; readonly durationS: number }
  | {
      readonly kind: "then-and-now";
      readonly thenUri: string;
      readonly nowUri: string;
      readonly attribution: string;
    };

/** A curated landmark on the route corridor. */
export interface ArLandmark {
  readonly placeId: string;
  readonly position: Wgs84Position;
  readonly anchorPosition?: Wgs84Position;
  readonly tier: SignificanceTier;
  /** Distance along the route of the nearest route point; the array is sorted by it. */
  readonly distanceAlongRouteM: number;
  readonly enterRadiusM: number;
  /** Must be greater than enterRadiusM (hysteresis). */
  readonly exitRadiusM: number;
  readonly media: readonly ArMediaRef[];
}

/** Where tabletop content sits. Floor placement is the fallback, not an error. */
export type TabletopPlacement =
  | { readonly kind: "table-anchor"; readonly sceneAnchorId: string }
  | { readonly kind: "floor" };

/** Resolved mode. Each variant carries the facts that made it resolvable. */
export type ArMode =
  | {
      readonly mode: "street";
      /** Phones only. Positioning comes from ARCore Geospatial (iOS and Android). */
      readonly positioning: "geospatial-vps" | "geospatial-gnss-only";
    }
  | {
      readonly mode: "tabletop";
      readonly placement: TabletopPlacement;
      /** Metres of real world per metre of table. */
      readonly worldToTableScale: number;
    }
  | {
      readonly mode: "room";
      readonly wallAnchorIds: readonly string[];
      readonly floorAnchorId: string;
      /** Multiplier applied to landmark radii so street tiers fit the room. */
      readonly radiusScale: number;
    }
  | { readonly mode: "preview" };

/** Requested mode. The resolver returns an {@linkcode ArMode}, possibly degraded. */
export type ArModeRequest = ArMode["mode"];

/**
 * The single input every AR surface consumes. Produced by the map layer.
 * `route` and `landmarks` are absent together when nothing is being walked.
 */
export type ArCoordinateInput = {
  readonly origin: ArOrigin;
  readonly selectedPlace?: ArSelectedPlace;
  readonly mode: ArMode;
} & (
  | { readonly routing: "idle" }
  | {
      readonly routing: "active";
      readonly route: ArRoute;
      readonly landmarks: readonly ArLandmark[];
    }
);

/** Local East-North-Up offset in metres from a stated WGS84 origin. */
export interface EnuOffset {
  readonly frame:
    | { readonly kind: "place"; readonly placeId: string }
    | { readonly kind: "route-start"; readonly routeId: string };
  readonly eastM: number;
  readonly northM: number;
  readonly upM: number;
}

/** What AR writes back. The store reducer handles these; AR never calls Directions. */
export type ArStoreEvent =
  | { readonly type: "landmark-selected"; readonly placeId: string }
  | { readonly type: "moment-opened"; readonly placeId: string; readonly atMs: number }
  | {
      readonly type: "moment-dismissed";
      readonly placeId: string;
      readonly reason: "gaze-away" | "timeout" | "tap";
    }
  | { readonly type: "off-route"; readonly routeId: string; readonly distanceFromRouteM: number }
  | {
      readonly type: "route-progress";
      readonly routeId: string;
      readonly distanceAlongRouteM: number;
      readonly distanceRemainingM: number;
      readonly durationRemainingS: number;
    }
  | {
      readonly type: "mode-degraded";
      readonly requested: ArModeRequest;
      readonly resolved: ArMode["mode"];
      readonly reason: "no-scene-anchors" | "no-table-anchor" | "no-geospatial";
    };
