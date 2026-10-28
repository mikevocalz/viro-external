// API snapshot for @viro-external/specs (React Native / Node entry).
// Regenerate with: node scripts/ci/api-snapshot.mjs --update

// ---- animation.d.ts
import type { SpecsUpstreamPackageName } from "./upstream.js";
export type SpecsAnimationEasing = "linear" | "ease-in" | "ease-out" | "ease-in-out" | {
    cubicBezier: [number, number, number, number];
};
export type SpecsViroAnimationProperty = "positionX" | "positionY" | "positionZ" | "scaleX" | "scaleY" | "scaleZ" | "rotateX" | "rotateY" | "rotateZ" | "opacity";
export type SpecsViroAnimationProperties = Partial<Record<SpecsViroAnimationProperty, number>>;
export type SpecsViroAnimationDefinition = {
    properties: SpecsViroAnimationProperties;
    durationMs: number;
    delayMs?: number;
    easing?: SpecsAnimationEasing;
    loop?: boolean;
    completionEvent?: string;
};
export type SpecsAnimationTrackTarget = "transform.position.x" | "transform.position.y" | "transform.position.z" | "transform.scale.x" | "transform.scale.y" | "transform.scale.z" | "transform.rotation.x" | "transform.rotation.y" | "transform.rotation.z" | "material.opacity";
export type SpecsAnimationTrackPlan = {
    target: SpecsAnimationTrackTarget;
    from: "current";
    to: number;
};
export type SpecsNativeAnimationPlan = {
    engine: "AnimationPlayer";
    backendPackage: Extract<SpecsUpstreamPackageName, "AnimationExamples">;
    durationSeconds: number;
    delaySeconds: number;
    easing: SpecsAnimationEasing;
    playbackMode: "single" | "loop";
    completionEvent: string;
    tracks: SpecsAnimationTrackPlan[];
};
/**
 * Compiles the Viro-style target-property animation model into a plan for
 * Lens Studio AnimationCurve/AnimationPropertyTrack/AnimationPlayer.
 *
 * The Lens runtime resolves each track's current value at playback time,
 * preserving Viro's "animate from current state to target state" semantics.
 */
export declare function compileViroAnimationForSpecs(definition: SpecsViroAnimationDefinition): SpecsNativeAnimationPlan;
export interface SpecsAnimationRuntime {
    play(nodeId: string, plan: SpecsNativeAnimationPlan): Promise<void> | void;
    stop?(nodeId: string): Promise<void> | void;
}

// ---- ar.d.ts
export type SpecsSurfaceClassification = "floor" | "wall" | "ceiling" | "table" | "seat" | "unknown";
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
export declare function normalizeSpecsWorldQueryHit(hit: SpecsWorldQueryHit): SpecsARHitTestResult;
export type SpecsSurfacePlacementMode = "near-surface" | "horizontal" | "vertical";
export type SpecsPlacementPose = {
    position: [number, number, number];
    rotation: [number, number, number, number];
    surface?: SpecsSurfaceClassification;
};
export interface SpecsWorldRuntime {
    hitTest(request: SpecsWorldQueryRequest): Promise<readonly SpecsARHitTestResult[]>;
    startPlacement(mode: SpecsSurfacePlacementMode, onPose: (pose: SpecsPlacementPose) => void): Promise<() => void> | (() => void);
}
export declare const SPECS_WORLD_PACKAGES: readonly ["WorldQueryHit", "SurfacePlacement"];

// ---- index.d.ts
import type { PortableXRInteraction, PortableXRNode, XRCapabilityReport, XRPlatformAdapter } from "@viro-external/xr-contract";
export type SpecsSupportedNodeKind = "group" | "text" | "image" | "model" | "panel";
export type SpecsSceneSnapshot = {
    version: 1;
    nodes: PortableXRNode[];
};
export type SpecsCompileDiagnostic = {
    level: "warning" | "error";
    nodeId?: string;
    message: string;
};
export type SpecsCompileResult = {
    scene: SpecsSceneSnapshot;
    diagnostics: SpecsCompileDiagnostic[];
};
/**
 * Compile the deliberately small portable scene subset into a stable JSON
 * snapshot for a Lens Studio/Snap OS runtime bridge.
 */
