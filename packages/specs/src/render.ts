import type {
  PortableXRColor,
  PortableXRNode,
  PortableXRSurfaceFit,
} from "@viro-external/xr-contract";
import type { SpecsUpstreamPackageName } from "./upstream";

export type SpecsRenderPrimitive =
  | "scene-object"
  | "text"
  | "image"
  | "render-mesh"
  | "ui-frame"
  | "flat-surface"
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
      fit?: PortableXRSurfaceFit;
      tint?: PortableXRColor;
      cornerRadiusMeters?: number;
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

/** Kinds whose variant declares `source` as required. */
const SOURCE_REQUIRED = new Set<string>(["model", "image", "video"]);

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
  // UI Kit `Frame`; the Lens runtime imports it from SpectaclesUIKit.lspkg.
  panel: {
    primitive: "ui-frame",
    backendPackage: "SpectaclesUIKit",
  },
  // A plain tinted rectangle needs no container chrome.
  surface: { primitive: "flat-surface" },
  // ScrollWindow is a separate UI Kit component; Frame has no scrolling of its own.
  scroll: {
    primitive: "scroll-window",
    backendPackage: "SpectaclesUIKit",
  },
  // Video is a core Lens Texture driven by VideoTextureProvider, no upstream package.
  video: { primitive: "video-surface" },
};

/** `scale` exists only on the multiplier-scaled variants. */
function scaleOf(node: PortableXRNode): [number, number, number] | undefined {
  return "scale" in node ? node.scale : undefined;
}

/** `sizeMeters` exists only on the measured-surface variants. */
function sizeOf(node: PortableXRNode): [number, number] | undefined {
  return "sizeMeters" in node ? node.sizeMeters : undefined;
}

/** `source` exists only on the asset-backed variants. */
function sourceOf(node: PortableXRNode): string | undefined {
  return "source" in node ? node.source : undefined;
}

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

    if (SOURCE_REQUIRED.has(node.kind) && !sourceOf(node)) {
      diagnostics.push({
        level: "error",
        nodeId: node.id,
        message: `${node.kind} nodes require a source asset before Specs rendering.`,
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

    const scale = scaleOf(node);
    const sizeMeters = sizeOf(node);
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
    const source = sourceOf(node);
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
