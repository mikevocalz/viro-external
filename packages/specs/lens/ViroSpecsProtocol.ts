/**
 * Dependency-free wire protocol consumed inside Lens Studio.
 *
 * Keep this file free of npm/workspace imports. The shared TypeScript compiler
 * produces structurally compatible payloads; Lens Studio only needs these
 * serialized shapes and official .lspkg dependencies.
 */
export const VIRO_SPECS_WIRE_VERSION = 1 as const;

/**
 * Scene protocols ViroSpecsSceneController reads. Protocol 1 is
 * {@linkcode ViroSpecsSceneSnapshot}; protocol 2 is
 * {@linkcode ViroSpecsSceneDocumentV2}, which carries text style, extents,
 * maxLines, opacity, materials and lights. Anything else is rejected with
 * host diagnostic VS5001 before the live scene is touched.
 */
export const VIRO_SPECS_SCENE_PROTOCOLS = [1, 2] as const;

/** One of {@linkcode VIRO_SPECS_SCENE_PROTOCOLS}. */
export type ViroSpecsSceneProtocol = (typeof VIRO_SPECS_SCENE_PROTOCOLS)[number];

/** `[x, y, z]`. */
export type ViroSpecsVec3 = [number, number, number];

/** Unit quaternion `[x, y, z, w]`. */
export type ViroSpecsQuat = [number, number, number, number];

/** Width and height in meters. */
export type ViroSpecsExtents = { width: number; height: number };

/**
 * Text style from manifest v2 (`ViroText` `style`). `fontSize` is in Viro
 * points; colors are `#RRGGBB` or `#RRGGBBAA`.
 */
export type ViroSpecsDocumentTextStyle = {
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: "normal" | "bold" | "100" | "200" | "300" | "400" | "500" | "600" | "700" | "800" | "900";
  fontStyle?: "normal" | "italic";
  color?: string;
  textAlign?: "left" | "center" | "right";
  textAlignVertical?: "top" | "center" | "bottom";
};

/** Fields every protocol 2 node kind shares. */
export type ViroSpecsDocumentNodeBase = {
  id: string;
  parentId?: string;
  position?: ViroSpecsVec3;
  rotation?: ViroSpecsQuat;
  scale?: ViroSpecsVec3;
  visible?: boolean;
  /** 0 to 1. */
  opacity?: number;
  /** Entry in `materials`, or a material in the Lens asset registry. */
  materialId?: string;
};

/** Protocol 2 node, discriminated by `kind`. Video and sound never reach the wire. */
export type ViroSpecsDocumentNode =
  | (ViroSpecsDocumentNodeBase & { kind: "group"; scroll?: ViroSpecsScroll })
  | (ViroSpecsDocumentNodeBase & {
      kind: "text";
      text: string;
      style?: ViroSpecsDocumentTextStyle;
      extents?: ViroSpecsExtents;
      maxLines?: number;
    })
  | (ViroSpecsDocumentNodeBase & { kind: "image"; source: string; extents?: ViroSpecsExtents })
  | (ViroSpecsDocumentNodeBase & { kind: "model"; source: string; format?: "glb" | "gltf" | "obj" | "fbx" })
  | (ViroSpecsDocumentNodeBase & { kind: "panel"; extents?: ViroSpecsExtents });

/** World-space line, meters. */
export type ViroSpecsDocumentPolyline = {
  id: string;
  points: ViroSpecsVec3[];
  radiusMeters: number;
  materialId?: string;
  primitive?: "volumetric-line";
  backendPackage?: string;
};

/** Light from a Viro light component. Intensity in Viro lumens (1000 = default). */
export type ViroSpecsDocumentLight = {
  id: string;
  parentId?: string;
  color?: string;
  intensity?: number;
} & (
  | { type: "ambient" }
  | { type: "directional"; direction: ViroSpecsVec3 }
  | { type: "omni"; position: ViroSpecsVec3 }
  | { type: "spot"; position: ViroSpecsVec3; direction: ViroSpecsVec3; innerAngle?: number; outerAngle?: number }
);

