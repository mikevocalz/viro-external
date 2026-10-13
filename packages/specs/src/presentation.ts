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
  for (const node of compiled.scene.nodes) {
    if (!node.id.trim()) throw new Error("Specs node IDs must not be empty.");
    if (node.parentId && !declared.has(node.parentId)) {
      throw new Error(`Specs node ${node.id} must follow its existing parent ${node.parentId}.`);
    }
    for (const [key, count] of [["position", 3], ["rotation", 4], ["scale", 3]] as const) {
      assertVector(node, key, count);
    }
    declared.add(node.id);
  }

  const targetIds = new Set<string>();
  const targets = (input.targets ?? []).map((target) => {
    if (!target.targetId.trim() || !declared.has(target.targetId)) {
      throw new Error(`Specs action target does not exist: ${target.targetId}`);
    }
    if (targetIds.has(target.targetId)) {
      throw new Error(`Specs action target duplicated: ${target.targetId}`);
    }
    if (!target.action.trim() || target.action.length > 256) {
      throw new Error("Specs actions must be non-empty and at most 256 characters.");
    }
    targetIds.add(target.targetId);
    return { targetId: target.targetId, action: target.action };
  });

  return { scene: compiled.scene, targets };
}
