import type { PortableXRNode } from "@viro-external/xr-contract";
import { compileSpecsScene, type SpecsSceneSnapshot } from "./index.js";

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

function assertVector(node: PortableXRNode, key: "position" | "rotation" | "scale", count: number): void {
  const value = node[key];
  if (value === undefined) return;
  if (!Array.isArray(value) || value.length !== count || value.some((v) => typeof v !== "number" || !Number.isFinite(v))) {
    throw new Error(`Invalid ${key} on Specs node ${node.id}.`);
  }
}

/**
 * Validate a complete presentation *before* the Lens clears the old scene.
 * Child-first/missing parents previously passed compiler warnings but would
 * throw after the old on-device scene had already been destroyed.
 */
export function compileSpecsPresentation(input: {
  scene: SpecsSceneSnapshot;
  targets?: readonly SpecsActionTarget[];
}): SpecsPresentationSnapshot {
  if (input.scene.version !== 1 || input.scene.nodes.length === 0) {
    throw new Error("Specs presentation needs a non-empty version 1 scene.");
  }
  const compiled = compileSpecsScene(input.scene.nodes);
  const failures = compiled.diagnostics.filter((diagnostic) => diagnostic.level === "error");
  if (failures.length) {
    throw new Error("Invalid Specs presentation scene: " + failures.map((d) => d.message).join(" "));
  }

  const declared = new Set<string>();
  const safeNodes: PortableXRNode[] = [];
  for (const node of compiled.scene.nodes) {
    if (typeof node.id !== "string" || !node.id.trim() ||
        typeof node.kind !== "string") {
      throw new Error("Specs node IDs and kinds must be non-empty strings.");
    }
    if (node.parentId !== undefined && typeof node.parentId !== "string") {
      throw new Error("Specs node parent must be a string.");
    }
    if (node.parentId && !declared.has(node.parentId)) {
      throw new Error(`Specs node ${node.id} must follow its existing parent ${node.parentId}.`);
    }
    for (const [key, count] of [["position", 3], ["rotation", 4], ["scale", 3]] as const) {
      assertVector(node, key, count);
    }
    if (node.text !== undefined &&
        (node.kind !== "text" || typeof node.text !== "string")) {
      throw new Error("Specs text is only valid on text nodes.");
    }
    if (node.source !== undefined &&
        ((node.kind !== "image" && node.kind !== "model") ||
          typeof node.source !== "string" || !node.source.trim())) {
      throw new Error("Specs asset sources are only valid on image and model nodes.");
    }
    if (node.visible !== undefined && typeof node.visible !== "boolean") {
      throw new Error("Specs node visibility must be boolean.");
    }
    // Compile only the known serialized fields. Native objects, closures and
    // accidental circular properties never cross the Lens transport boundary.
    safeNodes.push({
      id: node.id,
      kind: node.kind,
      ...(node.parentId ? { parentId: node.parentId } : {}),
      ...(node.position ? { position: [...node.position] as [number, number, number] } : {}),
      ...(node.rotation ? { rotation: [...node.rotation] as [number, number, number, number] } : {}),
      ...(node.scale ? { scale: [...node.scale] as [number, number, number] } : {}),
      ...(node.text !== undefined ? { text: node.text } : {}),
      ...(node.source !== undefined ? { source: node.source } : {}),
      ...(node.visible !== undefined ? { visible: node.visible } : {}),
    });
    declared.add(node.id);
  }

  const targetIds = new Set<string>();
  const targets = (input.targets ?? []).map((target) => {
    if (typeof target.targetId !== "string" || !target.targetId.trim() ||
        !declared.has(target.targetId)) {
      throw new Error(`Specs action target does not exist: ${target.targetId}`);
    }
    if (targetIds.has(target.targetId)) {
      throw new Error(`Specs action target duplicated: ${target.targetId}`);
    }
    if (typeof target.action !== "string" || !target.action.trim() ||
        target.action.length > 256) {
      throw new Error("Specs actions must be non-empty and at most 256 characters.");
    }
    targetIds.add(target.targetId);
    return { targetId: target.targetId, action: target.action };
  });

  return { scene: { version: 1, nodes: safeNodes }, targets };
}