/** Material definition. The host builds an owned material from it. */
export type ViroSpecsDocumentMaterial = {
  id: string;
  color?: string;
  opacity?: number;
  /** Image asset ID. */
  texture?: string;
  lightingModel?: "constant" | "lambert" | "blinn" | "phong" | "pbr";
};

/** Value type of one action payload field. `integer` is a whole `number`. */
export type ViroSpecsActionFieldType = "string" | "number" | "integer" | "boolean";

/** One field of an action payload declaration. */
export type ViroSpecsActionField = {
  type: ViroSpecsActionFieldType;
  /** Allowed values. Only valid on `string` fields. */
  enum?: string[];
  /** When true the field may be absent. Default false. */
  optional?: boolean;
};

/**
 * Declares one semantic action: a stable ID and the type of its payload.
 * IDs match {@linkcode VIRO_SPECS_ACTION_ID_PATTERN}, for example
 * `exhibit.open`. A payload is a flat object of strings, numbers and
 * booleans, so it crosses any transport as JSON and never carries a closure.
 */
export type ViroSpecsActionDeclaration = {
  id: string;
  /** Field name to type. Absent means the action takes an empty payload. */
  payload?: Record<string, ViroSpecsActionField>;
};

/** Lowercase dot-separated segments: `exhibit.open`, `settings.set-units`. */
export const VIRO_SPECS_ACTION_ID_PATTERN = /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)*$/;

/** A payload value. */
export type ViroSpecsActionValue = string | number | boolean;

/** An action payload: flat, JSON-safe. */
export type ViroSpecsActionPayload = Record<string, ViroSpecsActionValue>;

/** Interaction moment that fires a trigger. `select` is a completed pinch or click. */
export type ViroSpecsActionTriggerEvent = "select" | "hover-enter" | "hover-exit";

/** Fires a declared action with a fixed payload when its node sees `on`. */
export type ViroSpecsActionTrigger = {
  on: ViroSpecsActionTriggerEvent;
  actionId: string;
  /** Checked against the action's declaration. Absent means `{}`. */
  payload?: ViroSpecsActionPayload;
};

/** Interaction intent for one node. */
export type ViroSpecsDocumentInteraction = {
  nodeId: string;
  interactable: true;
  manipulation: boolean;
  events: ("hover" | "select" | "drag")[];
  /** Actions this node fires. `select` needs `select` in `events`, hover triggers need `hover`. */
  triggers?: ViroSpecsActionTrigger[];
};

/**
 * A typed action raised by a trigger on the committed scene, or dispatched
 * by app code. Delivered by `ViroSpecsSceneController.addOnActionListener`
 * one frame after the interaction, and only if the scene that showed the
 * node is still committed.
 */
export type ViroSpecsActionEvent = {
  actionId: string;
  payload: ViroSpecsActionPayload;
  /** Node whose trigger fired. Absent for app-dispatched actions. */
  nodeId?: string;
  /** Interaction moment. Absent for app-dispatched actions. */
  on?: ViroSpecsActionTriggerEvent;
  source?: ViroSpecsHostInteractionSource;
  /** Revision of the scene the wearer interacted with. */
  sceneRevision: number;
  timestampMs: number;
};

/** Animation on one node. `plan.backendPackage` is optional on the wire. */
export type ViroSpecsDocumentAnimation = {
  nodeId: string;
  name: string;
  plan: Omit<ViroSpecsNativeAnimationPlan, "backendPackage" | "easing"> & {
    backendPackage?: string;
    easing: ViroSpecsAnimationEasing;
  };
};

/**
 * Scene protocol 2: the manifest v2 document minus authoring metadata and
 * the media kinds no host plays. One document describes one scene; the
 * controller diffs consecutive documents by ID.
 */
