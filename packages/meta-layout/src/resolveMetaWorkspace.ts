import type {
  WorkspaceAnchorIntent,
  WorkspaceInlineRegion,
  WorkspaceIntent,
  WorkspaceSurface,
  WorkspaceSurfaceSize,
  WorkspaceWindowPresentation,
  XRCapabilityName,
} from "@viro-external/xr-contract";
import {
  evaluateWorkspaceRequirement,
  isWorkspaceSurfaceMounted,
  validateWorkspaceDefinition,
} from "@viro-external/xr-contract";
import type { MetaHorizonLayoutRuntime } from "./runtime";
import { META_HORIZON_RN_DEFAULT_SLOT_BUDGET } from "./runtime";
import type { MetaAnchorPair, MetaOffset, MetaWindowDimension, MetaWindowProps } from "./metaWindowTypes";
import { META_OFFSET_STEPS } from "./metaWindowTypes";

/**
 * Why a window surface renders inside the main window instead of its own
 * window, or why a surface is not rendered at all.
 *
 * - `no-spatial-runtime`: `isSpatialAvailable` is false (not Horizon OS,
 *   OS below 207, provider not initialised yet).
 * - `capability-unmet`: the surface's `requires` was not met.
 * - `over-capacity`: higher-priority surfaces took every slot.
 */
export type MetaFallbackReason = "no-spatial-runtime" | "capability-unmet" | "over-capacity";

/** The main window's content. Always first; never wrapped in `<SpatialWindow>`. */
export type MetaMainEntry = {
  readonly kind: "main";
  readonly surface: WorkspaceSurface;
};

/**
 * Render as `<SpatialWindow {...window}>`. While Meta has not promoted it,
 * the SDK applies `window.fallback` at the call site, so place the element
 * where `surface.fallback` says it belongs inline.
 */
export type MetaWindowEntry = {
  readonly kind: "window";
  readonly surface: WorkspaceSurface;
  readonly window: MetaWindowProps;
};

/**
 * Render inside the main window, in `region`, without `<SpatialWindow>`.
 * `reason` is `layer` for surfaces whose preferred presentation is a layer.
 */
export type MetaInlineEntry = {
  readonly kind: "inline";
  readonly surface: WorkspaceSurface;
  readonly region: WorkspaceInlineRegion;
  readonly reason: MetaFallbackReason | "layer";
};

/** One element of {@linkcode MetaWorkspaceResolution.entries}. */
export type MetaWorkspaceEntry = MetaMainEntry | MetaWindowEntry | MetaInlineEntry;

/**
 * A surface that renders nothing: either its lifecycle owner has it
 * unmounted (`not-mounted`), or it has `fallback: { kind: "drop" }` and
 * could not get a window.
 */
export type MetaOmittedSurface = {
  readonly surface: WorkspaceSurface;
  readonly reason: MetaFallbackReason | "not-mounted";
  /** Set when `reason` is `capability-unmet`. */
  readonly missing?: readonly XRCapabilityName[];
};

/**
 * Output of {@linkcode resolveMetaWorkspace}.
 *
 * `entries` is in render order: the main surface, then window surfaces in
 * slot-arbitration order (so Meta's mount-order tie-break agrees with ours),
 * then inline surfaces in declaration order. `windowBudget` is the number of
 * extra windows this resolution allowed.
 */
export type MetaWorkspaceResolution = {
  readonly workspaceId: string;
  readonly windowBudget: number;
  readonly entries: readonly MetaWorkspaceEntry[];
  readonly omitted: readonly MetaOmittedSurface[];
};

/**
 * Resolves a workspace into what to render on Meta Horizon OS.
 *
 * - The main surface is never promoted.
 * - At most `windowBudget` surfaces become `<SpatialWindow>` entries:
 *   `runtime.maxPromotedWindows` (default 2), capped by the definition's
 *   `maxPromotedSurfaces`.
 * - Window surfaces compete by rounded `priority` (higher first), ties by
 *   declaration order. Losers take their own fallback: `inline` renders in
 *   the main window, `drop` is omitted.
 * - When `runtime.isSpatialAvailable` is false nothing becomes a window, so
 *   the result is safe to render on PICO, phones and web, where Meta's view
 *   manager is absent.
 * - Surfaces whose lifecycle owner has them unmounted (a Detail surface with
 *   no selection) are omitted with `not-mounted`.
 *
 * Pure and deterministic: the same intent and runtime give the same result,
 * and labels are the surface ids.
 *
 * @throws When the definition is invalid (see `validateWorkspaceDefinition`),
 *   when `runtime.maxPromotedWindows` is not a non-negative integer, or when
 *   a window size is not finite and positive (percentages must be 0-100).
 */
