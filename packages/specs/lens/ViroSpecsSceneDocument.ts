/**
 * Validation and normalization of scene input at the Lens boundary.
 *
 * Every path into ViroSpecsSceneController goes through
 * {@linkcode readViroSpecsSceneInput}: raw JSON from a transport, a generated
 * host constant, or a protocol 1 snapshot. Nothing reaches the live scene
 * until the whole document validates, so a bad payload can never leave a
 * half-built page.
 *
 * Dependency-free and free of Lens globals.
 */
import {
  VIRO_SPECS_SCENE_PROTOCOLS,
  type ViroSpecsDocumentAnimation,
  type ViroSpecsDocumentInteraction,
  type ViroSpecsDocumentLight,
  type ViroSpecsDocumentMaterial,
  type ViroSpecsDocumentNode,
  type ViroSpecsDocumentPolyline,
  type ViroSpecsDocumentTextStyle,
  type ViroSpecsActionDeclaration,
  type ViroSpecsSceneProtocol,
  type ViroSpecsScroll,
  type ViroSpecsTextStyle,
} from "./ViroSpecsProtocol";
import {
  createViroSpecsHostDiagnostic,
  type ViroSpecsHostDiagnostic,
  type ViroSpecsHostDiagnosticCode,
} from "./ViroSpecsHostDiagnostics";
import { checkViroSpecsActionDeclaration, checkViroSpecsActionPayload } from "./ViroSpecsActionContract";

/** A node after validation. Protocol 1 text keeps its Lens-unit style. */
export type ViroSpecsHostNode = ViroSpecsDocumentNode & {
  /** Protocol 1 `textStyle` (Lens points, RGBA 0..1). Only on text nodes read from protocol 1. */
  legacyTextStyle?: ViroSpecsTextStyle;
};

/** A validated scene, parents ordered before children. */
export type ViroSpecsHostScene = {
  protocol: ViroSpecsSceneProtocol;
  /** Route key; navigation between routes is a replacement. */
  route?: string;
  /** Declared actions, empty when the scene has no triggers. */
  actions: ViroSpecsActionDeclaration[];
  nodes: ViroSpecsHostNode[];
  polylines: ViroSpecsDocumentPolyline[];
  lights: ViroSpecsDocumentLight[];
  materials: ViroSpecsDocumentMaterial[];
  interactions: ViroSpecsDocumentInteraction[];
  animations: ViroSpecsDocumentAnimation[];
};

/** Result of {@linkcode readViroSpecsSceneInput}. */
export type ViroSpecsSceneReadResult =
  | { ok: true; scene: ViroSpecsHostScene }
  | { ok: false; diagnostics: ViroSpecsHostDiagnostic[] };

type Json = Record<string, unknown>;

const NODE_KINDS = new Set(["group", "text", "image", "model", "panel"]);
const BASE_FIELDS = ["id", "kind", "parentId", "position", "rotation", "scale", "visible", "opacity", "materialId"];
const KIND_FIELDS: Record<string, readonly string[]> = {
  group: ["scroll"],
  text: ["text", "style", "extents", "maxLines"],
  image: ["source", "extents"],
  model: ["source", "format"],
  panel: ["extents"],
};
const V1_FIELDS = ["id", "kind", "parentId", "position", "rotation", "scale", "source", "text", "textStyle", "scroll", "visible"];
const STYLE_FIELDS = ["fontFamily", "fontSize", "fontWeight", "fontStyle", "color", "textAlign", "textAlignVertical"];
const FONT_WEIGHTS = new Set(["normal", "bold", "100", "200", "300", "400", "500", "600", "700", "800", "900"]);
const MODEL_FORMATS = new Set(["glb", "gltf", "obj", "fbx"]);
const LIGHTING_MODELS = new Set(["constant", "lambert", "blinn", "phong", "pbr"]);
const EASINGS = new Set(["linear", "ease-in", "ease-out", "ease-in-out"]);
const TRACK_TARGETS = new Set([
  "transform.position.x", "transform.position.y", "transform.position.z",
  "transform.scale.x", "transform.scale.y", "transform.scale.z",
  "transform.rotation.x", "transform.rotation.y", "transform.rotation.z",
  "material.opacity",
]);
const COLOR = /^#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

