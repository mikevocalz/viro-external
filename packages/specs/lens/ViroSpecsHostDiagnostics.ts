/**
 * Diagnostics channel for the Lens-side scene host.
 *
 * The host never throws into Lens Studio: every failure becomes a
 * {@linkcode ViroSpecsHostDiagnostic} on this channel, and the live scene
 * either stays as it was (errors) or renders with a stated approximation
 * (warnings). Codes use the `VS5xxx` range of the Specs diagnostic catalog in
 * `mikevocalz/viro` (`components/Specs/core/diagnosticCodes.ts`), so a code
 * means the same thing in the compiler output and in a Lens log.
 *
 * Dependency-free and free of Lens globals, so Node tests run it as is.
 */

/** How a host diagnostic affects the scene. */
export type ViroSpecsHostDiagnosticSeverity = "error" | "warning" | "info";

/** Lifecycle step that produced a diagnostic. */
export type ViroSpecsHostPhase =
  | "validate"
  | "stage"
  | "commit"
  | "patch"
  | "assets"
  | "interaction"
  | "animation"
  | "dispose"
  | "listener"
  | "action"
  | "experience";

/** Catalog entry: severity is fixed per code. */
export type ViroSpecsHostDiagnosticDefinition = {
  readonly severity: ViroSpecsHostDiagnosticSeverity;
  readonly title: string;
  readonly hint: string;
};

/**
 * Every code the host emits. Append-only; mirrored in viro's catalog and in
 * `doc/LensHostDiagnostics.md`. The test suite checks the doc against this
 * table.
 */
