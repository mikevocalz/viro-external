/**
 * Dependency-free wire protocol consumed inside Lens Studio.
 *
 * Keep this file free of npm/workspace imports. The shared TypeScript compiler
 * produces structurally compatible payloads; Lens Studio only needs these
 * serialized shapes and official .lspkg dependencies.
 */
export const VIRO_SPECS_WIRE_VERSION = 1 as const;

export type ViroSpecsNodeKind =
  | "group"
  | "text"
  | "image"
  | "model"
  | "panel"
  | "surface"
  | "scroll"
  | "video";

/** Linear RGBA, each channel 0-1. */
export type ViroSpecsColor = [number, number, number, number];

/** How a texture fills a surface of a different aspect ratio. */
export type ViroSpecsSurfaceFit = "cover" | "contain" | "stretch";

/** Placement shared by every node. Positions are meters in parent space. */
export type ViroSpecsSceneNodeBase = {
  id: string;
  parentId?: string;
  position?: [number, number, number];
  rotation?: [number, number, number, number];
  visible?: boolean;
};

/** A node scaled by a unitless multiplier. */
export type ViroSpecsScaledNode = ViroSpecsSceneNodeBase & {
  scale?: [number, number, number];
};

/** A flat surface measured in meters. Scale does not apply to these. */
export type ViroSpecsSizedNode = ViroSpecsSceneNodeBase & {
  sizeMeters?: [number, number];
};

export type ViroSpecsSceneNode =
  | (ViroSpecsScaledNode & { kind: "group" })
  | (ViroSpecsScaledNode & { kind: "text"; text: string })
  | (ViroSpecsScaledNode & { kind: "model"; source: string })
  | (ViroSpecsSizedNode & { kind: "image"; source: string; fit?: ViroSpecsSurfaceFit })
  | (ViroSpecsSizedNode & { kind: "video"; source: string; fit?: ViroSpecsSurfaceFit })
  | (ViroSpecsSizedNode & { kind: "panel"; tint?: ViroSpecsColor; cornerRadiusMeters?: number })
  | (ViroSpecsSizedNode & { kind: "surface"; tint?: ViroSpecsColor; cornerRadiusMeters?: number })
  | (ViroSpecsSizedNode & { kind: "scroll" });

export type ViroSpecsSceneSnapshot = {
  version: 1;
  nodes: ViroSpecsSceneNode[];
};

export type ViroSpecsRenderPrimitive =
  | "scene-object"
  | "text"
  | "image"
  | "render-mesh"
  | "ui-frame"
  | "flat-surface"
  | "scroll-window"
  | "video-surface";

export type ViroSpecsRenderDiagnostic = {
  level: "warning" | "error";
  nodeId?: string;
  message: string;
};

export type ViroSpecsRenderCommand =
  | {
      op: "create";
      id: string;
      parentId?: string;
      primitive: ViroSpecsRenderPrimitive;
    }
  | {
      op: "transform";
      id: string;
      position?: [number, number, number];
      rotation?: [number, number, number, number];
      /** Unitless multiplier. Mutually exclusive with `sizeMeters`. */
      scale?: [number, number, number];
      /** `[width, height]` in meters, for surfaces laid out by size. */
      sizeMeters?: [number, number];
    }
  | {
      op: "content";
      id: string;
      text?: string;
      source?: string;
      fit?: ViroSpecsSurfaceFit;
      tint?: ViroSpecsColor;
      cornerRadiusMeters?: number;
    }
  | {
      op: "visibility";
      id: string;
      visible: boolean;
    };

export type ViroSpecsRenderPlan = {
  version: 1;
  commands: ViroSpecsRenderCommand[];
  diagnostics: ViroSpecsRenderDiagnostic[];
};

export type ViroSpecsAnimationEasing =
  | "linear"
  | "ease-in"
  | "ease-out"
  | "ease-in-out"
  | { cubicBezier: [number, number, number, number] };

export type ViroSpecsAnimationTrackTarget =
  | "transform.position.x"
  | "transform.position.y"
  | "transform.position.z"
  | "transform.scale.x"
  | "transform.scale.y"
  | "transform.scale.z"
  | "transform.rotation.x"
  | "transform.rotation.y"
  | "transform.rotation.z"
  | "material.opacity";

export type ViroSpecsAnimationTrackPlan = {
  target: ViroSpecsAnimationTrackTarget;
  from: "current";
  to: number;
};

export type ViroSpecsNativeAnimationPlan = {
  engine: "AnimationPlayer";
  backendPackage: "AnimationExamples";
  durationSeconds: number;
  delaySeconds: number;
  easing: ViroSpecsAnimationEasing;
  playbackMode: "single" | "loop";
  completionEvent: string;
  tracks: ViroSpecsAnimationTrackPlan[];
};

export type ViroSpecsInteractionSource =
  | "gaze"
  | "hand"
  | "pinch"
  | "controller"
  | "voice"
  | "touch"
  | "neural-band";

export type ViroSpecsInteractionPhase =
  | "hover-enter"
  | "hover-move"
  | "hover-exit"
  | "select-start"
  | "select-end"
  | "drag"
  | "cancel";

export type ViroSpecsPortableInteraction = {
  source: ViroSpecsInteractionSource;
  phase: ViroSpecsInteractionPhase;
  targetId?: string;
  position?: [number, number, number];
  direction?: [number, number, number];
  timestampMs?: number;
};