export declare function compileSpecsScene(nodes: readonly PortableXRNode[]): SpecsCompileResult;
export interface SpecsRuntimeTransport {
    getCapabilities(): Promise<XRCapabilityReport> | XRCapabilityReport;
    applyScene(scene: SpecsSceneSnapshot): Promise<void> | void;
    onInteraction(listener: (event: PortableXRInteraction) => void): () => void;
    dispose(): Promise<void> | void;
}
export declare class SpecsAdapter implements XRPlatformAdapter {
    private readonly transport;
    readonly family: "snap-specs";
    constructor(transport: SpecsRuntimeTransport);
    getCapabilities(): Promise<XRCapabilityReport> | XRCapabilityReport;
    updatePortableScene(nodes: readonly PortableXRNode[]): Promise<void>;
    dispose(): Promise<void> | void;
}
export * from "./runtime.js";
export * from "./upstream.js";
export * from "./render.js";
export * from "./animation.js";
export * from "./interaction.js";
export * from "./ar.js";
export * from "./navigation.js";
export * from "./testing.js";
export * from "./viro-runtime-provider.js";
export * from "./viro-bundle.js";
export * from "./ui-interaction.js";
export * from "./presentation.js";

// ---- interaction.d.ts
import type { PortableXRInteraction, XRInteractionPhase, XRInteractionSource } from "@viro-external/xr-contract";
export type SpecsInteractionInput = Extract<XRInteractionSource, "gaze" | "hand" | "pinch" | "voice">;
export type SpecsInteractionKind = Extract<XRInteractionPhase, "hover-enter" | "hover-move" | "hover-exit" | "select-start" | "select-end" | "drag" | "cancel">;
export type SpecsRawInteraction = {
    kind: SpecsInteractionKind;
    input: SpecsInteractionInput;
    targetId?: string;
    worldPosition?: [number, number, number];
    worldDirection?: [number, number, number];
    timestampMs?: number;
};
export declare function normalizeSpecsInteraction(event: SpecsRawInteraction): PortableXRInteraction;
export interface SpecsInteractionRuntime {
    subscribe(listener: (event: PortableXRInteraction) => void): () => void;
    setInteractable?(nodeId: string, enabled: boolean): Promise<void> | void;
    setManipulationEnabled?(nodeId: string, enabled: boolean): Promise<void> | void;
}
export declare const SPECS_INTERACTION_PACKAGES: readonly ["SpecsInteractionKitExamples", "InteractableHelper"];

// ---- navigation.d.ts
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
        Extract<SpecsUpstreamPackageName, "VolumetricLine">
    ];
};
/**
 * Produces the Specs-side plan used by map/navigation integrations.
 *
 * Mapbox or another routing provider stays outside the renderer. Its route
 * geometry is normalized here and consumed by SpecsNavigationKit for location
 * semantics plus VolumetricLine for the world-space route visualization.
 */
export declare function compileSpecsNavigationPlan(route: SpecsNavigationRoute, line?: SpecsRouteLineStyle): SpecsNavigationPlan;
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
export declare function compileSpecsPolyline(polyline: SpecsWorldPolyline): SpecsVolumetricLinePlan;
export interface SpecsNavigationRuntime {
    presentRoute(plan: SpecsNavigationPlan): Promise<void> | void;
    presentPolyline?(plan: SpecsVolumetricLinePlan): Promise<void> | void;
    clearRoute?(): Promise<void> | void;
}

// ---- presentation.d.ts
import { type SpecsSceneSnapshot } from "./index.js";
/** A semantic command bound to one real node in the Lens scene. */
export type SpecsActionTarget = {
    targetId: string;
    action: string;
};
/**
 * JSON-only boundary between application state and a Lens Studio
 * presentation. No callbacks, credentials, React elements or native objects.
 */
export type SpecsPresentationSnapshot = {
    scene: SpecsSceneSnapshot;
    targets: SpecsActionTarget[];
};
/**
 * Validate a complete presentation *before* the Lens clears the old scene.
 * Child-first/missing parents previously passed compiler warnings but would
 * throw after the old on-device scene had already been destroyed.
 */
export declare function compileSpecsPresentation(input: {
    scene: SpecsSceneSnapshot;
    targets?: readonly SpecsActionTarget[];
}): SpecsPresentationSnapshot;

// ---- render.d.ts
import type { PortableXRNode, PortableXRScroll, PortableXRTextStyle } from "@viro-external/xr-contract";
import type { SpecsUpstreamPackageName } from "./upstream.js";
export type SpecsRenderPrimitive = "scene-object" | "text" | "image" | "render-mesh" | "ui-frame";
export type SpecsRenderDiagnostic = {
    level: "warning" | "error";
    nodeId?: string;
    message: string;
};
export type SpecsRenderCommand = {
    op: "create";
    id: string;
    parentId?: string;
    primitive: SpecsRenderPrimitive;
    backendPackage?: SpecsUpstreamPackageName;
} | {
    op: "transform";
    id: string;
    position?: [number, number, number];
    rotation?: [number, number, number, number];
    scale?: [number, number, number];
} | {
    op: "content";
    id: string;
    text?: string;
    source?: string;
    textStyle?: PortableXRTextStyle;
    scroll?: PortableXRScroll;
} | {
    op: "visibility";
    id: string;
    visible: boolean;
};
export type SpecsRenderPlan = {
    version: 1;
    commands: SpecsRenderCommand[];
    diagnostics: SpecsRenderDiagnostic[];
    packages: SpecsUpstreamPackageName[];
};
/**
 * Converts the portable XR tree into a renderer-neutral command stream that a
 * Lens Studio implementation can execute using SceneObject, Text/Image,
 * RenderMeshVisual and Spectacles UIKit primitives.
 */