class Checker {
  readonly diagnostics: ViroSpecsHostDiagnostic[] = [];
  constructor(private readonly revision: number) {}

  fail(path: string, message: string, nodeId?: string, code: ViroSpecsHostDiagnosticCode = "VS5002"): void {
    this.diagnostics.push(
      createViroSpecsHostDiagnostic(code, "validate", message, {
        fieldPath: path,
        sceneRevision: this.revision,
        ...(nodeId !== undefined ? { nodeId } : {}),
      })
    );
  }

  object(value: unknown, path: string): value is Json {
    if (typeof value === "object" && value !== null && !Array.isArray(value)) return true;
    this.fail(path, "Expected an object.");
    return false;
  }

  only(value: Json, allowed: readonly string[], path: string, nodeId?: string): void {
    for (const key of Object.keys(value)) {
      if (!allowed.includes(key)) this.fail(path + "/" + key, "Unknown field `" + key + "`.", nodeId);
    }
  }

  string(value: unknown, path: string, nodeId?: string): value is string {
    if (typeof value === "string" && value.length > 0) return true;
    this.fail(path, "Expected a non-empty string.", nodeId);
    return false;
  }

  optionalString(value: unknown, path: string, nodeId?: string): void {
    if (value !== undefined) this.string(value, path, nodeId);
  }

  number(value: unknown, path: string, range: { min?: number; max?: number; exclusiveMin?: number }, nodeId?: string): value is number {
    const ok =
      typeof value === "number" &&
      Number.isFinite(value) &&
      (range.min === undefined || value >= range.min) &&
      (range.max === undefined || value <= range.max) &&
      (range.exclusiveMin === undefined || value > range.exclusiveMin);
    if (!ok) this.fail(path, "Expected a finite number" + describeRange(range) + ".", nodeId);
    return ok;
  }

  boolean(value: unknown, path: string, nodeId?: string): void {
    if (typeof value !== "boolean") this.fail(path, "Expected a boolean.", nodeId);
  }

  vector(value: unknown, length: number, path: string, nodeId?: string): void {
    if (
      !Array.isArray(value) ||
      value.length !== length ||
      !value.every((n) => typeof n === "number" && Number.isFinite(n))
    ) {
      this.fail(path, "Expected " + length + " finite numbers.", nodeId);
    }
  }

  oneOf(value: unknown, allowed: ReadonlySet<string>, path: string, nodeId?: string): void {
    if (typeof value !== "string" || !allowed.has(value)) {
      this.fail(path, "Expected one of: " + Array.from(allowed).join(", ") + ".", nodeId);
    }
  }

  color(value: unknown, path: string, nodeId?: string): void {
    if (typeof value !== "string" || !COLOR.test(value)) this.fail(path, "Expected #RRGGBB or #RRGGBBAA.", nodeId);
  }

  extents(value: unknown, path: string, nodeId?: string): void {
    if (!this.object(value, path)) return;
    this.only(value, ["width", "height"], path, nodeId);
    this.number(value.width, path + "/width", { exclusiveMin: 0 }, nodeId);
    this.number(value.height, path + "/height", { exclusiveMin: 0 }, nodeId);
  }

  array(value: unknown, path: string): unknown[] {
    if (value === undefined) return [];
    if (Array.isArray(value)) return value;
    this.fail(path, "Expected an array.");
    return [];
  }
}

function describeRange(range: { min?: number; max?: number; exclusiveMin?: number }): string {
  const parts: string[] = [];
  if (range.min !== undefined) parts.push(">= " + range.min);
  if (range.exclusiveMin !== undefined) parts.push("> " + range.exclusiveMin);
  if (range.max !== undefined) parts.push("<= " + range.max);
  return parts.length ? " " + parts.join(" and ") : "";
}

