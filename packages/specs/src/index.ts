import type {
  PortableXRInteraction,
  PortableXRNode,
  XRCapabilityReport,
  XRPlatformAdapter,
} from "@viro-external/xr-contract";

export type SpecsSupportedNodeKind =
  | "group"
  | "text"
  | "image"
  | "model"
  | "panel";

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

const SUPPORTED = new Set<SpecsSupportedNodeKind>([
  "group", "text", "image", "model", "panel",
]);

/**
 * Compile the deliberately small portable scene subset into a stable JSON
 * snapshot for a Lens Studio/Snap OS runtime bridge.
 */
export function compileSpecsScene(
  nodes: readonly PortableXRNode[]
): SpecsCompileResult {
  const diagnostics: SpecsCompileDiagnostic[] = [];
  const accepted: PortableXRNode[] = [];
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

    if (!SUPPORTED.has(node.kind as SpecsSupportedNodeKind)) {
      diagnostics.push({
        level: "error",
        nodeId: node.id,
        message: `Node kind ${node.kind} has no Specs adapter mapping.`,
      });
      continue;
    }

    if (node.kind === "model" && !node.source) {
      diagnostics.push({
        level: "error",
        nodeId: node.id,
        message: "Model nodes require a source asset.",
      });
      continue;
    }

    accepted.push({ ...node });
  }

  for (const node of accepted) {
    if (node.parentId && !ids.has(node.parentId)) {
      diagnostics.push({
        level: "warning",
        nodeId: node.id,
        message: `Parent ${node.parentId} is not present in the portable scene.`,
      });
    }
  }

  return {
    scene: { version: 1, nodes: accepted },
    diagnostics,
  };
}

export interface SpecsRuntimeTransport {
  getCapabilities(): Promise<XRCapabilityReport> | XRCapabilityReport;
  applyScene(scene: SpecsSceneSnapshot): Promise<void> | void;
  onInteraction(
    listener: (event: PortableXRInteraction) => void
  ): () => void;
  dispose(): Promise<void> | void;
}

export class SpecsAdapter implements XRPlatformAdapter {
  readonly family = "snap-specs" as const;

  constructor(private readonly transport: SpecsRuntimeTransport) {}

  getCapabilities(): Promise<XRCapabilityReport> | XRCapabilityReport {
    return this.transport.getCapabilities();
  }

  async updatePortableScene(nodes: readonly PortableXRNode[]): Promise<void> {
    const compiled = compileSpecsScene(nodes);
    const fatal = compiled.diagnostics.filter((d) => d.level === "error");
    if (fatal.length) {
      throw new Error(
        `Specs scene compile failed: ${fatal.map((d) => d.message).join(" ")}`
      );
    }
    await this.transport.applyScene(compiled.scene);
  }

  dispose(): Promise<void> | void {
    return this.transport.dispose();
  }
}

export * from "./runtime";
export * from "./upstream";
export * from "./render";
export * from "./animation";
export * from "./interaction";
export * from "./ar";
export * from "./navigation";
export * from "./testing";
export * from "./viro-runtime-provider";