export declare function compileSpecsRenderPlan(nodes: readonly PortableXRNode[]): SpecsRenderPlan;
export interface SpecsRenderRuntime {
    apply(plan: SpecsRenderPlan): Promise<void> | void;
    removeNode?(id: string): Promise<void> | void;
    clear?(): Promise<void> | void;
}

// ---- runtime.d.ts
export interface SpecsDeviceInfoSystemLike {
    isSpectacles(): boolean;
    isEditor(): boolean;
    isInternetAvailable?(): boolean;
}
export interface SpecsRuntimeGlobals {
    deviceInfoSystem?: SpecsDeviceInfoSystemLike;
    /**
     * Build-time marker set by the Specs/Lens Studio bootstrap.
     *
     * Physical Spectacles do not require the marker because isSpectacles()
     * is authoritative there. The marker exists so editor/simulator builds can
     * distinguish a Specs-targeted project from an unrelated Lens Studio lens.
     */
    __VIRO_SPECS_BUILD__?: boolean;
}
export interface SpecsRuntimeInfo {
    family: "snap-specs";
    isDevice: boolean;
    isEditor: boolean;
    isBuild: boolean;
    isRuntime: boolean;
    internetAvailable: boolean | null;
}
export declare function isSpecsDevice(globals?: SpecsRuntimeGlobals | undefined): boolean;
export declare function isSpecsEditor(globals?: SpecsRuntimeGlobals | undefined): boolean;
export declare function isSpecsBuild(globals?: SpecsRuntimeGlobals | undefined): boolean;
export declare function isSpecsRuntime(globals?: SpecsRuntimeGlobals | undefined): boolean;
export declare function getSpecsRuntime(globals?: SpecsRuntimeGlobals | undefined): SpecsRuntimeInfo;
/**
 * React-friendly runtime snapshot helper.
 *
 * Specs identity is static for the lifetime of a render session, so this
 * helper intentionally has no React dependency and can also be used by
 * non-React shared TypeScript. Dynamic values such as battery/network events
 * should use a dedicated subscription API rather than this snapshot.
 */
export declare function useSpecs(globals?: SpecsRuntimeGlobals | undefined): SpecsRuntimeInfo;
/**
 * Property-style access for code that prefers the Expo Horizon Core shape.
 */
export declare const SpecsRuntime: {
    readonly isSpecsDevice: boolean;
    readonly isSpecsEditor: boolean;
    readonly isSpecsBuild: boolean;
    readonly isSpecsRuntime: boolean;
    readonly info: SpecsRuntimeInfo;
};

// ---- testing.d.ts
export type SpecsInspectionNode = {
    id: string;
    name?: string;
    components: readonly string[];
    position?: [number, number, number];
    visible?: boolean;
};
export type SpecsValidationStep = {
    op: "assert-node";
    id: string;
    requiredComponents?: readonly string[];
} | {
    op: "pinch";
    id: string;
} | {
    op: "poke";
    id: string;
} | {
    op: "drag";
    id: string;
    from: [number, number, number];
    to: [number, number, number];
} | {
    op: "capture";
    label: string;
};
export type SpecsValidationPlan = {
    name: string;
    inspectorPackage: "AiPreviewAgentInspect";
    interactionPackage: "AiPreviewAgentInteract";
    steps: readonly SpecsValidationStep[];
};
/**
 * Canonical end-to-end contract for the cross-platform Platform Lab.
 *
 * The Lens-side harness can execute this through AiPreviewAgentInspect and
 * AiPreviewAgentInteract while other Viro targets execute equivalent actions
 * through their own test drivers.
 */