function checkStyle(c: Checker, value: unknown, path: string, nodeId: string): void {
  if (!c.object(value, path)) return;
  c.only(value, STYLE_FIELDS, path, nodeId);
  c.optionalString(value.fontFamily, path + "/fontFamily", nodeId);
  if (value.fontSize !== undefined) c.number(value.fontSize, path + "/fontSize", { exclusiveMin: 0, max: 1000 }, nodeId);
  if (value.fontWeight !== undefined) c.oneOf(value.fontWeight, FONT_WEIGHTS, path + "/fontWeight", nodeId);
  if (value.fontStyle !== undefined) c.oneOf(value.fontStyle, new Set(["normal", "italic"]), path + "/fontStyle", nodeId);
  if (value.color !== undefined) c.color(value.color, path + "/color", nodeId);
  if (value.textAlign !== undefined) c.oneOf(value.textAlign, new Set(["left", "center", "right"]), path + "/textAlign", nodeId);
  if (value.textAlignVertical !== undefined) {
    c.oneOf(value.textAlignVertical, new Set(["top", "center", "bottom"]), path + "/textAlignVertical", nodeId);
  }
}

function checkScroll(c: Checker, value: unknown, path: string, nodeId: string): void {
  if (!c.object(value, path)) return;
  c.only(value, ["width", "height", "contentHeight"], path, nodeId);
  c.number(value.width, path + "/width", { exclusiveMin: 0, max: 10 }, nodeId);
  c.number(value.height, path + "/height", { exclusiveMin: 0, max: 10 }, nodeId);
  c.number(value.contentHeight, path + "/contentHeight", { min: 0 }, nodeId);
}

function checkLegacyTextStyle(c: Checker, value: unknown, path: string, nodeId: string): void {
  if (!c.object(value, path)) return;
  c.only(value, ["size", "color"], path, nodeId);
  if (value.size !== undefined) c.number(value.size, path + "/size", { exclusiveMin: 0, max: 1000 }, nodeId);
  if (value.color !== undefined) {
    c.vector(value.color, 4, path + "/color", nodeId);
    if (Array.isArray(value.color) && value.color.some((n) => typeof n !== "number" || n < 0 || n > 1)) {
      c.fail(path + "/color", "Color channels must be between 0 and 1.", nodeId);
    }
  }
}

function checkBase(c: Checker, node: Json, path: string, id: string): void {
  if (node.parentId !== undefined) c.string(node.parentId, path + "/parentId", id);
  if (node.position !== undefined) c.vector(node.position, 3, path + "/position", id);
  if (node.rotation !== undefined) c.vector(node.rotation, 4, path + "/rotation", id);
  if (node.scale !== undefined) c.vector(node.scale, 3, path + "/scale", id);
  if (node.visible !== undefined) c.boolean(node.visible, path + "/visible", id);
}

function checkNodeV2(c: Checker, node: Json, path: string, id: string, kind: string): void {
  c.only(node, BASE_FIELDS.concat(KIND_FIELDS[kind] ?? []), path, id);
  checkBase(c, node, path, id);
  if (node.opacity !== undefined) c.number(node.opacity, path + "/opacity", { min: 0, max: 1 }, id);
  if (node.materialId !== undefined) c.string(node.materialId, path + "/materialId", id);
  switch (kind) {
    case "group":
      if (node.scroll !== undefined) checkScroll(c, node.scroll, path + "/scroll", id);
      return;
    case "text":
      if (typeof node.text !== "string") c.fail(path + "/text", "Text nodes need a string `text`.", id);
      if (node.style !== undefined) checkStyle(c, node.style, path + "/style", id);
      if (node.extents !== undefined) c.extents(node.extents, path + "/extents", id);
      if (node.maxLines !== undefined && !(Number.isInteger(node.maxLines) && (node.maxLines as number) > 0)) {
        c.fail(path + "/maxLines", "Expected a positive integer.", id);
      }
      return;
    case "image":
      c.string(node.source, path + "/source", id);
      if (node.extents !== undefined) c.extents(node.extents, path + "/extents", id);
      return;
    case "model":
      c.string(node.source, path + "/source", id);
      if (node.format !== undefined) c.oneOf(node.format, MODEL_FORMATS, path + "/format", id);
      return;
    case "panel":
      if (node.extents !== undefined) c.extents(node.extents, path + "/extents", id);
      return;
  }
}