export function resolveMetaWorkspace(
  intent: WorkspaceIntent,
  runtime: MetaHorizonLayoutRuntime
): MetaWorkspaceResolution {
  const { definition, activity } = intent;
  validateWorkspaceDefinition(definition);

  const runtimeCapacity = runtime.maxPromotedWindows ?? META_HORIZON_RN_DEFAULT_SLOT_BUDGET;
  if (!Number.isInteger(runtimeCapacity) || runtimeCapacity < 0) {
    throw new RangeError(
      `maxPromotedWindows must be a non-negative integer, got ${runtimeCapacity}.`
    );
  }
  const windowBudget = Math.min(runtimeCapacity, definition.maxPromotedSurfaces ?? runtimeCapacity);

  let main: MetaMainEntry | undefined;
  const candidates: { surface: WorkspaceSurface; presentation: WorkspaceWindowPresentation; index: number }[] = [];
  const fallbacks = new Map<WorkspaceSurface, { reason: MetaFallbackReason; missing?: readonly XRCapabilityName[] }>();
  const omitted: MetaOmittedSurface[] = [];

  for (const [index, surface] of definition.surfaces.entries()) {
    if (!isWorkspaceSurfaceMounted(surface, activity)) {
      omitted.push({ surface, reason: "not-mounted" });
      continue;
    }
    const presentation = surface.presentation;
    if (presentation.kind === "main") {
      main = { kind: "main", surface };
      continue;
    }
    if (presentation.kind === "layer") continue;
    // Validate geometry even when the surface will not get a window, so a bad
    // size fails on every device instead of only on a headset.
    toMetaDimensions(surface.id, presentation.size);
    if (!runtime.isSpatialAvailable) {
      fallbacks.set(surface, { reason: "no-spatial-runtime" });
      continue;
    }
    const verdict = evaluateWorkspaceRequirement(surface.requires, runtime.capabilities ?? {});
    if (verdict.kind === "unmet") {
      fallbacks.set(surface, { reason: "capability-unmet", missing: verdict.missing });
      continue;
    }
    candidates.push({ surface, presentation, index });
  }

  candidates.sort(
    (a, b) => toMetaPriority(b.presentation.priority) - toMetaPriority(a.presentation.priority) || a.index - b.index
  );
  const winners = candidates.slice(0, windowBudget);
  for (const loser of candidates.slice(windowBudget)) {
    fallbacks.set(loser.surface, { reason: "over-capacity" });
  }

  const entries: MetaWorkspaceEntry[] = [];
  // validateWorkspaceDefinition guarantees one main surface, and main is
  // workspace-owned, so it is always mounted.
  if (main) entries.push(main);
  for (const { surface, presentation } of winners) {
    entries.push({ kind: "window", surface, window: toMetaWindowProps(surface, presentation) });
  }
  for (const surface of definition.surfaces) {
    const presentation = surface.presentation;
    if (presentation.kind === "layer" && isWorkspaceSurfaceMounted(surface, activity)) {
      entries.push({ kind: "inline", surface, region: presentation.region, reason: "layer" });
      continue;
    }
    const fallback = fallbacks.get(surface);
    if (!fallback) continue;
    if (surface.fallback.kind === "inline") {
      entries.push({ kind: "inline", surface, region: surface.fallback.region, reason: fallback.reason });
    } else {
      omitted.push(
        fallback.missing ? { surface, reason: fallback.reason, missing: fallback.missing } : { surface, reason: fallback.reason }
      );
    }
  }

  return { workspaceId: definition.id, windowBudget, entries, omitted };
}

/**
 * Priority as Meta's native module applies it (`NativeSpatialWindowModule.d.ts`
 * `registerWindow`): rounded to an integer, non-finite values become 0,
 * values past 32-bit range clamp.
 */
export function toMetaPriority(priority: number): number {
  if (!Number.isFinite(priority)) return 0;
  return Math.min(2147483647, Math.max(-2147483648, Math.round(priority)));
}

/**
 * Anchor for a workspace side, as an explicit `AnchorPair`
 * (`SpatialAnchor.d.ts`): the window's opposite edge meets the main window's
 * edge, so `start` places the window beside main on the start side. This is
 * what Meta's bare-point form (`anchor="start"`) expands to.
 */
export function toMetaAnchorPair(anchor: WorkspaceAnchorIntent): MetaAnchorPair {
  switch (anchor.side) {
    case "start":
      return { parent: "start", child: "end" };
    case "end":
      return { parent: "end", child: "start" };
    case "top":
      return { parent: "top", child: "bottom" };
    case "bottom":
      return { parent: "bottom", child: "top" };
    case "center":
      return { parent: "center", child: "center" };
  }
}

/**
 * Depth as a neutral `Offset` (`SpatialOffset.d.ts`) along `+z`, toward the
 * user. `flush` (the default) returns undefined so no offset prop is passed.
 */
export function toMetaOffset(anchor: WorkspaceAnchorIntent): MetaOffset | undefined {
  switch (anchor.depth ?? "flush") {
    case "flush":
      return undefined;
    case "near":
      return { z: META_OFFSET_STEPS.near };
    case "mid":
      return { z: META_OFFSET_STEPS.mid };
    case "far":
      return { z: META_OFFSET_STEPS.far };
  }
}

function toMetaDimensions(
  surfaceId: string,
  size: WorkspaceSurfaceSize
): { windowWidth: MetaWindowDimension; windowHeight: MetaWindowDimension } {
  if (size.unit === "dp") {
    for (const value of [size.width, size.height]) {
      if (!Number.isFinite(value) || value <= 0) {
        throw new RangeError(`Surface "${surfaceId}": window size must be finite and positive dp, got ${value}.`);
      }
    }
    return { windowWidth: size.width, windowHeight: size.height };
  }
  for (const value of [size.widthPercent, size.heightPercent]) {
    if (!Number.isFinite(value) || value <= 0 || value > 100) {
      throw new RangeError(`Surface "${surfaceId}": window percentage must be in (0, 100], got ${value}.`);
    }
  }
  return { windowWidth: `${size.widthPercent}%`, windowHeight: `${size.heightPercent}%` };
}

function toMetaWindowProps(surface: WorkspaceSurface, presentation: WorkspaceWindowPresentation): MetaWindowProps {
  const offset = toMetaOffset(presentation.anchor);
  const props = {
    label: surface.id,
    ...toMetaDimensions(surface.id, presentation.size),
    priority: toMetaPriority(presentation.priority),
    promotable: true,
    fallback: surface.fallback.kind,
    anchor: toMetaAnchorPair(presentation.anchor),
  };
  return offset ? { ...props, offset } : props;
}