export type ViroSpecsSceneDocumentV2 = {
  version: 2;
  /**
   * Route the scene belongs to, for example `list` or `details`. When an
   * update names a different route than the committed scene, the controller
   * navigates (transactional replacement) instead of patching, and restores
   * the scroll positions it remembered for the route it returns to.
   */
  route?: string;
  /** Actions the scene's triggers fire. Required when any trigger exists. */
  actions?: ViroSpecsActionDeclaration[];
  nodes: ViroSpecsDocumentNode[];
  polylines?: ViroSpecsDocumentPolyline[];
  lights?: ViroSpecsDocumentLight[];
  materials?: ViroSpecsDocumentMaterial[];
  interactions?: ViroSpecsDocumentInteraction[];
  animations?: ViroSpecsDocumentAnimation[];
};

/** Interaction sources the host reports. */
export type ViroSpecsHostInteractionSource = "hand-left" | "hand-right" | "gaze" | "synthetic";

/**
 * Interaction event the controller delivers. Positions, normals and
 * directions are world space; positions are meters.
 */
export type ViroSpecsHostInteraction = {
  nodeId: string;
  phase: ViroSpecsInteractionPhase;
  source: ViroSpecsHostInteractionSource;
  position?: ViroSpecsVec3;
  normal?: ViroSpecsVec3;
  direction?: ViroSpecsVec3;
  timestampMs: number;
  /** Revision of the scene that owned the node when the event fired. */
  sceneRevision: number;
};

export type ViroSpecsNodeKind =
  | "group"
  | "text"
  | "image"
  | "model"
  | "panel";

/** Mirrors PortableXRTextStyle: size in Lens points, color linear RGBA 0..1. */
export type ViroSpecsTextStyle = {
  size?: number;
  color?: [number, number, number, number];
};

/** Mirrors PortableXRScroll: metres; children use y = 0 at the content top, negative down. */
export type ViroSpecsScroll = {
  width: number;
  height: number;
  contentHeight: number;
};

export type ViroSpecsSceneNode = {
  id: string;
  kind: ViroSpecsNodeKind;
  parentId?: string;
  position?: [number, number, number];
  rotation?: [number, number, number, number];
  scale?: [number, number, number];
  source?: string;
  text?: string;
  textStyle?: ViroSpecsTextStyle;
  scroll?: ViroSpecsScroll;
  visible?: boolean;
};

export type ViroSpecsSceneSnapshot = {
  version: 1;
  nodes: ViroSpecsSceneNode[];
};

export type ViroSpecsRenderPrimitive =
  | "scene-object"
  | "text"
  | "image"
  | "render-mesh"
  | "ui-frame";

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
      scale?: [number, number, number];
    }
  | {
      op: "content";
      id: string;
      text?: string;
      source?: string;
      textStyle?: ViroSpecsTextStyle;
      scroll?: ViroSpecsScroll;
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
  /** Surface normal at the hit, world space. */
  normal?: [number, number, number];
  direction?: [number, number, number];
  timestampMs?: number;
  /** Which hand, gaze or synthetic input produced the event. */
  inputSource?: ViroSpecsHostInteractionSource;
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

const PRIMITIVES: Record<ViroSpecsNodeKind, ViroSpecsRenderPrimitive> = {
  group: "scene-object",
  text: "text",
  image: "image",
  model: "render-mesh",
  panel: "ui-frame",
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

    if (node.kind === "model" && !node.source) {
      diagnostics.push({
        level: "error",
        nodeId: node.id,
        message: "Model nodes require a source asset.",
      });
      continue;
    }

    commands.push({
      op: "create",
      id: node.id,
      ...(node.parentId ? { parentId: node.parentId } : {}),
      primitive: PRIMITIVES[node.kind],
    });

    if (node.position || node.rotation || node.scale) {
      commands.push({
        op: "transform",
        id: node.id,
        ...(node.position ? { position: node.position } : {}),
        ...(node.rotation ? { rotation: node.rotation } : {}),
        ...(node.scale ? { scale: node.scale } : {}),
      });
    }

    if (node.text !== undefined || node.source !== undefined || node.textStyle || node.scroll) {
      commands.push({
        op: "content",
        id: node.id,
        ...(node.text !== undefined ? { text: node.text } : {}),
        ...(node.source !== undefined ? { source: node.source } : {}),
        ...(node.textStyle ? { textStyle: node.textStyle } : {}),
        ...(node.scroll ? { scroll: node.scroll } : {}),
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