function checkNodeV1(c: Checker, node: Json, path: string, id: string, kind: string): void {
  c.only(node, V1_FIELDS, path, id);
  checkBase(c, node, path, id);
  if (node.text !== undefined && kind !== "text") c.fail(path + "/text", "`text` is only valid on text nodes.", id);
  if (kind === "text" && node.text !== undefined && typeof node.text !== "string") c.fail(path + "/text", "Expected a string.", id);
  if (node.source !== undefined && kind !== "image" && kind !== "model") {
    c.fail(path + "/source", "`source` is only valid on image and model nodes.", id);
  }
  if ((kind === "image" || kind === "model") && !(typeof node.source === "string" && node.source.length > 0)) {
    c.fail(path + "/source", kind + " nodes need a source asset ID.", id);
  }
  if (node.textStyle !== undefined) {
    if (kind !== "text") c.fail(path + "/textStyle", "`textStyle` is only valid on text nodes.", id);
    else checkLegacyTextStyle(c, node.textStyle, path + "/textStyle", id);
  }
  if (node.scroll !== undefined) {
    if (kind !== "group") c.fail(path + "/scroll", "`scroll` is only valid on group nodes.", id);
    else checkScroll(c, node.scroll, path + "/scroll", id);
  }
}

function upgradeV1Node(node: Json): ViroSpecsHostNode {
  const base = {
    id: node.id as string,
    ...(node.parentId !== undefined ? { parentId: node.parentId as string } : {}),
    ...(node.position !== undefined ? { position: node.position as [number, number, number] } : {}),
    ...(node.rotation !== undefined ? { rotation: node.rotation as [number, number, number, number] } : {}),
    ...(node.scale !== undefined ? { scale: node.scale as [number, number, number] } : {}),
    ...(node.visible !== undefined ? { visible: node.visible as boolean } : {}),
  };
  switch (node.kind) {
    case "text":
      return {
        ...base,
        kind: "text",
        text: (node.text as string | undefined) ?? "",
        ...(node.textStyle !== undefined ? { legacyTextStyle: node.textStyle as ViroSpecsTextStyle } : {}),
      };
    case "image":
      return { ...base, kind: "image", source: node.source as string };
    case "model":
      return { ...base, kind: "model", source: node.source as string };
    case "panel":
      return { ...base, kind: "panel" };
    default:
      return { ...base, kind: "group", ...(node.scroll !== undefined ? { scroll: node.scroll as ViroSpecsScroll } : {}) };
  }
}

function checkPolyline(c: Checker, value: unknown, path: string): void {
  if (!c.object(value, path)) return;
  const id = typeof value.id === "string" ? value.id : undefined;
  c.only(value, ["id", "points", "radiusMeters", "materialId", "primitive", "backendPackage"], path, id);
  c.string(value.id, path + "/id", id);
  if (!Array.isArray(value.points) || value.points.length < 2) {
    c.fail(path + "/points", "A polyline needs at least two points.", id);
  } else {
    value.points.forEach((p, i) => c.vector(p, 3, path + "/points/" + i, id));
  }
  c.number(value.radiusMeters, path + "/radiusMeters", { exclusiveMin: 0 }, id);
  if (value.materialId !== undefined) c.string(value.materialId, path + "/materialId", id);
  if (value.primitive !== undefined && value.primitive !== "volumetric-line") {
    c.fail(path + "/primitive", "Expected volumetric-line.", id);
  }
  c.optionalString(value.backendPackage, path + "/backendPackage", id);
}

