// API snapshot for @viro-external/xr-contract.
// Regenerate with: node scripts/ci/api-snapshot.mjs --update

// ---- arCoordinates.d.ts
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
export type Wgs84Position = {
    readonly kind: "surface";
    readonly lngLat: LngLat;
} | {
    readonly kind: "ellipsoidal";
    readonly lngLat: LngLat;
    /** Metres above the WGS84 ellipsoid (what ARCore Geospatial reports). */
    readonly ellipsoidHeightM: number;
};
/** Ranked significance; drives trigger radius and conflict resolution. */
export type SignificanceTier = "major" | "notable" | "minor";
/** Where the user is. Each source carries only the fields it really has. */
export type ArOrigin = {
    readonly source: "device-location";
    readonly position: Wgs84Position;
    readonly horizontalAccuracyM: number;
    /** Compass heading, degrees clockwise from true north; absent when the OS has none. */
    readonly headingDeg?: number;
    readonly headingAccuracyDeg?: number;
    readonly timestampMs: number;
} | {
    readonly source: "geospatial-pose";
    readonly position: Extract<Wgs84Position, {
        kind: "ellipsoidal";
    }>;
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
export type ManeuverKind = "depart" | "turn" | "continue" | "fork" | "roundabout" | "arrive";
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
export type ArMediaRef = {
    readonly kind: "image";
    readonly uri: string;
    readonly attribution: string;
} | {
    readonly kind: "audio-story";
    readonly uri: string;
    readonly durationS: number;
} | {
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
export type TabletopPlacement = {
    readonly kind: "table-anchor";
    readonly sceneAnchorId: string;
} | {
    readonly kind: "floor";
};
/** Resolved mode. Each variant carries the facts that made it resolvable. */
export type ArMode = {
    readonly mode: "street";
    /** Phones only. Positioning comes from ARCore Geospatial (iOS and Android). */
    readonly positioning: "geospatial-vps" | "geospatial-gnss-only";
} | {
    readonly mode: "tabletop";
    readonly placement: TabletopPlacement;
    /** Metres of real world per metre of table. */
    readonly worldToTableScale: number;
} | {
    readonly mode: "room";
    readonly wallAnchorIds: readonly string[];
    readonly floorAnchorId: string;
    /** Multiplier applied to landmark radii so street tiers fit the room. */
    readonly radiusScale: number;
} | {
    readonly mode: "preview";
};
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
} & ({
    readonly routing: "idle";
} | {
    readonly routing: "active";
    readonly route: ArRoute;
    readonly landmarks: readonly ArLandmark[];
});
/** Local East-North-Up offset in metres from a stated WGS84 origin. */
export interface EnuOffset {
    readonly frame: {
        readonly kind: "place";
        readonly placeId: string;
    } | {
        readonly kind: "route-start";
        readonly routeId: string;
    };
    readonly eastM: number;
    readonly northM: number;
    readonly upM: number;
}
/** What AR writes back. The store reducer handles these; AR never calls Directions. */
export type ArStoreEvent = {
    readonly type: "landmark-selected";
    readonly placeId: string;
} | {
    readonly type: "moment-opened";
    readonly placeId: string;
    readonly atMs: number;
} | {
    readonly type: "moment-dismissed";
    readonly placeId: string;
    readonly reason: "gaze-away" | "timeout" | "tap";
} | {
    readonly type: "off-route";
    readonly routeId: string;
    readonly distanceFromRouteM: number;
} | {
    readonly type: "route-progress";
    readonly routeId: string;
    readonly distanceAlongRouteM: number;
    readonly distanceRemainingM: number;
    readonly durationRemainingS: number;
} | {
    readonly type: "mode-degraded";
    readonly requested: ArModeRequest;
    readonly resolved: ArMode["mode"];
    readonly reason: "no-scene-anchors" | "no-table-anchor" | "no-geospatial";
};

// ---- esiku.d.ts
export type EsikuBackendFamily = "openxr" | "android-xr" | "viture-native" | "rayneo-native" | "visionos" | "wearable";
export type EsikuTarget = "android-xr" | "xreal-aura" | "rayneo" | "viture" | "vive-eagle" | "steam-frame" | "quest" | "vision-pro" | "unknown";
export type EsikuCapability = "stereo-display" | "head-pose" | "pose-6dof" | "hand-tracking" | "eye-gaze" | "passthrough" | "camera" | "depth" | "planes" | "scene-understanding" | "world-anchors" | "controller" | "touch" | "gesture" | "haptics" | "spatial-audio" | "microphone" | "voice-input" | "voice-output" | "wearable-display" | "device-control";
export type EsikuCapabilityState = "supported" | "unsupported" | "permission-required" | "temporarily-unavailable" | "unverified";
export type EsikuCapabilityReport = Partial<Record<EsikuCapability, EsikuCapabilityState>>;
export interface EsikuDeviceProfile {
    target: EsikuTarget;
    backend: EsikuBackendFamily;
    runtime?: string;
    model?: string;
    capabilities: EsikuCapabilityReport;
}
export interface EsikuPose {
    position: [number, number, number];
    rotation: [number, number, number, number];
    timestampNs: number;
}
export interface EsikuInputEvent {
    source: "gaze" | "hand" | "controller" | "touch" | "gesture" | "voice";
    phase: "hover-enter" | "hover-move" | "hover-exit" | "select-start" | "select-end" | "drag" | "cancel";
    targetId?: string;
    position?: [number, number, number];
    direction?: [number, number, number];
    timestampNs: number;
}
export interface EsikuFrame {
    pose?: EsikuPose;
    inputs: readonly EsikuInputEvent[];
}
export interface EsikuRuntimeAdapter {
    readonly backend: EsikuBackendFamily;
    negotiate(): Promise<EsikuDeviceProfile> | EsikuDeviceProfile;
    beginSession?(): Promise<void> | void;
    pollFrame?(): Promise<EsikuFrame> | EsikuFrame;
    endSession?(): Promise<void> | void;
}
/**
 * Resolve the native lane from negotiated runtime facts.
 *
 * Device/model strings are diagnostic. Feature gating belongs to the
 * capability report so new Android XR hardware can share one OpenXR path.
 */
export declare function selectEsikuBackend(profile: Pick<EsikuDeviceProfile, "target" | "capabilities">): EsikuBackendFamily;

// ---- index.d.ts
export type XRPlatformFamily = "viro-openxr" | "viro-visionos" | "web" | "viro-web" | "webspatial" | "meta-horizon-layout" | "pico-spatial" | "meta-wearables" | "snap-specs" | "viture-native" | "unknown";
export type XRCapabilityState = "supported" | "unsupported" | "permission-required" | "temporarily-unavailable" | "unverified";
export type XRCapabilityName = "immersive-rendering" | "system-window" | "spatial-layout" | "multi-window" | "spatial-priority" | "spatial-fallback" | "spatial-volume" | "spatial-stage" | "spatial-web" | "responsive-web" | "pwa" | "browser-3d" | "webxr" | "eye-gaze" | "gaze-targeting" | "hand-tracking" | "pinch" | "controller" | "passthrough" | "camera" | "microphone" | "audio-output" | "display" | "motion" | "anchors" | "planes" | "scene-understanding" | "world-query" | "surface-placement" | "drag-manipulation" | "depth" | "location-navigation" | "volumetric-line" | "runtime-inspection" | "synthetic-interaction" | "local-floor";
export type XRCapabilityReport = Partial<Record<XRCapabilityName, XRCapabilityState>>;
export type SpatialPresentation = "inline" | "system-window" | "system-subwindow" | "spatial-augment" | "spatial-volume" | "spatial-stage" | "spatial-web-element" | "responsive-web" | "webxr-immersive" | "immersive-scene" | "wearable-display";
export type SpatialSurfaceRole = "master" | "content" | "inspector" | "accessory" | "popup" | "volume" | "immersive";
export type SpatialPriorityTier = "permanent" | "primary" | "popup" | "secondary" | "ephemeral";
export type SpatialSurfacePlacement = "start" | "center" | "end" | "top" | "bottom" | "user";
export type SpatialSurfaceFallback = "inline" | "drop";
export type SpatialSurfaceIntent = {
    id: string;
    preferredPresentation: SpatialPresentation;
    fallback: SpatialSurfaceFallback;
    role?: SpatialSurfaceRole;
    priority?: number | SpatialPriorityTier;
    preferredSize?: {
        width: number;
        height: number;
        depth?: number;
    };
    placement?: SpatialSurfacePlacement;
    promotable?: boolean;
    movable?: boolean;
    resizable?: boolean;
    opaqueRoot?: boolean;
};
export type SpatialWorkspaceIntent = {
    id: string;
    surfaces: readonly SpatialSurfaceIntent[];
    maxPromotedSurfaces?: number;
};
export type SpatialPlacementState = "spatial" | "pending" | "inline" | "dropped" | "unavailable";
export type SpatialResolvedSurface = SpatialSurfaceIntent & {
    priorityValue: number;
};
export declare function spatialPriorityValue(priority: SpatialSurfaceIntent["priority"]): number;
export declare function resolveSpatialWorkspace(workspace: SpatialWorkspaceIntent): SpatialResolvedSurface[];
export type PortableXRNodeKind = "group" | "text" | "image" | "model" | "panel";
/** Text appearance. size is in Lens/renderer points; color is linear RGBA in 0..1. */
export interface PortableXRTextStyle {
    size?: number;
    color?: [number, number, number, number];
}
/**
 * Vertical scroll window on a group node, in metres. width and height are the
 * visible window; contentHeight is the full height of the content. Children of
 * the group use content coordinates: x = 0 is the window's centre line and
 * y = 0 is the top edge of the content, with y negative going down.
 */
export interface PortableXRScroll {
    width: number;
    height: number;
    contentHeight: number;
}
export interface PortableXRNode {
    id: string;
    kind: PortableXRNodeKind;
    parentId?: string;
    position?: [number, number, number];
    rotation?: [number, number, number, number];
    scale?: [number, number, number];
    source?: string;
    text?: string;
    textStyle?: PortableXRTextStyle;
    scroll?: PortableXRScroll;
    visible?: boolean;
}
export type XRInteractionSource = "gaze" | "hand" | "pinch" | "controller" | "voice" | "touch" | "neural-band";
export type XRInteractionPhase = "hover-enter" | "hover-move" | "hover-exit" | "select-start" | "select-end" | "drag" | "cancel";
export interface PortableXRInteraction {
    source: XRInteractionSource;
    phase: XRInteractionPhase;
    targetId?: string;
    position?: [number, number, number];
    direction?: [number, number, number];
    timestampMs?: number;
}
export interface XRPlatformAdapter {
    readonly family: XRPlatformFamily;
    getCapabilities(): Promise<XRCapabilityReport> | XRCapabilityReport;
    presentSurface?(intent: SpatialSurfaceIntent): Promise<void> | void;
    updatePortableScene?(nodes: readonly PortableXRNode[]): Promise<void> | void;
    dispose(): Promise<void> | void;
}
export * from "./ui";
export * from "./interaction";
export * from "./rive";
export * from "./quickdraw";
export * from "./quickdrawIdentity";
export * from "./muse";
export * from "./esiku";
export * from "./workspaceSurface";
export * from "./arCoordinates";

// ---- interaction.d.ts
/** Vendor-neutral XR interaction semantics shared by Viro, Specs/ESIK and Meta Display. */
export type XRUIInputSource = "touch" | "gaze" | "pinch" | "dpad" | "controller" | "hand" | "voice" | "keyboard" | "neural-band";
export type XRUIInteractionPhase = "hover-enter" | "hover-move" | "hover-exit" | "focus-enter" | "focus-exit" | "select-start" | "select-end" | "press" | "long-press" | "drag-start" | "drag" | "drag-end" | "scroll" | "swipe" | "grab" | "release" | "cancel";
export type XRUIInteractionEvent = {
    source: XRUIInputSource;
    phase: XRUIInteractionPhase;
    targetId?: string;
    position?: [number, number, number];
    direction?: [number, number, number];
    delta?: [number, number];
    value?: number;
    timestampMs?: number;
};
export type XRUIInteractionCapabilities = {
    sources: readonly XRUIInputSource[];
    phases: readonly XRUIInteractionPhase[];
    focus: boolean;
    hover: boolean;
    manipulation: boolean;
    scroll: boolean;
};
export interface XRUIInteractionAdapter {
    readonly id: string;
    getCapabilities(): XRUIInteractionCapabilities;
    subscribe(listener: (event: XRUIInteractionEvent) => void): () => void;
    setInteractable?(targetId: string, enabled: boolean): Promise<void> | void;
    setManipulationEnabled?(targetId: string, enabled: boolean): Promise<void> | void;
    dispose(): Promise<void> | void;
}
export type XRUIActivationPolicy = "select" | "press" | "pinch" | "dpad-confirm";
export type XRUIComponentInteraction = {
    activation?: XRUIActivationPolicy;
    preferredSource?: XRUIInputSource;
    focusable?: boolean;
    hoverable?: boolean;
    draggable?: boolean;
    scrollable?: boolean;
};

// ---- muse.d.ts
export type MusePenPhase = "hover" | "down" | "move" | "up" | "cancel";
export type MusePenSample = {
    tracked: boolean;
    phase: MusePenPhase;
    position: readonly [number, number, number] | null;
    headPosition: readonly [number, number, number] | null;
    tipPressed: boolean;
    primaryPressed: boolean;
    secondaryPressed: boolean;
    /** Pressure as the stylus stream reports it. Passed through, never synthesized. */
    pressure: number;
    /** @deprecated Wall-clock milliseconds (`Date.now()`); can jump. Use `timestampMs`. */
    timestamp: number;
    /** Milliseconds on a monotonic clock (`performance.now()`), the clock board pointer events use. */
    timestampMs?: number;
};
export type MusePenInputProps = {
    enabled?: boolean;
    onSample: (sample: MusePenSample) => void;
};
/**
 * Platform-neutral contract for the Logitech Muse stream exposed by
 * @reactvision/react-viro on visionOS.
 *
 * The Viro native layer owns GameController/AccessoryTrackingProvider.
 * This package only translates that stream into QuickDraw-friendly phases.
 */
export type MusePenInputHandle = {
    dispose(): void;
};

// ---- quickdraw.d.ts
/** Native QuickDraw spatial rendering contract. */
import type { QuickDrawSurfaceIdentity } from "./quickdrawIdentity";
/**
 * Device class of a pointer on a QuickDraw board.
 *
 * @see {@linkcode QuickDrawPointerEvent.source}
 */
export type QuickDrawPointerSource = "pointer" | "gaze" | "pinch" | "touch" | "controller" | "hand" | "dpad" | "keyboard" | "pen";
/**
 * Phase of a {@linkcode QuickDrawPointerEvent}.
 *
 * - `hover`: the pointer is over the board and not pressed.
 * - `down`: a press started on the board; the pointer is captured until `up` or `cancel`.
 * - `move`: a captured pointer moved. Positions outside the paper are clamped to its edge.
 * - `up`: the captured press ended normally. A stroke commits.
 * - `cancel`: the captured press was abandoned (tracking or focus loss, disconnect,
 *   app background, unmount, ownership change, board moved). A stroke is discarded.
 * - `leave`: a hovering pointer left the board.
 */
export type QuickDrawPointerEventPhase = "hover" | "down" | "move" | "up" | "cancel" | "leave";
/**
 * One pointer event on a QuickDraw board, after the scene hit has been mapped
 * onto the paper. This is the single pointer type every input path produces:
 * Viro controller and hand rays, the Muse pen, and adapter dispatch.
 *
 * @see {@linkcode QuickDrawSpatialSurfaceHandle.dispatchPointer}
 */
export interface QuickDrawPointerEvent {
    phase: QuickDrawPointerEventPhase;
    /** Stable id for one input device for the lifetime of the input router. Safe integer. */
    pointerId: number;
    source: QuickDrawPointerSource;
    /**
     * Position on the paper, normalized: `[0, 0]` is the top-left corner of the
     * paper and `[1, 1]` the bottom-right. Within `[0, 1]` except for `hover`,
     * which is only emitted inside the paper.
     */
    uv: readonly [number, number];
    /**
     * Milliseconds on a monotonic clock (`performance.now()` in React Native).
     * Never decreases for one `pointerId`.
     */
    timestampMs: number;
    /**
     * Normalized pressure in `[0, 1]` when the device reports one. `undefined`
     * means the device reports no pressure; `0` is a real reading.
     */
    pressure?: number;
}
/**
 * @deprecated Use {@linkcode QuickDrawPointerEventPhase}. `enter` maps to
 * `hover` and `exit` to `leave`.
 */
export type QuickDrawPointerPhase = "enter" | "move" | "down" | "up" | "cancel" | "exit";
/**
 * @deprecated Use {@linkcode QuickDrawPointerEvent}, which adds `pointerId`
 * and names its clock (`timestampMs`). Kept so existing adapters that read
 * this shape keep compiling; {@linkcode toQuickDrawSpatialPointer} converts.
 */
export type QuickDrawSpatialPointer = {
    phase: QuickDrawPointerPhase;
    source: QuickDrawPointerSource;
    /** Normalized board coordinates, 0..1 from top-left. */
    uv: readonly [number, number];
    timestamp: number;
    pressure?: number;
};
/**
 * Converts a {@linkcode QuickDrawPointerEvent} to the deprecated
 * {@linkcode QuickDrawSpatialPointer} shape for adapters that still read it.
 * `hover` maps to `move` (the old shape has no hover phase; `enter` is never
 * produced) and `leave` to `exit`. `pointerId` is dropped.
 */
export declare function toQuickDrawSpatialPointer(event: QuickDrawPointerEvent): QuickDrawSpatialPointer;
export type QuickDrawSpatialDrag = {
    enabled: boolean;
    activationDistance?: number;
    maxDistance?: number;
};
export type QuickDrawSpatialSurfaceConfig = {
    width: number;
    height: number;
    pageWidth: number;
    pageHeight: number;
    interactive?: boolean;
    drag?: QuickDrawSpatialDrag;
};
type QuickDrawSpatialAdapterMethods = {
    mount(config: QuickDrawSpatialSurfaceConfig): QuickDrawSpatialSurfaceHandle;
    unmount(handle: QuickDrawSpatialSurfaceHandle): void;
};
/**
 * Native adapter boundary for the QuickDraw runtime.
 *
 * QuickDraw's `Store` is the editor authority. The adapter states which host
 * draws the board, with which backend, and who owns the texture, through
 * {@linkcode QuickDrawSurfaceIdentity}. Resolve it with
 * `resolveQuickDrawSurfaceIdentity`, which rejects contradictory declarations.
 *
 * Migration: adapters that declared only `renderer: "esiku"` keep working and
 * resolve to the ESIKU identity. An adapter whose host is not ESIKU must
 * declare `identity` and drop `renderer`.
 */
export type NativeQuickDrawSpatialAdapter = QuickDrawSpatialAdapterMethods & ({
    /** Who draws the board and who owns its texture. */
    readonly identity: QuickDrawSurfaceIdentity;
    /**
     * @deprecated Declare {@linkcode QuickDrawSurfaceIdentity} in `identity`.
     * Only accepted alongside an identity whose host is `esiku`.
     */
    readonly renderer?: "esiku";
} | {
    /**
     * @deprecated Declare `identity` instead. Means: an ESIKU host draws the
     * board into an ESIKU-owned external render target.
     */
    readonly renderer: "esiku";
    readonly identity?: undefined;
});
export type QuickDrawSpatialSurfaceHandle = {
    /** Viro material name bound to the live external render target. */
    materialName: string;
    /**
     * Delivers one pointer event in the deprecated shape. `QuickDrawSpatialSurface`
     * calls it for every event its input router produces, converted with
     * {@linkcode toQuickDrawSpatialPointer}.
     */
    dispatchPointer(event: QuickDrawSpatialPointer): void;
    /**
     * Delivers one pointer event. Preferred over `dispatchPointer` when present:
     * it carries `pointerId`, so a cancel on one device does not end another's stroke.
     */
    dispatchPointerEvent?(event: QuickDrawPointerEvent): void;
    setTool(tool: string): void;
    setStyle(key: string, value: string | number | boolean): void;
    undo(): void;
    redo(): void;
    clear(): void;
    getSnapshot(): unknown;
    loadSnapshot(snapshot: unknown): void;
    exportPng(): Promise<string | null>;
    dispose(): void;
};
export {};

// ---- quickdrawIdentity.d.ts
import type { NativeQuickDrawSpatialAdapter } from "./quickdraw";
/**
 * The process that hosts the board's drawing code.
 *
 * - `esiku`: an ESIKU-compiled host renders into an ESIKU external render target.
 * - `viro-native`: native code in this app draws into a Surface Viro owns
 *   (`@viro-external/native-panels`, ADR 0001 D2).
 * - `webview`: the board runs as HTML in a WebView whose view is re-parented
 *   into a Viro texture.
 *
 * @see {@linkcode QuickDrawSurfaceIdentity.host}
 */
export type QuickDrawSurfaceHost = "esiku" | "viro-native" | "webview";
/**
 * The library and graphics path that rasterizes board content.
 *
 * - `esiku`: ESIKU's renderer.
 * - `android-hwui-canvas`: `android.graphics.Canvas` from `Surface.lockHardwareCanvas()`,
 *   GPU-rendered by HWUI.
 * - `webview-canvas2d`: QuickDraw's own Canvas2D drawing inside the WebView.
 *
 * @see {@linkcode QuickDrawSurfaceIdentity.backend}
 */
export type QuickDrawDrawingBackend = "esiku" | "android-hwui-canvas" | "webview-canvas2d";
/**
 * Who allocates and owns the GPU texture Viro samples.
 *
 * - `esiku`: an ESIKU external render target.
 * - `viro-canvas-surface`: the Surface Viro's `canvasSource` material creates
 *   and hands out through its `CanvasSurfaces` registry.
 * - `viro-android-view-texture`: `com.viro.core.AndroidViewTexture` wrapping an Android view.
 *
 * @see {@linkcode QuickDrawSurfaceIdentity.textureOwner}
 */
export type QuickDrawTextureOwner = "esiku" | "viro-canvas-surface" | "viro-android-view-texture";
/**
 * What draws a QuickDraw board and who owns what, stated separately so no
 * host can borrow another's name.
 *
 * The editor authority is always QuickDraw's `Store`: records, transactions,
 * undo and remote diffs. Hosts and backends only draw a derived copy.
 *
 * @see {@linkcode NativeQuickDrawSpatialAdapter}
 * @see {@linkcode resolveQuickDrawSurfaceIdentity}
 */
export interface QuickDrawSurfaceIdentity {
    /** The document and history authority. */
    readonly editorAuthority: "quickdraw-store";
    readonly host: QuickDrawSurfaceHost;
    readonly backend: QuickDrawDrawingBackend;
    readonly textureOwner: QuickDrawTextureOwner;
}
/** The identity the deprecated `renderer: "esiku"` declaration stands for. */
export declare const ESIKU_QUICKDRAW_IDENTITY: QuickDrawSurfaceIdentity;
/** Identity of the WebView board MoyoLearn ships today (HTML in `react-native-webview`, re-parented into `AndroidViewTexture`). */
export declare const WEBVIEW_QUICKDRAW_IDENTITY: QuickDrawSurfaceIdentity;
/** Identity of the native board in `@viro-external/native-panels` on Android. */
export declare const VIRO_NATIVE_QUICKDRAW_IDENTITY: QuickDrawSurfaceIdentity;
/**
 * Returns the adapter's {@linkcode QuickDrawSurfaceIdentity}.
 *
 * An adapter with only the deprecated `renderer: "esiku"` resolves to
 * {@linkcode ESIKU_QUICKDRAW_IDENTITY}.
 *
 * @throws TypeError when the adapter declares neither field, or a field holds
 *   a value this contract does not define.
 * @throws RangeError when `renderer: "esiku"` is combined with an identity
 *   whose host, backend or texture owner is not ESIKU. Remove `renderer`.
 */
export declare function resolveQuickDrawSurfaceIdentity(adapter: Pick<NativeQuickDrawSpatialAdapter, "identity" | "renderer">): QuickDrawSurfaceIdentity;

// ---- rive.d.ts
/** Native Rive spatial rendering contract. */
export type RiveSource = {
    kind: "url";
    uri: string;
} | {
    kind: "asset";
    asset: number | string;
};
export type RiveFit = "contain" | "cover" | "fill" | "fitWidth" | "fitHeight";
export type RiveSpatialDepthMode = "surface" | "extruded" | "occluding" | "embedded";
export type RiveDragAxis = "free" | "horizontal" | "vertical";
export type RiveDragConfig = {
    enabled: boolean;
    axis?: RiveDragAxis;
    /** Maximum displacement from the panel anchor, in Viro world units. */
    maxDistance?: number;
    /** Minimum movement before drag starts, in Viro world units. */
    activationDistance?: number;
    /** If true, the panel follows the active ESIK pointer while pressed. */
    followPointer?: boolean;
};
export type RiveInputKind = "pointer" | "gaze" | "pinch" | "touch" | "controller" | "dpad" | "hand" | "voice" | "keyboard" | "neural-band";
export type RivePointerPhase = "enter" | "move" | "down" | "up" | "cancel" | "exit";
export type RiveSpatialPointer = {
    phase: RivePointerPhase;
    source: RiveInputKind;
    /** Normalized artboard coordinates, 0..1. */
    uv: readonly [number, number];
    worldPosition?: readonly [number, number, number];
    timestamp: number;
};
export type RiveSpatialSurfaceConfig = {
    source: RiveSource;
    artboard?: string;
    stateMachine?: string;
    /**
     * Preferred fit. Not every host supports every RiveFit — check
     * RiveSpatialSurfaceCapabilities.supportedFits after mount. A host that
     * cannot honor the requested fit must not silently render the wrong one;
     * it should map to the closest supported fit and say so in supportedFits.
     * The Viro/nitro pipeline currently implements contain | cover | fill.
     */
    fit?: RiveFit;
    depthMode?: RiveSpatialDepthMode;
    width: number;
    height: number;
    depth?: number;
    interactive?: boolean;
    /** Rive panels are draggable by default when interactive. */
    drag?: RiveDragConfig;
};
export type RiveSpatialSurfaceCapabilities = {
    nativeRenderer: true;
    stateMachines: boolean;
    dataBinding: boolean;
    pointerInput: boolean;
    externalRenderTarget: boolean;
    depthComposition: boolean;
    /**
     * Fit modes the host actually renders. Absent means the host accepts the
     * full RiveFit set; hosts must populate this when they support a subset.
     */
    supportedFits?: readonly RiveFit[];
};
export declare const DEFAULT_RIVE_DRAG: RiveDragConfig;
export type RiveSpatialSurfaceHandle = {
    play(): void;
    pause(): void;
    reset(): void;
    setStateMachineInput(name: string, value: boolean | number | string): void;
    dispatchPointer(event: RiveSpatialPointer): void;
    beginDrag(pointer: RiveSpatialPointer): void;
    updateDrag(pointer: RiveSpatialPointer): void;
    endDrag(pointer: RiveSpatialPointer): void;
    cancelDrag(): void;
    getCapabilities(): RiveSpatialSurfaceCapabilities;
};
/** Native adapter between Viro scene/input and the Rive runtime. */
export type NativeRiveSpatialAdapter = {
    mount(config: RiveSpatialSurfaceConfig): RiveSpatialSurfaceHandle;
    unmount(handle: RiveSpatialSurfaceHandle): void;
};

// ---- ui.d.ts
/**
 * Vendor-neutral wearable UI contracts and upstream parity catalogs.
 *
 * Vendor source code, CSS, fonts, icons, and assets remain in their upstream
 * repositories. This file describes the portable API surface only.
 */
export type XRUIComponentKind = "app-shell" | "backplate" | "container" | "surface" | "card" | "card-stack" | "frame" | "button" | "round-button" | "capsule-button" | "rectangle-button" | "button-group" | "button-rail" | "button-divider" | "checkbox" | "radio-button" | "switch" | "toggle-group" | "slider" | "confirmation-slider" | "scrubber" | "scroll-bar" | "scroll-view" | "scroll-window" | "vertical-list" | "grid-layout" | "pager" | "carousel" | "text" | "text-switcher" | "read-more-text" | "text-input" | "icon" | "image" | "media" | "header" | "page" | "sub-navigation" | "tooltip" | "context-menu" | "vertical-menu" | "modal" | "toast" | "divider" | "chip" | "tag" | "progress" | "progress-ring" | "pagination-indicator" | "swipe-indicator" | "volume-indicator" | "zoom-indicator" | "avatar" | "badge" | "shimmer" | "vignette" | "action-hint";
export type XRUIInteractionState = "idle" | "hover" | "focused" | "pressed" | "disabled" | "checked" | "unchecked" | "expanded" | "collapsed" | "indeterminate";
import type { XRUIInputSource } from "./interaction";
export type XRUIComponentParity = {
    kind: XRUIComponentKind;
    specs?: string;
    metaRayBanDisplay?: string;
    viro?: string;
    notes?: string;
};
export declare const SPECS_UI_KIT_COMPONENTS: readonly ["backplate", "frame", "button", "capsule-button", "rectangle-button", "round-button", "checkbox", "radio-button", "scroll-bar", "scroll-window", "slider", "confirmation-slider", "switch", "text-input", "toggle-group", "grid-layout"];
export declare const META_RAY_BAN_DISPLAY_UI_COMPONENTS: readonly ["app-shell", "container", "surface", "card", "card-stack", "text", "text-switcher", "read-more-text", "icon", "image", "media", "scroll-view", "vertical-list", "pager", "carousel", "button", "button-group", "button-rail", "button-divider", "switch", "radio-button", "slider", "scrubber", "chip", "tag", "divider", "page", "header", "sub-navigation", "tooltip", "context-menu", "vertical-menu", "modal", "toast", "progress", "progress-ring", "pagination-indicator", "swipe-indicator", "volume-indicator", "zoom-indicator", "avatar", "badge", "shimmer", "vignette", "action-hint"];
export declare const XR_UI_COMPONENT_PARITY: readonly [{
    readonly kind: "app-shell";
    readonly metaRayBanDisplay: "App";
}, {
    readonly kind: "backplate";
    readonly specs: "BackPlate";
    readonly viro: "GlassesBackplate";
}, {
    readonly kind: "container";
    readonly metaRayBanDisplay: "Container";
    readonly viro: "GlassesContainer";
}, {
    readonly kind: "surface";
    readonly metaRayBanDisplay: "Surface";
    readonly viro: "SpatialPanel";
}, {
    readonly kind: "card";
    readonly metaRayBanDisplay: "Card";
    readonly viro: "GlassesCard";
}, {
    readonly kind: "card-stack";
    readonly metaRayBanDisplay: "CardStack";
    readonly viro: "GlassesCardStack";
}, {
    readonly kind: "frame";
    readonly specs: "Frame";
    readonly viro: "GlassesFrame";
}, {
    readonly kind: "button";
    readonly specs: "BaseButton / RectangleButton";
    readonly metaRayBanDisplay: "Button";
    readonly viro: "GlassesButton";
}, {
    readonly kind: "round-button";
    readonly specs: "RoundButton";
    readonly viro: "GlassesRoundButton";
}, {
    readonly kind: "capsule-button";
    readonly specs: "CapsuleButton";
    readonly viro: "GlassesCapsuleButton";
}, {
    readonly kind: "rectangle-button";
    readonly specs: "RectangleButton";
    readonly viro: "GlassesRectangleButton";
}, {
    readonly kind: "button-group";
    readonly metaRayBanDisplay: "ButtonGroup";
    readonly viro: "GlassesButtonGroup";
}, {
    readonly kind: "button-rail";
    readonly metaRayBanDisplay: "ButtonRail";
    readonly viro: "GlassesButtonRail";
}, {
    readonly kind: "button-divider";
    readonly metaRayBanDisplay: "ButtonDivider";
    readonly viro: "GlassesButtonDivider";
}, {
    readonly kind: "checkbox";
    readonly specs: "Checkbox";
    readonly metaRayBanDisplay: "Checkbox pattern";
    readonly viro: "GlassesCheckbox";
}, {
    readonly kind: "radio-button";
    readonly specs: "RadioButton";
    readonly metaRayBanDisplay: "RadioButton";
    readonly viro: "GlassesRadioButton";
}, {
    readonly kind: "switch";
    readonly specs: "Switch";
    readonly metaRayBanDisplay: "Switch";
    readonly viro: "GlassesSwitch";
}, {
    readonly kind: "toggle-group";
    readonly specs: "ToggleGroup / SwitchToggleGroup";
    readonly viro: "GlassesToggleGroup";
}, {
    readonly kind: "slider";
    readonly specs: "Slider";
    readonly metaRayBanDisplay: "SliderBar";
    readonly viro: "GlassesSlider";
}, {
    readonly kind: "confirmation-slider";
    readonly specs: "ConfirmationSlider";
    readonly viro: "GlassesConfirmationSlider";
}, {
    readonly kind: "scrubber";
    readonly metaRayBanDisplay: "Scrubber";
    readonly viro: "GlassesScrubber";
}, {
    readonly kind: "scroll-bar";
    readonly specs: "ScrollBar";
    readonly viro: "GlassesScrollBar";
}, {
    readonly kind: "scroll-view";
    readonly metaRayBanDisplay: "ScrollView";
    readonly viro: "SpatialScrollView";
}, {
    readonly kind: "scroll-window";
    readonly specs: "ScrollWindow";
    readonly viro: "GlassesScrollWindow";
}, {
    readonly kind: "vertical-list";
    readonly metaRayBanDisplay: "VerticalList";
    readonly viro: "GlassesVerticalList";
}, {
    readonly kind: "grid-layout";
    readonly specs: "GridLayout";
    readonly viro: "GlassesGridLayout";
}, {
    readonly kind: "pager";
    readonly metaRayBanDisplay: "Pager";
    readonly viro: "GlassesPager";
}, {
    readonly kind: "carousel";
    readonly metaRayBanDisplay: "Carousel";
    readonly viro: "GlassesCarousel";
}, {
    readonly kind: "text";
    readonly metaRayBanDisplay: "TextView";
    readonly viro: "GlassesText";
}, {
    readonly kind: "text-switcher";
    readonly metaRayBanDisplay: "TextSwitcher";
    readonly viro: "GlassesTextSwitcher";
}, {
    readonly kind: "read-more-text";
    readonly metaRayBanDisplay: "ReadMoreTextView";
    readonly viro: "GlassesReadMoreText";
}, {
    readonly kind: "text-input";
    readonly specs: "TextInputField";
    readonly metaRayBanDisplay: "InputTextView";
    readonly notes: "Viro requires a host text-input/keyboard adapter; the shared component must not fake keyboard input.";
}, {
    readonly kind: "icon";
    readonly metaRayBanDisplay: "IconImage";
    readonly viro: "GlassesIcon";
}, {
    readonly kind: "image";
    readonly metaRayBanDisplay: "MediaWrapper";
    readonly viro: "GlassesImage";
}, {
    readonly kind: "media";
    readonly metaRayBanDisplay: "MediaWrapper";
    readonly viro: "GlassesMedia";
}, {
    readonly kind: "header";
    readonly metaRayBanDisplay: "Header";
    readonly viro: "GlassesHeader";
}, {
    readonly kind: "page";
    readonly metaRayBanDisplay: "Page";
    readonly viro: "GlassesPage";
}, {
    readonly kind: "sub-navigation";
    readonly metaRayBanDisplay: "SubNavigation / SubNavigationPager";
    readonly viro: "GlassesSubNavigation";
}, {
    readonly kind: "tooltip";
    readonly specs: "Tooltip";
    readonly metaRayBanDisplay: "Tooltip";
    readonly viro: "GlassesTooltip";
}, {
    readonly kind: "context-menu";
    readonly metaRayBanDisplay: "ContextMenu";
    readonly viro: "GlassesContextMenu";
}, {
    readonly kind: "vertical-menu";
    readonly metaRayBanDisplay: "VerticalMenu";
    readonly viro: "GlassesVerticalMenu";
}, {
    readonly kind: "modal";
    readonly metaRayBanDisplay: "Modal";
    readonly viro: "GlassesModal";
}, {
    readonly kind: "toast";
    readonly metaRayBanDisplay: "Toast";
    readonly viro: "GlassesToast";
}, {
    readonly kind: "divider";
    readonly metaRayBanDisplay: "Divider";
    readonly viro: "GlassesDivider";
}, {
    readonly kind: "chip";
    readonly metaRayBanDisplay: "Chip";
    readonly viro: "GlassesChip";
}, {
    readonly kind: "tag";
    readonly metaRayBanDisplay: "Tag";
    readonly viro: "GlassesTag";
}, {
    readonly kind: "progress";
    readonly metaRayBanDisplay: "ProgressIndicator";
    readonly viro: "GlassesProgress";
}, {
    readonly kind: "progress-ring";
    readonly metaRayBanDisplay: "ProgressRing";
    readonly viro: "GlassesProgressRing";
}, {
    readonly kind: "pagination-indicator";
    readonly metaRayBanDisplay: "PaginationIndicator";
    readonly viro: "GlassesPaginationIndicator";
}, {
    readonly kind: "swipe-indicator";
    readonly metaRayBanDisplay: "SwipeIndicator";
    readonly viro: "GlassesSwipeIndicator";
}, {
    readonly kind: "volume-indicator";
    readonly metaRayBanDisplay: "VolumeIndicator";
    readonly viro: "GlassesVolumeIndicator";
}, {
    readonly kind: "zoom-indicator";
    readonly metaRayBanDisplay: "ZoomIndicator";
    readonly viro: "GlassesZoomIndicator";
}, {
    readonly kind: "avatar";
    readonly metaRayBanDisplay: "Avatar";
    readonly viro: "GlassesAvatar";
}, {
    readonly kind: "badge";
    readonly metaRayBanDisplay: "AppBadge / NotificationBadge";
    readonly viro: "GlassesBadge";
}, {
    readonly kind: "shimmer";
    readonly metaRayBanDisplay: "Shimmer / ShimmerItem";
    readonly viro: "GlassesShimmer";
}, {
    readonly kind: "vignette";
    readonly metaRayBanDisplay: "Vignette";
    readonly viro: "GlassesVignette";
}, {
    readonly kind: "action-hint";
    readonly metaRayBanDisplay: "ActionHint";
    readonly viro: "GlassesActionHint";
}];
export declare function getXRUIComponentParity(kind: XRUIComponentKind): XRUIComponentParity | undefined;
export type XRUITextInputAdapter = {
    requestFocus(): Promise<void> | void;
    dismiss(): Promise<void> | void;
    isAvailable(): boolean;
};
export type XRUIFocusModel = {
    enabled: boolean;
    preferredInput: XRUIInputSource;
    wrapAround?: boolean;
    preserveOnNavigation?: boolean;
};
export type XRUIComponentModel = {
    id: string;
    kind: XRUIComponentKind;
    label?: string;
    value?: string | number | boolean;
    disabled?: boolean;
    visible?: boolean;
    min?: number;
    max?: number;
    step?: number;
    focused?: boolean;
    state?: XRUIInteractionState;
    width?: number;
    height?: number;
    children?: readonly XRUIComponentModel[];
};

// ---- workspaceSurface.d.ts
/**
 * Workspace surface contract: one logical workspace, described once, that
 * every platform adapter resolves into its own presentation (Meta Horizon
 * windows, PICO subwindows, Viro engine panels, a flat SplitView).
 *
 * Product state (selection, open panels) lives in the app's store. A surface
 * declares which piece of that state it depends on; adapters receive the
 * current values through {@linkcode WorkspaceActivity} and never own them.
 */
import type { XRCapabilityName, XRCapabilityReport } from "./index";
/**
 * What a surface means to the product. Adapters may treat roles differently
 * (`main` is never promoted), but the role never changes per platform.
 *
 * @see {@linkcode WorkspaceSurface.role}
 */
export type WorkspaceSurfaceRole = "main" | "discover" | "detail" | "assistant" | "tools";
/**
 * Closest legacy {@linkcode SpatialSurfaceRole} for each workspace role, for
 * adapters that still read `SpatialSurfaceIntent`.
 */
export declare const WORKSPACE_ROLE_TO_SPATIAL_ROLE: {
    readonly main: "content";
    readonly discover: "master";
    readonly detail: "inspector";
    readonly assistant: "popup";
    readonly tools: "accessory";
};
/**
 * Preferred size of a window surface.
 *
 * - `dp`: React Native layout points.
 * - `percent-of-main`: percentage (0-100) of the main window's size.
 *
 * @see {@linkcode WorkspaceWindowPresentation.size}
 */
export type WorkspaceSurfaceSize = {
    readonly unit: "dp";
    readonly width: number;
    readonly height: number;
} | {
    readonly unit: "percent-of-main";
    readonly widthPercent: number;
    readonly heightPercent: number;
};
/**
 * Side of the main surface a window sits against. `start`/`end` follow the
 * layout direction (they swap in RTL); `center` overlaps the main surface.
 */
export type WorkspaceAnchorSide = "start" | "end" | "top" | "bottom" | "center";
/**
 * How far a window comes toward the user relative to the main surface.
 * Adapters map this to their own depth steps.
 */
export type WorkspaceAnchorDepth = "flush" | "near" | "mid" | "far";
/**
 * Where a window wants to be relative to the main surface. The platform
 * decides the final placement; this is intent only.
 *
 * @see {@linkcode WorkspaceWindowPresentation.anchor}
 */
export type WorkspaceAnchorIntent = {
    readonly side: WorkspaceAnchorSide;
    /** @default "flush" */
    readonly depth?: WorkspaceAnchorDepth;
};
/** The permanent center surface. Exactly one per workspace; never promoted. */
export type WorkspaceMainPresentation = {
    readonly kind: "main";
};
/**
 * A surface that prefers its own system window beside the main surface.
 * `priority` arbitrates when there are more window surfaces than slots: higher
 * wins, ties go to declaration order. Space values by 10 (`0, 10, 20`) so new
 * surfaces can slot in between.
 */
export type WorkspaceWindowPresentation = {
    readonly kind: "window";
    readonly size: WorkspaceSurfaceSize;
    readonly anchor: WorkspaceAnchorIntent;
    readonly priority: number;
};
/**
 * A layer drawn inside the main surface (an assistant overlay, a toast). It
 * never asks for a window, so it never competes for a slot.
 */
export type WorkspaceLayerPresentation = {
    readonly kind: "layer";
    readonly region: WorkspaceInlineRegion;
};
/**
 * Preferred presentation of a surface.
 *
 * @see {@linkcode WorkspaceSurface.presentation}
 */
export type WorkspacePresentation = WorkspaceMainPresentation | WorkspaceWindowPresentation | WorkspaceLayerPresentation;
/** Region of the main surface that hosts inline content. */
export type WorkspaceInlineRegion = "leading" | "trailing" | "overlay" | "sheet";
/**
 * What a window surface does when it cannot have a window (no spatial
 * runtime, no free slot, or an unmet capability requirement).
 *
 * - `inline`: render inside the main surface, in `region`.
 * - `drop`: do not render; children unmount.
 *
 * @see {@linkcode WorkspaceSurface.fallback}
 */
export type WorkspaceSurfaceFallback = {
    readonly kind: "inline";
    readonly region: WorkspaceInlineRegion;
} | {
    readonly kind: "drop";
};
/**
 * Capabilities a surface's preferred presentation needs beyond a window slot.
 * A capability counts as met only when the runtime reports it `"supported"`.
 * When unmet, the surface takes its fallback.
 *
 * @see {@linkcode evaluateWorkspaceRequirement}
 */
export type WorkspaceCapabilityRequirement = {
    readonly kind: "none";
} | {
    readonly kind: "all-of";
    readonly capabilities: readonly XRCapabilityName[];
} | {
    readonly kind: "any-of";
    readonly capabilities: readonly XRCapabilityName[];
};
/**
 * Result of checking a {@linkcode WorkspaceCapabilityRequirement} against a
 * {@linkcode XRCapabilityReport}. `missing` lists the capabilities that were
 * not `"supported"`.
 */
export type WorkspaceRequirementVerdict = {
    readonly kind: "met";
} | {
    readonly kind: "unmet";
    readonly missing: readonly XRCapabilityName[];
};
/**
 * Focus and back-navigation behaviour.
 *
 * - `focus: "primary"`: holds default focus. Only the main surface uses it.
 * - `focus: "take-on-open"`: receives focus when it mounts.
 * - `focus: "passive"`: never takes focus on its own.
 * - `back: "exit"`: back leaves the workspace (main surface).
 * - `back: "close"`: back closes this surface and returns focus to main.
 * - `back: "return-to-main"`: back moves focus to main, surface stays.
 *
 * @see {@linkcode WorkspaceSurface.focus}
 */
export type WorkspaceSurfaceFocus = {
    readonly focus: "primary" | "take-on-open" | "passive";
    readonly back: "exit" | "close" | "return-to-main";
};
/**
 * Who decides whether a surface is mounted.
 *
 * - `workspace`: always mounted while the workspace is.
 * - `selection`: mounted only while the store has a value for `selectionKey`
 *   (for example a Place Detail surface keyed on `"place"`). It never shows
 *   empty.
 * - `user`: mounted while the user has it open (`openSurfaceIds`).
 *
 * @see {@linkcode isWorkspaceSurfaceMounted}
 */
export type WorkspaceSurfaceLifecycle = {
    readonly owner: "workspace";
} | {
    readonly owner: "selection";
    readonly selectionKey: string;
} | {
    readonly owner: "user";
};
/**
 * One surface of a workspace. `id` is the stable identity adapters use as
 * the platform label (Meta `SpatialWindow` `label`); keep it constant across
 * renders and unique within the workspace.
 *
 * @see {@linkcode WorkspaceDefinition.surfaces}
 */
export type WorkspaceSurface = {
    readonly id: string;
    readonly role: WorkspaceSurfaceRole;
    readonly presentation: WorkspacePresentation;
    readonly fallback: WorkspaceSurfaceFallback;
    readonly requires: WorkspaceCapabilityRequirement;
    readonly focus: WorkspaceSurfaceFocus;
    readonly lifecycle: WorkspaceSurfaceLifecycle;
};
/**
 * The authored workspace. `maxPromotedSurfaces` caps how many surfaces may
 * hold a window at once, on top of whatever the platform allows; omit it to
 * use the platform's capacity alone.
 *
 * @see {@linkcode validateWorkspaceDefinition}
 */
export type WorkspaceDefinition = {
    readonly id: string;
    readonly surfaces: readonly WorkspaceSurface[];
    readonly maxPromotedSurfaces?: number;
};
/**
 * Current values of the store fields surfaces depend on. Adapters read it,
 * never write it.
 *
 * - `selections`: selection keys that currently hold a value, e.g. `["place"]`.
 * - `openSurfaceIds`: ids of `user`-owned surfaces the user has open.
 */
export type WorkspaceActivity = {
    readonly selections: readonly string[];
    readonly openSurfaceIds: readonly string[];
};
/**
 * Input every workspace resolver takes: the authored definition plus the
 * current store values.
 */
export type WorkspaceIntent = {
    readonly definition: WorkspaceDefinition;
    readonly activity: WorkspaceActivity;
};
/**
 * Throws when a definition breaks the workspace invariants: empty or
 * duplicate ids, not exactly one `main` surface, a `main` role without the
 * `main` presentation (or the reverse), a `main` surface that is not
 * workspace-owned, or a negative/non-integer `maxPromotedSurfaces`.
 */
export declare function validateWorkspaceDefinition(definition: WorkspaceDefinition): void;
/** True when the surface's lifecycle owner currently wants it mounted. */
export declare function isWorkspaceSurfaceMounted(surface: WorkspaceSurface, activity: WorkspaceActivity): boolean;
/** Checks a requirement against a runtime's capability report. */
export declare function evaluateWorkspaceRequirement(requirement: WorkspaceCapabilityRequirement, report: XRCapabilityReport): WorkspaceRequirementVerdict;
