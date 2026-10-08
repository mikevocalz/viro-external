/**
 * Workspace surface contract: one logical workspace, described once, that
 * every platform adapter resolves into its own presentation (Meta Horizon
 * windows, PICO subwindows, Viro engine panels, a flat SplitView).
 *
 * Product state (selection, open panels) lives in the app's store. A surface
 * declares which piece of that state it depends on; adapters receive the
 * current values through {@linkcode WorkspaceActivity} and never own them.
 */
import type {
  SpatialSurfaceRole,
  XRCapabilityName,
  XRCapabilityReport,
} from "./index";

/**
 * What a surface means to the product. Adapters may treat roles differently
 * (`main` is never promoted), but the role never changes per platform.
 *
 * @see {@linkcode WorkspaceSurface.role}
 */
export type WorkspaceSurfaceRole =
  | "main"
  | "discover"
  | "detail"
  | "assistant"
  | "tools";

/**
 * Closest legacy {@linkcode SpatialSurfaceRole} for each workspace role, for
 * adapters that still read `SpatialSurfaceIntent`.
 */
export const WORKSPACE_ROLE_TO_SPATIAL_ROLE = {
  main: "content",
  discover: "master",
  detail: "inspector",
  assistant: "popup",
  tools: "accessory",
} as const satisfies Record<WorkspaceSurfaceRole, SpatialSurfaceRole>;

/**
 * Preferred size of a window surface.
 *
 * - `dp`: React Native layout points.
 * - `percent-of-main`: percentage (0-100) of the main window's size.
 *
 * @see {@linkcode WorkspaceWindowPresentation.size}
 */
export type WorkspaceSurfaceSize =
  | { readonly unit: "dp"; readonly width: number; readonly height: number }
  | {
      readonly unit: "percent-of-main";
      readonly widthPercent: number;
      readonly heightPercent: number;
    };

/**
 * Side of the main surface a window sits against. `start`/`end` follow the
 * layout direction (they swap in RTL); `center` overlaps the main surface.
 */
export type WorkspaceAnchorSide = "start" | "end" | "top" | "bottom" | "center";

/**
 * How far a window comes toward the user relative to the main surface.
 * Adapters map this to their own depth steps.
 */
export type WorkspaceAnchorDepth = "flush" | "near" | "mid" | "far";

/**
 * Where a window wants to be relative to the main surface. The platform
 * decides the final placement; this is intent only.
 *
 * @see {@linkcode WorkspaceWindowPresentation.anchor}
 */
export type WorkspaceAnchorIntent = {
  readonly side: WorkspaceAnchorSide;
  /** @default "flush" */
  readonly depth?: WorkspaceAnchorDepth;
};

/** The permanent center surface. Exactly one per workspace; never promoted. */
export type WorkspaceMainPresentation = { readonly kind: "main" };

/**
 * A surface that prefers its own system window beside the main surface.
 * `priority` arbitrates when there are more window surfaces than slots: higher
 * wins, ties go to declaration order. Space values by 10 (`0, 10, 20`) so new
 * surfaces can slot in between.
 */
export type WorkspaceWindowPresentation = {
  readonly kind: "window";
  readonly size: WorkspaceSurfaceSize;
  readonly anchor: WorkspaceAnchorIntent;
  readonly priority: number;
};

/**
 * A layer drawn inside the main surface (an assistant overlay, a toast). It
 * never asks for a window, so it never competes for a slot.
 */
export type WorkspaceLayerPresentation = {
  readonly kind: "layer";
  readonly region: WorkspaceInlineRegion;
};

/**
 * Preferred presentation of a surface.
 *
 * @see {@linkcode WorkspaceSurface.presentation}
 */
export type WorkspacePresentation =
  | WorkspaceMainPresentation
  | WorkspaceWindowPresentation
  | WorkspaceLayerPresentation;

/** Region of the main surface that hosts inline content. */
export type WorkspaceInlineRegion = "leading" | "trailing" | "overlay" | "sheet";

/**
 * What a window surface does when it cannot have a window (no spatial
 * runtime, no free slot, or an unmet capability requirement).
 *
 * - `inline`: render inside the main surface, in `region`.
 * - `drop`: do not render; children unmount.
 *
 * @see {@linkcode WorkspaceSurface.fallback}
 */
export type WorkspaceSurfaceFallback =
  | { readonly kind: "inline"; readonly region: WorkspaceInlineRegion }
  | { readonly kind: "drop" };

/**
 * Capabilities a surface's preferred presentation needs beyond a window slot.
 * A capability counts as met only when the runtime reports it `"supported"`.
 * When unmet, the surface takes its fallback.
 *
 * @see {@linkcode evaluateWorkspaceRequirement}
 */
export type WorkspaceCapabilityRequirement =
  | { readonly kind: "none" }
  | { readonly kind: "all-of"; readonly capabilities: readonly XRCapabilityName[] }
  | { readonly kind: "any-of"; readonly capabilities: readonly XRCapabilityName[] };

/**
 * Result of checking a {@linkcode WorkspaceCapabilityRequirement} against a
 * {@linkcode XRCapabilityReport}. `missing` lists the capabilities that were
 * not `"supported"`.
 */
export type WorkspaceRequirementVerdict =
  | { readonly kind: "met" }
  | { readonly kind: "unmet"; readonly missing: readonly XRCapabilityName[] };

/**
 * Focus and back-navigation behaviour.
 *
 * - `focus: "primary"`: holds default focus. Only the main surface uses it.
 * - `focus: "take-on-open"`: receives focus when it mounts.
 * - `focus: "passive"`: never takes focus on its own.
 * - `back: "exit"`: back leaves the workspace (main surface).
 * - `back: "close"`: back closes this surface and returns focus to main.
 * - `back: "return-to-main"`: back moves focus to main, surface stays.
 *
 * @see {@linkcode WorkspaceSurface.focus}
 */