function checkLight(c: Checker, value: unknown, path: string): void {
  if (!c.object(value, path)) return;
  const id = typeof value.id === "string" ? value.id : undefined;
  c.string(value.id, path + "/id", id);
  if (value.parentId !== undefined) c.string(value.parentId, path + "/parentId", id);
  if (value.color !== undefined) c.color(value.color, path + "/color", id);
  if (value.intensity !== undefined) c.number(value.intensity, path + "/intensity", { min: 0 }, id);
  const common = ["id", "type", "parentId", "color", "intensity"];
  switch (value.type) {
    case "ambient":
      c.only(value, common, path, id);
      return;
    case "directional":
      c.only(value, common.concat("direction"), path, id);
      c.vector(value.direction, 3, path + "/direction", id);
      return;
    case "omni":
      c.only(value, common.concat("position"), path, id);
      c.vector(value.position, 3, path + "/position", id);
      return;
    case "spot":
      c.only(value, common.concat("position", "direction", "innerAngle", "outerAngle"), path, id);
      c.vector(value.position, 3, path + "/position", id);
      c.vector(value.direction, 3, path + "/direction", id);
      if (value.innerAngle !== undefined) c.number(value.innerAngle, path + "/innerAngle", { min: 0, max: 180 }, id);
      if (value.outerAngle !== undefined) c.number(value.outerAngle, path + "/outerAngle", { min: 0, max: 180 }, id);
      return;
    default:
      c.fail(path + "/type", "Expected ambient, directional, omni or spot.", id);
  }
}

function checkMaterial(c: Checker, value: unknown, path: string): void {
  if (!c.object(value, path)) return;
  const id = typeof value.id === "string" ? value.id : undefined;
  c.only(value, ["id", "color", "opacity", "texture", "lightingModel"], path, id);
  c.string(value.id, path + "/id", id);
  if (value.color !== undefined) c.color(value.color, path + "/color", id);
  if (value.opacity !== undefined) c.number(value.opacity, path + "/opacity", { min: 0, max: 1 }, id);
  if (value.texture !== undefined) c.string(value.texture, path + "/texture", id);
  if (value.lightingModel !== undefined) c.oneOf(value.lightingModel, LIGHTING_MODELS, path + "/lightingModel", id);
}

function checkInteraction(
  c: Checker,
  value: unknown,
  path: string,
  nodes: ReadonlySet<string>,
  actions: ReadonlyMap<string, ViroSpecsActionDeclaration>
): void {
  if (!c.object(value, path)) return;
  const id = typeof value.nodeId === "string" ? value.nodeId : undefined;
  c.only(value, ["nodeId", "interactable", "manipulation", "events", "triggers"], path, id);
  if (c.string(value.nodeId, path + "/nodeId", id) && !nodes.has(value.nodeId)) {
    c.fail(path + "/nodeId", "Interaction names a node that is not in the scene.", id);
  }
  if (value.interactable !== true) c.fail(path + "/interactable", "Expected true.", id);
  c.boolean(value.manipulation, path + "/manipulation", id);
  const events = Array.isArray(value.events) ? value.events : undefined;
  if (!events || events.length === 0 || !events.every((e) => e === "hover" || e === "select" || e === "drag")) {
    c.fail(path + "/events", "Expected a non-empty list of hover, select, drag.", id);
  }
  if (value.triggers !== undefined) checkTriggers(c, value.triggers, path + "/triggers", id, events ?? [], actions);
}

const TRIGGER_EVENTS: Record<string, string> = { select: "select", "hover-enter": "hover", "hover-exit": "hover" };