export declare const SPECS_PLATFORM_LAB_PLAN: SpecsValidationPlan;
export interface SpecsValidationRuntime {
    inspectNode(id: string): Promise<SpecsInspectionNode | null>;
    pinch(id: string): Promise<void>;
    poke(id: string): Promise<void>;
    drag(id: string, from: [number, number, number], to: [number, number, number]): Promise<void>;
    capture(label: string): Promise<void>;
}
export type SpecsValidationResult = {
    step: SpecsValidationStep;
    passed: boolean;
    message?: string;
};
export declare function runSpecsValidationPlan(runtime: SpecsValidationRuntime, plan?: SpecsValidationPlan): Promise<SpecsValidationResult[]>;

// ---- ui-interaction.d.ts
import type { XRUIInteractionAdapter, XRUIInteractionCapabilities, XRUIInteractionEvent } from "@viro-external/xr-contract";
import type { SpecsInteractionRuntime, SpecsRawInteraction } from "./interaction.js";
/**
 * Adapts the existing Specs interaction/ESIK runtime into the shared XR UI
 * behavior contract. SIK/ESIK remains the native implementation; this class
 * only normalizes its events for portable components.
 */
export declare class SpecsESIKUIAdapter implements XRUIInteractionAdapter {
    private readonly runtime;
    readonly id = "specs-esik";
    constructor(runtime: SpecsInteractionRuntime);
    getCapabilities(): XRUIInteractionCapabilities;
    subscribe(listener: (event: XRUIInteractionEvent) => void): () => void;
    normalize(raw: SpecsRawInteraction): XRUIInteractionEvent;
    setInteractable(targetId: string, enabled: boolean): Promise<void> | void;
    setManipulationEnabled(targetId: string, enabled: boolean): Promise<void> | void;
    dispose(): Promise<void> | void;
}

// ---- upstream.d.ts
export type SpecsUpstreamRole = "runtime" | "rendering" | "interaction" | "world" | "navigation" | "camera" | "network" | "testing" | "utility";
export type SpecsUpstreamPackage = {
    name: string;
    role: SpecsUpstreamRole;
    required: boolean;
    purpose: string;
};
export declare const SPECS_UPSTREAM: {
    readonly repository: "specs-devs/packages";
    readonly commit: "df8820c0c4970f052e545b8da1dd288c2516d912";
    readonly target: "SPECS 27";
    readonly lensStudio: ">=5.22.0";
    readonly legacySpectacles2024Branch: "5.15.4";
    readonly licensePath: "LICENSE.md";
};
export declare const SPECS_UPSTREAM_PACKAGES: readonly [{
    readonly name: "AccessComponents";
    readonly role: "utility";
    readonly required: true;
    readonly purpose: "SceneObject/component lookup and hierarchy access patterns.";
}, {
    readonly name: "Instantiation";
    readonly role: "rendering";
    readonly required: true;
    readonly purpose: "Runtime prefab and object creation for Viro node/model parity.";
}, {
    readonly name: "AnimationExamples";
    readonly role: "rendering";
    readonly required: true;
    readonly purpose: "Native AnimationPlayer, curves, tracks, events, and authored assets.";
}, {
    readonly name: "SpecsInteractionKitExamples";
    readonly role: "interaction";
    readonly required: true;
    readonly purpose: "SIK interaction and UIKit reference implementations.";
}, {
    readonly name: "InteractableHelper";
    readonly role: "interaction";
    readonly required: true;
    readonly purpose: "Low-level interactable wiring for hover/select/manipulation.";
}, {
    readonly name: "WorldQueryHit";
    readonly role: "world";
    readonly required: true;
    readonly purpose: "WorldQueryModule raycasts and real-world surface hit tests.";
}, {
    readonly name: "SurfacePlacement";
    readonly role: "world";
    readonly required: true;
    readonly purpose: "Horizontal, vertical, and near-surface placement.";
}, {
    readonly name: "Solvers";
    readonly role: "world";
    readonly required: false;
    readonly purpose: "Spatial behaviors useful for head/world relative layout parity.";
}, {
    readonly name: "SpecsNavigationKit";
    readonly role: "navigation";
    readonly required: false;
    readonly purpose: "Location-aware AR navigation and place/user-position primitives.";
}, {
    readonly name: "VolumetricLine";
    readonly role: "rendering";
    readonly required: false;
    readonly purpose: "Runtime 3D path mesh suitable for ViroPolyline parity.";
}, {
    readonly name: "SpecsShaderLibrary";
    readonly role: "rendering";
    readonly required: false;
    readonly purpose: "Power-conscious material/shader fallbacks for Specs.";
}, {
    readonly name: "RuntimeGizmos";
    readonly role: "utility";
    readonly required: false;
    readonly purpose: "Runtime spatial debugging and visualization.";
}, {
    readonly name: "CompositeCameraTexture";
    readonly role: "camera";
    readonly required: false;
    readonly purpose: "Camera texture compositing.";
}, {
    readonly name: "CropCameraTexture";
    readonly role: "camera";
    readonly required: false;
    readonly purpose: "Camera crop/ROI processing.";
}, {
    readonly name: "HandAttacher";
    readonly role: "interaction";
    readonly required: false;
    readonly purpose: "Attach scene content to tracked hand joints.";
}, {
    readonly name: "Specs3DHandHints";
    readonly role: "interaction";
    readonly required: false;
    readonly purpose: "On-device gesture instruction and feedback.";
}, {
    readonly name: "WebSocketExamples";
    readonly role: "network";
    readonly required: false;
    readonly purpose: "Realtime bidirectional transport reference implementation.";
}, {
    readonly name: "AiPreviewAgentInspect";
    readonly role: "testing";
    readonly required: false;
    readonly purpose: "Inspect a running Lens and capture renderer state.";
}, {
    readonly name: "AiPreviewAgentInteract";
    readonly role: "testing";
    readonly required: false;
    readonly purpose: "Synthetic pinch, poke, and drag for end-to-end validation.";
}];
export type SpecsUpstreamPackageName = (typeof SPECS_UPSTREAM_PACKAGES)[number]["name"];
export declare function getSpecsUpstreamPackage(name: SpecsUpstreamPackageName): SpecsUpstreamPackage;
export declare function getRequiredSpecsUpstreamPackages(): readonly SpecsUpstreamPackage[];