export const VIRO_SPECS_HOST_DIAGNOSTICS = {
  VS5001: {
    severity: "error",
    title: "Unsupported scene protocol",
    hint: "The host reads scene protocols 1 and 2. Recompile with a viro-specs-compile that matches this @viro-external/specs.",
  },
  VS5002: {
    severity: "error",
    title: "Scene failed host validation",
    hint: "The previous scene stays on screen. Fix the field named by fieldPath; viro-specs-compile reports the same problem with a source position.",
  },
  VS5003: {
    severity: "warning",
    title: "Asset is not registered; placeholder shown",
    hint: "Add the asset to ViroSpecsAssetRegistry under the reported source ID. The node shows a bounded tinted box until then.",
  },
  VS5004: {
    severity: "warning",
    title: "Material is not registered; default material used",
    hint: "Register the material ID in ViroSpecsAssetRegistry or define it in the scene's materials list.",
  },
  VS5005: {
    severity: "error",
    title: "Staging failed; previous scene kept",
    hint: "The staged scene was disposed and the committed scene is unchanged. The message names the node and the backend error.",
  },
  VS5006: {
    severity: "info",
    title: "Async work finished after its scene was retired",
    hint: "No action needed. The result was discarded because navigation or replacement retired the scene that started it.",
  },
  VS5007: {
    severity: "warning",
    title: "Font family is not registered; default font used",
    hint: "Register the font in ViroSpecsAssetRegistry fontIds/fonts under the fontFamily name.",
  },
  VS5008: {
    severity: "warning",
    title: "maxLines is approximated by the text box height",
    hint: "Lens Text has no line limit. The host sizes the text box to maxLines lines and truncates overflow; give the node extents for exact layout.",
  },
  VS5009: {
    severity: "error",
    title: "Listener or action handler threw",
    hint: "The exception was caught so the Lens keeps running. Fix the listener named in the message.",
  },
  VS5010: {
    severity: "info",
    title: "Resource cache is full; least recently used entry released",
    hint: "Raise maxCachedMaterials if this repeats every frame.",
  },
  VS5011: {
    severity: "warning",
    title: "Placeholder visual is unavailable",
    hint: "Set placeholderMaterial (or defaultImageMaterial) on ViroSpecsAssetRegistry so missing assets render as a tinted box instead of an empty node.",
  },
  VS5012: {
    severity: "warning",
    title: "Material lightingModel is not mapped",
    hint: "Lens shading comes from the base material, not from lightingModel. Register a Lens material under the material ID to control shading.",
  },
  VS5013: {
    severity: "warning",
    title: "Patch op skipped",
    hint: "The op named a node that does not exist or would create a parent cycle. The rest of the patch applied.",
  },
  VS5014: {
    severity: "error",
    title: "Backend operation failed",
    hint: "A Lens call threw while updating a committed node. The node keeps its previous state; the message names the operation.",
  },
  VS5015: {
    severity: "error",
    title: "Action is not declared",
    hint: "Declare the action ID in the scene's actions list and in the ViroSpecsActionRegistry. The trigger or dispatch was dropped.",
  },
  VS5016: {
    severity: "error",
    title: "Action is declared or handled twice",
    hint: "Action IDs are unique per scene and per registry. The first declaration or handler stays; remove the second.",
  },
  VS5017: {
    severity: "error",
    title: "Action payload does not match its declaration",
    hint: "The fieldPath names the field: missing, unknown, wrong type or not in enum. The action was dropped and state is unchanged.",
  },
  VS5018: {
    severity: "info",
    title: "Queued action invalidated by navigation",
    hint: "No action needed. The scene that showed the node was retired before the action ran, so it was dropped.",
  },
  VS5019: {
    severity: "warning",
    title: "Declared action has no handler",
    hint: "Register a handler with ViroSpecsActionRegistry.on, or set forward on ViroSpecsActionRuntime to send the action to a phone app.",
  },
  VS5020: {
    severity: "info",
    title: "Route memory is full; least recently used route forgotten",
    hint: "Scroll positions of the forgotten route reset when it is shown again. Raise maxRememberedRoutes if this repeats.",
  },
  VS5021: {
    severity: "info",
    title: "Capability degraded; dependent UI hidden",
    hint: "No action needed for the build. The message names the capability, its state and the UI the experience layer hid; the wearer sees a one-line notice.",
  },
  VS5022: {
    severity: "warning",
    title: "Text raised to the 1.2 degree minimum",
    hint: "The text rendered smaller than 1.2 degrees at its distance, so the host raised its size. Size it from the type tokens (PanelText) to avoid the clamp.",
  },
  VS5023: {
    severity: "warning",
    title: "Position clamped into the 0.6-3.0 m comfort band",
    hint: "A placement or drag would have put the node nearer than 0.6 m or farther than 3.0 m; the host stopped it at the band edge.",
  },
  VS5024: {
    severity: "info",
    title: "Gaze-only input active",
    hint: "Hand tracking is not available, so selection works by gaze dwell and drag is replaced by step buttons. It switches back when hand tracking returns.",
  },
  VS5025: {
    severity: "warning",
    title: "Premium component feature not drawn by this host",
    hint: "The scene carries a premium feature this host version does not draw; the message names the node and the features. The current Lens host draws every premium feature (ModelViewer load ring, Reset model button and autoRotate; PanelImage radius.card corners), so it reports none. See doc/Experience.md#not-drawn-yet.",
  },
} as const satisfies Record<string, ViroSpecsHostDiagnosticDefinition>;

/** Codes in {@linkcode VIRO_SPECS_HOST_DIAGNOSTICS}. */
export type ViroSpecsHostDiagnosticCode = keyof typeof VIRO_SPECS_HOST_DIAGNOSTICS;

/** A finding reported by the Lens-side host. */
export type ViroSpecsHostDiagnostic = {
  readonly code: ViroSpecsHostDiagnosticCode;
  readonly severity: ViroSpecsHostDiagnosticSeverity;
  readonly phase: ViroSpecsHostPhase;
  readonly message: string;
  readonly hint: string;
  /** Node, polyline, light or material the finding is about. */
  readonly nodeId?: string;
  /** JSON Pointer into the scene document. */
  readonly fieldPath?: string;
  /** Scene revision the finding belongs to. */
  readonly sceneRevision?: number;
};

/** Optional fields when creating a diagnostic. */
export type ViroSpecsHostDiagnosticDetails = {
  readonly nodeId?: string;
  readonly fieldPath?: string;
  readonly sceneRevision?: number;
  readonly hint?: string;
};

/** Builds a diagnostic with the catalog severity and default hint. */
export function createViroSpecsHostDiagnostic(
  code: ViroSpecsHostDiagnosticCode,
  phase: ViroSpecsHostPhase,
  message: string,
  details: ViroSpecsHostDiagnosticDetails = {}
): ViroSpecsHostDiagnostic {
  const definition = VIRO_SPECS_HOST_DIAGNOSTICS[code];
  return {
    code,
    severity: definition.severity,
    phase,
    message,
    hint: details.hint ?? definition.hint,
    ...(details.nodeId !== undefined ? { nodeId: details.nodeId } : {}),
    ...(details.fieldPath !== undefined ? { fieldPath: details.fieldPath } : {}),
    ...(details.sceneRevision !== undefined ? { sceneRevision: details.sceneRevision } : {}),
  };
}