function checkTriggers(
  c: Checker,
  value: unknown,
  path: string,
  nodeId: string | undefined,
  events: readonly unknown[],
  actions: ReadonlyMap<string, ViroSpecsActionDeclaration>
): void {
  if (!Array.isArray(value) || value.length === 0) {
    c.fail(path, "Expected a non-empty array of triggers.", nodeId);
    return;
  }
  value.forEach((trigger, i) => {
    const at = path + "/" + i;
    if (!c.object(trigger, at)) return;
    c.only(trigger, ["on", "actionId", "payload"], at, nodeId);
    const needs = typeof trigger.on === "string" ? TRIGGER_EVENTS[trigger.on] : undefined;
    if (needs === undefined) c.fail(at + "/on", "Expected select, hover-enter or hover-exit.", nodeId);
    else if (!events.includes(needs)) c.fail(at + "/on", "Trigger on " + String(trigger.on) + " needs `" + needs + "` in the interaction's events.", nodeId);
    if (typeof trigger.actionId !== "string") {
      c.fail(at + "/actionId", "Expected an action ID.", nodeId);
      return;
    }
    const declaration = actions.get(trigger.actionId);
    if (!declaration) {
      c.fail(at + "/actionId", "Action " + JSON.stringify(trigger.actionId) + " is not declared in the scene's actions.", nodeId, "VS5015");
      return;
    }
    for (const problem of checkViroSpecsActionPayload(declaration, trigger.payload)) {
      c.fail(at + "/payload" + problem.path, problem.message, nodeId, "VS5017");
    }
  });
}

function checkAnimation(c: Checker, value: unknown, path: string, nodes: ReadonlySet<string>): void {
  if (!c.object(value, path)) return;
  const id = typeof value.nodeId === "string" ? value.nodeId : undefined;
  c.only(value, ["nodeId", "name", "plan"], path, id);
  if (c.string(value.nodeId, path + "/nodeId", id) && !nodes.has(value.nodeId)) {
    c.fail(path + "/nodeId", "Animation names a node that is not in the scene.", id);
  }
  c.string(value.name, path + "/name", id);
  const plan = value.plan;
  if (!c.object(plan, path + "/plan")) return;
  const p = path + "/plan";
  c.only(plan, ["engine", "backendPackage", "durationSeconds", "delaySeconds", "easing", "playbackMode", "completionEvent", "tracks"], p, id);
  if (plan.engine !== "AnimationPlayer") c.fail(p + "/engine", "Expected AnimationPlayer.", id);
  c.optionalString(plan.backendPackage, p + "/backendPackage", id);
  c.number(plan.durationSeconds, p + "/durationSeconds", { min: 0 }, id);
  c.number(plan.delaySeconds, p + "/delaySeconds", { min: 0 }, id);
  const easing = plan.easing;
  const bezier =
    typeof easing === "object" && easing !== null && Array.isArray((easing as Json).cubicBezier) &&
    ((easing as Json).cubicBezier as unknown[]).length === 4;
  if (!bezier) c.oneOf(easing, EASINGS, p + "/easing", id);
  c.oneOf(plan.playbackMode, new Set(["single", "loop"]), p + "/playbackMode", id);
  c.string(plan.completionEvent, p + "/completionEvent", id);
  const tracks = Array.isArray(plan.tracks) ? plan.tracks : [];
  if (tracks.length === 0) c.fail(p + "/tracks", "An animation needs at least one track.", id);
  tracks.forEach((track, i) => {
    const tp = p + "/tracks/" + i;
    if (!c.object(track, tp)) return;
    c.only(track, ["target", "from", "to"], tp, id);
    c.oneOf(track.target, TRACK_TARGETS, tp + "/target", id);
    if (track.from !== "current") c.fail(tp + "/from", "Expected current.", id);
    c.number(track.to, tp + "/to", {}, id);
  });
}

/**
 * Orders nodes so every parent precedes its children, and reports missing
 * parents and cycles. Input order is kept where it already satisfies that.
 */
function orderNodes(c: Checker, nodes: ViroSpecsHostNode[]): ViroSpecsHostNode[] {
  const byId = new Map(nodes.map((n) => [n.id, n] as const));
  const ordered: ViroSpecsHostNode[] = [];
  const state = new Map<string, "visiting" | "done">();
  const visit = (node: ViroSpecsHostNode, chain: string[]): void => {
    const s = state.get(node.id);
    if (s === "done") return;
    if (s === "visiting") {
      c.fail("/nodes", "Parent cycle: " + chain.concat(node.id).join(" -> ") + ".", node.id);
      return;
    }
    state.set(node.id, "visiting");
    if (node.parentId !== undefined) {
      const parent = byId.get(node.parentId);
      if (!parent) c.fail("/nodes", "Parent " + JSON.stringify(node.parentId) + " is not in the scene.", node.id);
      else visit(parent, chain.concat(node.id));
    }
    state.set(node.id, "done");
    ordered.push(node);
  };
  for (const node of nodes) visit(node, []);
  return ordered;
}

