export type XRPlatformFamily =
  | "viro-openxr"
  | "viro-visionos"
  | "viro-web"
  | "webspatial"
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
  | "spatial-web"
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
  | "spatial-web-element"
  | "immersive-scene"
  | "wearable-display";

export type SpatialSurfaceIntent = {
  id: string;
  preferredPresentation: SpatialPresentation;
  fallback: "inline" | "drop";
  preferredSize?: { width: number; height: number };
  placement?: "start" | "center" | "end" | "user";
  movable?: boolean;
  resizable?: boolean;
};

export type PortableXRNodeKind =
  | "group"
  | "text"
  | "image"
  | "model"
  | "panel"
  | "scroll"
  | "video";

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