/** One line for logs: `[viro-specs-host] error VS5002 (validate) /nodes/0/kind: ...`. */
export function formatViroSpecsHostDiagnostic(diagnostic: ViroSpecsHostDiagnostic): string {
  const where = diagnostic.fieldPath ?? (diagnostic.nodeId !== undefined ? "node " + diagnostic.nodeId : "");
  return (
    "[viro-specs-host] " +
    diagnostic.severity +
    " " +
    diagnostic.code +
    " (" +
    diagnostic.phase +
    ")" +
    (where ? " " + where : "") +
    ": " +
    diagnostic.message
  );
}

/** Cleanup handle returned by listener registration. `remove` is idempotent. */
export type ViroSpecsSubscription = { remove(): void };

/** Options for {@linkcode ViroSpecsHostDiagnostics}. */
export type ViroSpecsHostDiagnosticsOptions = {
  /** Number of recent diagnostics kept for inspection. Default 64. */
  readonly historyLimit?: number;
  /** Where every diagnostic is also written, for example Lens `print`. */
  readonly log?: (line: string) => void;
};

/**
 * Fan-out channel for host diagnostics. Listeners are additive and each
 * owns its subscription. A listener that throws does not stop delivery to
 * the others; the failure is recorded as `VS5009` in {@linkcode recent} and
 * the log, and is not re-dispatched (which could loop).
 */
export class ViroSpecsHostDiagnostics {
  private readonly listeners = new Set<(diagnostic: ViroSpecsHostDiagnostic) => void>();
  private readonly history: ViroSpecsHostDiagnostic[] = [];
  private readonly historyLimit: number;
  private readonly log: ((line: string) => void) | undefined;
  private readonly counts: Record<ViroSpecsHostDiagnosticSeverity, number> = { error: 0, warning: 0, info: 0 };

  constructor(options: ViroSpecsHostDiagnosticsOptions = {}) {
    this.historyLimit = Math.max(1, options.historyLimit ?? 64);
    this.log = options.log;
  }

  /** Most recent diagnostics, oldest first, at most `historyLimit`. */
  get recent(): readonly ViroSpecsHostDiagnostic[] {
    return this.history.slice();
  }

  /** Totals since creation, by severity. History eviction does not lower them. */
  get totals(): Readonly<Record<ViroSpecsHostDiagnosticSeverity, number>> {
    return { ...this.counts };
  }

  /** Registers a listener. Call `remove()` on the result to stop delivery. */
  addOnDiagnosticListener(listener: (diagnostic: ViroSpecsHostDiagnostic) => void): ViroSpecsSubscription {
    this.listeners.add(listener);
    let removed = false;
    return {
      remove: () => {
        if (removed) return;
        removed = true;
        this.listeners.delete(listener);
      },
    };
  }

  /** Records and delivers one diagnostic. Never throws. */
  report(diagnostic: ViroSpecsHostDiagnostic): void {
    this.record(diagnostic);
    for (const listener of Array.from(this.listeners)) {
      try {
        listener(diagnostic);
      } catch (error) {
        this.record(
          createViroSpecsHostDiagnostic("VS5009", "listener", "Diagnostic listener threw: " + describeError(error), {
            sceneRevision: diagnostic.sceneRevision,
          })
        );
      }
    }
  }

  /** Drops listeners and history. Idempotent. */
  dispose(): void {
    this.listeners.clear();
    this.history.length = 0;
  }

  private record(diagnostic: ViroSpecsHostDiagnostic): void {
    this.counts[diagnostic.severity] += 1;
    this.history.push(diagnostic);
    while (this.history.length > this.historyLimit) this.history.shift();
    if (this.log) {
      try {
        this.log(formatViroSpecsHostDiagnostic(diagnostic));
      } catch {
        // The log sink is the last resort; a broken sink must not take the Lens down.
      }
    }
  }
}

/** Message text for an unknown thrown value. */
export function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error) ?? String(error);
  } catch {
    return String(error);
  }
}