export type WorkspaceSurfaceFocus = {
  readonly focus: "primary" | "take-on-open" | "passive";
  readonly back: "exit" | "close" | "return-to-main";
};

/**
 * Who decides whether a surface is mounted.
 *
 * - `workspace`: always mounted while the workspace is.
 * - `selection`: mounted only while the store has a value for `selectionKey`
 *   (for example a Place Detail surface keyed on `"place"`). It never shows
 *   empty.
 * - `user`: mounted while the user has it open (`openSurfaceIds`).
 *
 * @see {@linkcode isWorkspaceSurfaceMounted}
 */
export type WorkspaceSurfaceLifecycle =
  | { readonly owner: "workspace" }
  | { readonly owner: "selection"; readonly selectionKey: string }
  | { readonly owner: "user" };

/**
 * One surface of a workspace. `id` is the stable identity adapters use as
 * the platform label (Meta `SpatialWindow` `label`); keep it constant across
 * renders and unique within the workspace.
 *
 * @see {@linkcode WorkspaceDefinition.surfaces}
 */
export type WorkspaceSurface = {
  readonly id: string;
  readonly role: WorkspaceSurfaceRole;
  readonly presentation: WorkspacePresentation;
  readonly fallback: WorkspaceSurfaceFallback;
  readonly requires: WorkspaceCapabilityRequirement;
  readonly focus: WorkspaceSurfaceFocus;
  readonly lifecycle: WorkspaceSurfaceLifecycle;
};

/**
 * The authored workspace. `maxPromotedSurfaces` caps how many surfaces may
 * hold a window at once, on top of whatever the platform allows; omit it to
 * use the platform's capacity alone.
 *
 * @see {@linkcode validateWorkspaceDefinition}
 */
export type WorkspaceDefinition = {
  readonly id: string;
  readonly surfaces: readonly WorkspaceSurface[];
  readonly maxPromotedSurfaces?: number;
};

/**
 * Current values of the store fields surfaces depend on. Adapters read it,
 * never write it.
 *
 * - `selections`: selection keys that currently hold a value, e.g. `["place"]`.
 * - `openSurfaceIds`: ids of `user`-owned surfaces the user has open.
 */
export type WorkspaceActivity = {
  readonly selections: readonly string[];
  readonly openSurfaceIds: readonly string[];
};

/**
 * Input every workspace resolver takes: the authored definition plus the
 * current store values.
 */
export type WorkspaceIntent = {
  readonly definition: WorkspaceDefinition;
  readonly activity: WorkspaceActivity;
};

/**
 * Throws when a definition breaks the workspace invariants: empty or
 * duplicate ids, not exactly one `main` surface, a `main` role without the
 * `main` presentation (or the reverse), a `main` surface that is not
 * workspace-owned, or a negative/non-integer `maxPromotedSurfaces`.
 */
export function validateWorkspaceDefinition(definition: WorkspaceDefinition): void {
  const seen = new Set<string>();
  let mainCount = 0;
  for (const surface of definition.surfaces) {
    if (surface.id.trim() === "") {
      throw new Error(`Workspace "${definition.id}": a surface has an empty id.`);
    }
    if (seen.has(surface.id)) {
      throw new Error(`Workspace "${definition.id}": duplicate surface id "${surface.id}".`);
    }
    seen.add(surface.id);
    const isMainPresentation = surface.presentation.kind === "main";
    if (isMainPresentation !== (surface.role === "main")) {
      throw new Error(
        `Workspace "${definition.id}": surface "${surface.id}" has role "${surface.role}" ` +
          `with presentation "${surface.presentation.kind}". Role "main" and presentation "main" go together.`
      );
    }
    if (isMainPresentation) {
      mainCount += 1;
      if (surface.lifecycle.owner !== "workspace") {
        throw new Error(
          `Workspace "${definition.id}": main surface "${surface.id}" must be workspace-owned, ` +
            `got "${surface.lifecycle.owner}".`
        );
      }
    }
  }
  if (mainCount !== 1) {
    throw new Error(`Workspace "${definition.id}": expected exactly one main surface, found ${mainCount}.`);
  }
  const cap = definition.maxPromotedSurfaces;
  if (cap !== undefined && (!Number.isInteger(cap) || cap < 0)) {
    throw new RangeError(
      `Workspace "${definition.id}": maxPromotedSurfaces must be a non-negative integer, got ${cap}.`
    );
  }
}

/** True when the surface's lifecycle owner currently wants it mounted. */
export function isWorkspaceSurfaceMounted(
  surface: WorkspaceSurface,
  activity: WorkspaceActivity
): boolean {
  switch (surface.lifecycle.owner) {
    case "workspace":
      return true;
    case "selection":
      return activity.selections.includes(surface.lifecycle.selectionKey);
    case "user":
      return activity.openSurfaceIds.includes(surface.id);
  }
}

/** Checks a requirement against a runtime's capability report. */
export function evaluateWorkspaceRequirement(
  requirement: WorkspaceCapabilityRequirement,
  report: XRCapabilityReport
): WorkspaceRequirementVerdict {
  if (requirement.kind === "none") return { kind: "met" };
  const missing = requirement.capabilities.filter((name) => report[name] !== "supported");
  const met =
    requirement.kind === "all-of"
      ? missing.length === 0
      : missing.length < requirement.capabilities.length;
  return met ? { kind: "met" } : { kind: "unmet", missing };
}
