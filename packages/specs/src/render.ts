import type { PortableXRNode } from "@viro-external/xr-contract";
import type { SpecsUpstreamPackageName } from "./upstream";

export type SpecsRenderPrimitive =
  | "scene-object"
  | "text"
  | "image"
  | "render-mesh"
  | "ui-frame"
  | "scroll-window"
  | "video-surface";

export type SpecsRenderDiagnostic = {
  level: "warning" | "error";
  nodeId?: string;
  message: string;
};

export type SpecsRenderCommand =
  | {
      op: "create";
      id: string;
      parentId?: string;
      primitive: SpecsRenderPrimitive;
      backendPackage?: SpecsUpstreamPackageName;
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
    }
  | {
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

const RENDER_MAPPING: Record<
  PortableXRNode["kind"],
  {
    primitive: SpecsRenderPrimitive;
    backendPackage?: SpecsUpstreamPackageName;
  }
> = {
  group: { primitive: "scene-object", backendPackage: "AccessComponents" },
  text: { primitive: "text" },
  image: { primitive: "image" },
  model: { primitive: "render-mesh", backendPackage: "Instantiation" },
  panel: {
    primitive: "ui-frame",
    backendPackage: "SpecsInteractionKitExamples",
  },
  // ScrollWindow ships in the same UIKit reference set the panel prefab comes from.
  scroll: {
    primitive: "scroll-window",
    backendPackage: "SpecsInteractionKitExamples",
  },
  // Video is a core Lens Texture driven by VideoTextureProvider, no upstream package.
  video: { primitive: "video-surface" },
};

function addPackage(
  packages: Set<SpecsUpstreamPackageName>,
  packageName: SpecsUpstreamPackageName | undefined
): void {
  if (packageName) {
    packages.add(packageName);
  }
}

/**
 * Converts the portable XR tree into a renderer-neutral command stream that a
 * Lens Studio implementation can execute using SceneObject, Text/Image,
 * RenderMeshVisual and Spectacles UIKit primitives.
 */
export function compileSpecsRenderPlan(
  nodes: readonly PortableXRNode[]
): SpecsRenderPlan {
  const commands: SpecsRenderCommand[] = [];
  const diagnostics: SpecsRenderDiagnostic[] = [];
  const packages = new Set<SpecsUpstreamPackageName>();
  const ids = new Set<string>();

  for (const node of nodes) {
    if (ids.has(node.id)) {
      diagnostics.push({
        level: "error",
        nodeId: node.id,
        message: "Duplicate portable XR node id.",
      });
      continue;
    }

    ids.add(node.id);
    const mapping = RENDER_MAPPING[node.kind];
    addPackage(packages, mapping.backendPackage);

    if (node.kind === "model" && !node.source) {
      diagnostics.push({
        level: "error",
        nodeId: node.id,
        message: "Model nodes require a source asset before Specs rendering.",
      });
      continue;
    }

    commands.push({
      op: "create",
      id: node.id,
      ...(node.parentId ? { parentId: node.parentId } : {}),
      primitive: mapping.primitive,
      ...(mapping.backendPackage
        ? { backendPackage: mapping.backendPackage }
        : {}),
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

    if (node.text !== undefined || node.source !== undefined) {
      commands.push({
        op: "content",
        id: node.id,
        ...(node.text !== undefined ? { text: node.text } : {}),
        ...(node.source !== undefined ? { source: node.source } : {}),
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

  for (const node of nodes) {
    if (node.parentId && !ids.has(node.parentId)) {
      diagnostics.push({
        level: "warning",
        nodeId: node.id,
        message: `Parent ${node.parentId} is not present in the render plan.`,
      });
    }
  }

  return {
    version: 1,
    commands,
    diagnostics,
    packages: [...packages],
  };
}

export interface SpecsRenderRuntime {
  apply(plan: SpecsRenderPlan): Promise<void> | void;
  removeNode?(id: string): Promise<void> | void;
  clear?(): Promise<void> | void;
}
