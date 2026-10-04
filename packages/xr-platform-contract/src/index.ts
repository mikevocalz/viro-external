export type XRPlatformFamily =
  | "viro-openxr"
  | "viro-visionos"
  | "web"
  | "viro-web"
  | "webspatial"
  | "meta-horizon-layout"
  | "pico-spatial"
  | "meta-wearables"
  | "snap-specs"
  | "unknown";

export type XRCapabilityState =
  | "supported"
  | "unsupported"
  | "permission-required"
  | "temporarily-unavailable"
  | "unverified";

export type XRCapabilityName =
  | "immersive-rendering"
  | "system-window"
  | "spatial-layout"
  | "multi-window"
  | "spatial-priority"
  | "spatial-fallback"
  | "spatial-volume"
  | "spatial-stage"
  | "spatial-web"
  | "responsive-web"
  | "pwa"
  | "browser-3d"
  | "webxr"
  | "eye-gaze"
  | "gaze-targeting"
  | "hand-tracking"
  | "pinch"
  | "controller"
  | "passthrough"
  | "camera"
  | "microphone"
  | "audio-output"
  | "display"
  | "motion"
  | "anchors"
  | "planes"
  | "scene-understanding"
  | "world-query"
  | "surface-placement"
  | "drag-manipulation"
  | "depth"
  | "location-navigation"
  | "volumetric-line"
  | "runtime-inspection"
  | "synthetic-interaction"
  | "local-floor";

export type XRCapabilityReport = Partial<
  Record<XRCapabilityName, XRCapabilityState>
>;

export type SpatialPresentation =
  | "inline"
  | "system-window"
  | "system-subwindow"
  | "spatial-augment"
  | "spatial-volume"
  | "spatial-stage"
  | "spatial-web-element"
  | "responsive-web"
  | "webxr-immersive"
  | "immersive-scene"
  | "wearable-display";

export type SpatialSurfaceRole =
  | "master"
  | "content"
  | "inspector"
  | "accessory"
  | "popup"
  | "volume"
  | "immersive";

export type SpatialPriorityTier =
  | "permanent"
  | "primary"
  | "popup"
  | "secondary"
  | "ephemeral";

export type SpatialSurfacePlacement =
  | "start"
  | "center"
  | "end"
  | "top"
  | "bottom"
  | "user";

export type SpatialSurfaceFallback = "inline" | "drop";

export type SpatialSurfaceIntent = {
  id: string;
  preferredPresentation: SpatialPresentation;
  fallback: SpatialSurfaceFallback;
  role?: SpatialSurfaceRole;
  priority?: number | SpatialPriorityTier;
  preferredSize?: { width: number; height: number; depth?: number };
  placement?: SpatialSurfacePlacement;
  promotable?: boolean;
  movable?: boolean;
  resizable?: boolean;
  opaqueRoot?: boolean;
};

export type SpatialWorkspaceIntent = {
  id: string;
  surfaces: readonly SpatialSurfaceIntent[];
  maxPromotedSurfaces?: number;
};

export type SpatialPlacementState =
  | "spatial"
  | "pending"
  | "inline"
  | "dropped"
  | "unavailable";

export type SpatialResolvedSurface = SpatialSurfaceIntent & {
  priorityValue: number;
};

export function spatialPriorityValue(
  priority: SpatialSurfaceIntent["priority"]
): number {
  if (typeof priority === "number") return priority;
  switch (priority) {
    case "permanent":
      return 4;
    case "primary":
      return 3;
    case "popup":
      return 2;
    case "secondary":
      return 1;
    case "ephemeral":
      return 0;
    default:
      return 1;
  }
}

export function resolveSpatialWorkspace(
  workspace: SpatialWorkspaceIntent
): SpatialResolvedSurface[] {
  return workspace.surfaces
    .map((surface) => ({
      ...surface,
      priorityValue: spatialPriorityValue(surface.priority),
    }))
    .sort((a, b) => b.priorityValue - a.priorityValue);
}

export type PortableXRNodeKind =
  | "group"
  | "text"
  | "image"
  | "model"
  | "panel";

export interface PortableXRNode {
  id: string;
  kind: PortableXRNodeKind;
  parentId?: string;
  position?: [number, number, number];
  rotation?: [number, number, number, number];
  scale?: [number, number, number];
  source?: string;
  text?: string;
  visible?: boolean;
}

export type XRInteractionSource =
  | "gaze"
  | "hand"
  | "pinch"
  | "controller"
  | "voice"
  | "touch"
  | "neural-band";

export type XRInteractionPhase =
  | "hover-enter"
  | "hover-move"
  | "hover-exit"
  | "select-start"
  | "select-end"
  | "drag"
  | "cancel";

export interface PortableXRInteraction {
  source: XRInteractionSource;
  phase: XRInteractionPhase;
  targetId?: string;
  position?: [number, number, number];
  direction?: [number, number, number];
  timestampMs?: number;
}

export interface XRPlatformAdapter {
  readonly family: XRPlatformFamily;
  getCapabilities(): Promise<XRCapabilityReport> | XRCapabilityReport;
  presentSurface?(intent: SpatialSurfaceIntent): Promise<void> | void;
  updatePortableScene?(nodes: readonly PortableXRNode[]): Promise<void> | void;
  dispose(): Promise<void> | void;
}