// ---- viro-bundle.d.ts
import type { PortableXRNode } from "@viro-external/xr-contract";
import { type SpecsSceneSnapshot } from "./index.js";
import { type SpecsVolumetricLinePlan } from "./navigation.js";
type Vec3 = [number, number, number];
type Quat = [number, number, number, number];
export interface ViroCompiledPolylineLike {
    id: string;
    parentId?: string;
    points: readonly Vec3[];
    position?: Vec3;
    rotation?: Quat;
    scale?: Vec3;
    widthMeters: number;
    materialId?: string;
}
export interface ViroCompiledSpecsBundleLike {
    version: 1;
    scene: {
        version: 1;
        nodes: PortableXRNode[];
    };
    polylines?: readonly ViroCompiledPolylineLike[];
    bindings?: readonly {
        nodeId: string;
        hover?: boolean;
        gaze?: boolean;
        select?: boolean;
        drag?: boolean;
    }[];
    diagnostics?: readonly string[];
}
export interface SpecsCompiledPolyline {
    id: string;
    parentId?: string;
    plan: SpecsVolumetricLinePlan;
}
export interface SpecsViroBundleCompilation {
    scene: SpecsSceneSnapshot;
    polylines: SpecsCompiledPolyline[];
    diagnostics: string[];
}
/**
 * Consumes the JSON-safe bundle emitted by @reactvision/react-viro's
 * serializeViroSpecsCompilation()/compileViroSpecsJSX() surface.
 *
 * This adapter deliberately remains structural: viro-external does not import
 * the Viro package, so applications can version the public renderer and Lens
 * backend independently within the documented compatibility range.
 */
export declare function compileViroBundleForSpecs(bundle: ViroCompiledSpecsBundleLike): SpecsViroBundleCompilation;
export {};

// ---- viro-runtime-provider.d.ts
import type { XRCapabilityReport } from "@viro-external/xr-contract";
import { type SpecsRuntimeInfo } from "./runtime.js";
export type ViroRuntimeCapabilityState = "supported" | "unsupported" | "permission-required" | "temporarily-unavailable" | "unverified";
export type ViroRuntimeSnapshotLike = {
    platform: "specs";
    runtime: "lens-studio";
    deviceFamily: "snap-specs";
    isSpecs: true;
    isHorizon: false;
    isPico: false;
    isVisionOS: false;
    isWeb: false;
    isPhysicalDevice: boolean;
    isSimulator: boolean;
    isEditor: boolean;
    capabilities: Record<string, ViroRuntimeCapabilityState>;
};
export type ViroRuntimeProviderLike = {
    getSnapshot(): ViroRuntimeSnapshotLike;
    subscribe?: (listener: () => void) => () => void;
};
export declare function specsCapabilitiesToViroRuntime(report: XRCapabilityReport): Record<string, ViroRuntimeCapabilityState>;
/**
 * Structural adapter for @reactvision/react-viro's registerViroXRRuntimeProvider().
 *
 * The function intentionally returns a shape instead of importing Viro so the
 * two packages remain optional peers rather than creating a hard dependency
 * cycle.
 */
export declare function createViroSpecsRuntimeProvider(capabilities: XRCapabilityReport, runtime?: SpecsRuntimeInfo): ViroRuntimeProviderLike;