/** Options for {@linkcode readViroSpecsSceneInput}. */
export type ViroSpecsSceneReadOptions = {
  /**
   * Accept `legacyTextStyle` on protocol 2 text nodes. Only the controller
   * sets it, when it re-validates a committed protocol 1 scene after a patch.
   */
  readonly allowLegacyTextStyle?: boolean;
};

/**
 * Validates scene input of either protocol and returns a normalized scene,
 * or the full list of problems. Never throws.
 *
 * @param input Parsed JSON: a protocol 2 document or a protocol 1 snapshot.
 * @param revision Scene revision recorded on diagnostics.
 */
export function readViroSpecsSceneInput(
  input: unknown,
  revision: number,
  options: ViroSpecsSceneReadOptions = {}
): ViroSpecsSceneReadResult {
  const c = new Checker(revision);
  if (!c.object(input, "")) return { ok: false, diagnostics: c.diagnostics };
  const version = input.version;
  if (!VIRO_SPECS_SCENE_PROTOCOLS.some((v) => v === version)) {
    return {
      ok: false,
      diagnostics: [
        createViroSpecsHostDiagnostic(
          "VS5001",
          "validate",
          "Scene protocol " + JSON.stringify(version) + " is not supported; this host reads " +
            VIRO_SPECS_SCENE_PROTOCOLS.join(" and ") + ".",
          { fieldPath: "/version", sceneRevision: revision }
        ),
      ],
    };
  }
  const protocol = version as ViroSpecsSceneProtocol;
  c.only(
    input,
    protocol === 1
      ? ["version", "nodes"]
      : ["version", "route", "actions", "nodes", "polylines", "lights", "materials", "interactions", "animations"],
    ""
  );

  const rawNodes = c.array(input.nodes, "/nodes");
  const nodes: ViroSpecsHostNode[] = [];
  const ids = new Set<string>();
  rawNodes.forEach((raw, index) => {
    const path = "/nodes/" + index;
    if (!c.object(raw, path)) return;
    if (!c.string(raw.id, path + "/id")) return;
    const id = raw.id;
    if (ids.has(id)) c.fail(path + "/id", "Duplicate ID " + JSON.stringify(id) + ".", id);
    ids.add(id);
    if (typeof raw.kind !== "string" || !NODE_KINDS.has(raw.kind)) {
      c.fail(path + "/kind", "Expected one of: group, text, image, model, panel.", id);
      return;
    }
    if (protocol === 1) {
      checkNodeV1(c, raw, path, id, raw.kind);
      nodes.push(upgradeV1Node(raw));
    } else {
      const legacy = options.allowLegacyTextStyle === true && raw.kind === "text" ? raw.legacyTextStyle : undefined;
      if (legacy !== undefined) {
        checkLegacyTextStyle(c, legacy, path + "/legacyTextStyle", id);
        const { legacyTextStyle: _legacy, ...rest } = raw;
        checkNodeV2(c, rest, path, id, raw.kind);
      } else {
        checkNodeV2(c, raw, path, id, raw.kind);
      }
      nodes.push(raw as ViroSpecsHostNode);
    }
  });

  const polylines = c.array(input.polylines, "/polylines");
  polylines.forEach((p, i) => {
    checkPolyline(c, p, "/polylines/" + i);
    const id = (p as Json | null)?.id;
    if (typeof id === "string") {
      if (ids.has(id)) c.fail("/polylines/" + i + "/id", "Duplicate ID " + JSON.stringify(id) + ".", id);
      ids.add(id);
    }
  });
  const lights = c.array(input.lights, "/lights");
  lights.forEach((l, i) => {
    checkLight(c, l, "/lights/" + i);
    const light = l as Json | null;
    const id = light?.id;
    if (typeof id === "string") {
      if (ids.has(id)) c.fail("/lights/" + i + "/id", "Duplicate ID " + JSON.stringify(id) + ".", id);
      ids.add(id);
    }
  });
  const nodeIds = new Set(nodes.map((n) => n.id));
  lights.forEach((l, i) => {
    const parentId = (l as Json | null)?.parentId;
    if (typeof parentId === "string" && !nodeIds.has(parentId)) {
      c.fail("/lights/" + i + "/parentId", "Parent " + JSON.stringify(parentId) + " is not in the scene.");
    }
  });
  const materials = c.array(input.materials, "/materials");
  const materialIds = new Set<string>();
  materials.forEach((m, i) => {
    checkMaterial(c, m, "/materials/" + i);
    const id = (m as Json | null)?.id;
    if (typeof id === "string") {
      if (materialIds.has(id)) c.fail("/materials/" + i + "/id", "Duplicate material ID " + JSON.stringify(id) + ".", id);
      materialIds.add(id);
    }
  });
  if (input.route !== undefined) c.string(input.route, "/route");
  const declared = new Map<string, ViroSpecsActionDeclaration>();
  c.array(input.actions, "/actions").forEach((a, i) => {
    const problems = checkViroSpecsActionDeclaration(a);
    for (const problem of problems) c.fail("/actions/" + i + problem.path, problem.message);
    if (problems.length > 0) return;
    const declaration = a as ViroSpecsActionDeclaration;
    if (declared.has(declaration.id)) {
      c.fail("/actions/" + i + "/id", "Action " + JSON.stringify(declaration.id) + " is declared twice.", undefined, "VS5016");
    } else declared.set(declaration.id, declaration);
  });
  const interactions = c.array(input.interactions, "/interactions");
  const interactionIds = new Set<string>();
  interactions.forEach((x, i) => {
    checkInteraction(c, x, "/interactions/" + i, nodeIds, declared);
    const id = (x as Json | null)?.nodeId;
    if (typeof id === "string") {
      if (interactionIds.has(id)) c.fail("/interactions/" + i + "/nodeId", "Node has two interaction entries.", id);
      interactionIds.add(id);
    }
  });
  const animations = c.array(input.animations, "/animations");
  animations.forEach((a, i) => checkAnimation(c, a, "/animations/" + i, nodeIds));

  const ordered = orderNodes(c, nodes);
  if (c.diagnostics.length > 0) return { ok: false, diagnostics: c.diagnostics };
  return {
    ok: true,
    scene: {
      protocol,
      ...(typeof input.route === "string" ? { route: input.route } : {}),
      actions: Array.from(declared.values()),
      nodes: ordered,
      polylines: polylines as ViroSpecsDocumentPolyline[],
      lights: lights as ViroSpecsDocumentLight[],
      materials: materials as ViroSpecsDocumentMaterial[],
      interactions: interactions as ViroSpecsDocumentInteraction[],
      animations: animations as ViroSpecsDocumentAnimation[],
    },
  };
}

/** `#RRGGBB(AA)` to RGBA channels in 0..1. Input must have passed validation. */
export function parseViroSpecsColor(hex: string): [number, number, number, number] {
  const value = hex.slice(1);
  const channel = (i: number): number => parseInt(value.slice(i, i + 2), 16) / 255;
  return [channel(0), channel(2), channel(4), value.length === 8 ? channel(6) : 1];
}

/** Text style shape used by both protocols, for backends. */
export type ViroSpecsResolvedTextStyle = ViroSpecsDocumentTextStyle & {
  /** Protocol 1 Lens size, used when `fontSize` is absent. */
  lensSize?: number;
  /** Protocol 1 RGBA, used when `color` is absent. */
  rgba?: [number, number, number, number];
};