export type ViroSpecsSurfaceClassification =
  | "floor"
  | "wall"
  | "ceiling"
  | "table"
  | "seat"
  | "unknown";

export type ViroSpecsWorldQueryRequest = {
  origin: [number, number, number];
  direction: [number, number, number];
  maxDistance?: number;
  classifications?: readonly ViroSpecsSurfaceClassification[];
};

export type ViroSpecsARHitTestResult = {
  position: [number, number, number];
  normal?: [number, number, number];
  distance: number;
  surface: ViroSpecsSurfaceClassification;
  confidence?: number;
};

export type ViroSpecsSurfacePlacementMode =
  | "near-surface"
  | "horizontal"
  | "vertical";

export type ViroSpecsPlacementPose = {
  position: [number, number, number];
  rotation: [number, number, number, number];
  surface?: ViroSpecsSurfaceClassification;
};

export type ViroSpecsGeoCoordinate = {
  latitude: number;
  longitude: number;
  altitudeMeters?: number;
};

export type ViroSpecsNavigationPlace = {
  id: string;
  name?: string;
  coordinate: ViroSpecsGeoCoordinate;
};

export type ViroSpecsNavigationRoute = {
  id: string;
  points: readonly ViroSpecsGeoCoordinate[];
  destination?: ViroSpecsNavigationPlace;
};

export type ViroSpecsNavigationPlan = {
  route: ViroSpecsNavigationRoute;
  line: {
    widthMeters: number;
    verticalOffsetMeters?: number;
    materialId?: string;
  };
  packages: readonly ["SpecsNavigationKit", "VolumetricLine"];
};

export type ViroSpecsVolumetricLinePlan = {
  primitive: "volumetric-line";
  backendPackage: "VolumetricLine";
  points: readonly [number, number, number][];
  radiusMeters: number;
  materialId?: string;
};

export type ViroSpecsCapabilityState =
  | "supported"
  | "unsupported"
  | "permission-required"
  | "temporarily-unavailable"
  | "unverified";

export type ViroSpecsCapabilityReport = Record<
  string,
  ViroSpecsCapabilityState
>;

/** Kinds whose variant declares `source` as required. */
const SOURCE_REQUIRED: readonly string[] = ["model", "image", "video"];

const PRIMITIVES: Record<ViroSpecsNodeKind, ViroSpecsRenderPrimitive> = {
  group: "scene-object",
  text: "text",
  image: "image",
  model: "render-mesh",
  panel: "ui-frame",
  surface: "flat-surface",
  scroll: "scroll-window",
  video: "video-surface",
};

export function compileLensRenderPlan(
  scene: ViroSpecsSceneSnapshot
): ViroSpecsRenderPlan {
  const commands: ViroSpecsRenderCommand[] = [];
  const diagnostics: ViroSpecsRenderDiagnostic[] = [];
  const ids = new Set<string>();

  for (const node of scene.nodes) {
    if (ids.has(node.id)) {
      diagnostics.push({
        level: "error",
        nodeId: node.id,
        message: "Duplicate portable XR node id.",
      });
      continue;
    }
    ids.add(node.id);

    const source = "source" in node ? node.source : undefined;
    if (SOURCE_REQUIRED.indexOf(node.kind) >= 0 && !source) {
      diagnostics.push({
        level: "error",
        nodeId: node.id,
        message: node.kind + " nodes require a source asset.",
      });
      continue;
    }

    commands.push({
      op: "create",
      id: node.id,
      ...(node.parentId ? { parentId: node.parentId } : {}),
      primitive: PRIMITIVES[node.kind],
    });

    const scale = "scale" in node ? node.scale : undefined;
    const sizeMeters = "sizeMeters" in node ? node.sizeMeters : undefined;
    if (node.position || node.rotation || scale || sizeMeters) {
      commands.push({
        op: "transform",
        id: node.id,
        ...(node.position ? { position: node.position } : {}),
        ...(node.rotation ? { rotation: node.rotation } : {}),
        ...(scale ? { scale } : {}),
        ...(sizeMeters ? { sizeMeters } : {}),
      });
    }

    const text = node.kind === "text" ? node.text : undefined;
    const fit = "fit" in node ? node.fit : undefined;
    const tint = "tint" in node ? node.tint : undefined;
    const cornerRadiusMeters =
      "cornerRadiusMeters" in node ? node.cornerRadiusMeters : undefined;
    if (text !== undefined || source !== undefined || tint !== undefined) {
      commands.push({
        op: "content",
        id: node.id,
        ...(text !== undefined ? { text } : {}),
        ...(source !== undefined ? { source } : {}),
        ...(fit !== undefined ? { fit } : {}),
        ...(tint !== undefined ? { tint } : {}),
        ...(cornerRadiusMeters !== undefined ? { cornerRadiusMeters } : {}),
      });
    }

    if (node.visible !== undefined) {
      commands.push({
        op: "visibility",
        id: node.id,
        visible: node.visible,
      });
    }
  }

  for (const node of scene.nodes) {
    if (node.parentId && !ids.has(node.parentId)) {
      diagnostics.push({
        level: "warning",
        nodeId: node.id,
        message: "Parent " + node.parentId + " is not present in the scene.",
      });
    }
  }

  return { version: VIRO_SPECS_WIRE_VERSION, commands, diagnostics };
}
