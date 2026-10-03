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

/**
 * Discriminator for the portable node variants.
 *
 * @see {@linkcode PortableXRNode}
 */
export type PortableXRNodeKind =
  | "group"
  | "text"
  | "image"
  | "model"
  | "panel"
  | "surface"
  | "scroll"
  | "video";

/**
 * Placement every portable node shares.
 *
 * Positions and rotations are meters and a `[x, y, z, w]` quaternion in the
 * node's parent space. Adapters convert to their platform's units.
 *
 * @see {@linkcode PortableXRNode}
 */
export interface PortableXRNodeBase {
  id: string;
  parentId?: string;
  position?: [number, number, number];
  rotation?: [number, number, number, number];
  visible?: boolean;
}

/**
 * A node scaled by a unitless multiplier, the way a mesh or a container is.
 *
 * Surfaces are measured instead — see {@linkcode PortableXRSizedNode}.
 */
export interface PortableXRScaledNode extends PortableXRNodeBase {
  /** Multiplier per axis. Defaults to `[1, 1, 1]`. */
  scale?: [number, number, number];
}

/**
 * A flat surface measured in meters rather than scaled.
 *
 * Scale is meaningless for these: a platform lays them out from a width and a
 * height, so `[0.14, 0.14]` is a 14 cm square at any parent scale.
 */
export interface PortableXRSizedNode extends PortableXRNodeBase {
  /** `[width, height]` in meters. */
  sizeMeters?: [number, number];
}

/** An empty container used to group and transform its children. */
export interface PortableXRGroupNode extends PortableXRScaledNode {
  kind: "group";
}

/** A text label. @see {@linkcode PortableXRNode} */
export interface PortableXRTextNode extends PortableXRScaledNode {
  kind: "text";
  text: string;
  /**
   * Wrap the text into a left-aligned block this wide, in meters, growing
   * downward from `position`. Omit for a single centred line.
   */
  wrapWidthMeters?: number;
}

/** A 3D model resolved from the adapter's asset registry by {@linkcode PortableXRModelNode.source}. */
export interface PortableXRModelNode extends PortableXRScaledNode {
  kind: "model";
  /** Registry id of the model asset. */
  source: string;
}

/**
 * How a texture fills a surface whose aspect ratio differs from its own.
 *
 * @see {@linkcode PortableXRImageNode.fit}
 */
export type PortableXRSurfaceFit =
  /** Scale uniformly until the surface is covered; overflow is cropped. */
  | "cover"
  /** Scale uniformly until the whole texture fits; may letterbox. */
  | "contain"
  /** Scale each axis independently to fill exactly; may distort. */
  | "stretch";

/** A still image surface. */
export interface PortableXRImageNode extends PortableXRSizedNode {
  kind: "image";
  /** Registry id of the image asset. */
  source: string;
  /**
   * How the texture fills {@linkcode PortableXRSizedNode.sizeMeters}.
   *
   * @default "cover"
   */
  fit?: PortableXRSurfaceFit;
}

/** A video surface. Playback starts when the node is created and loops. */
export interface PortableXRVideoNode extends PortableXRSizedNode {
  kind: "video";
  /** Registry id of the video asset. */
  source: string;
  /**
   * How the video frame fills {@linkcode PortableXRSizedNode.sizeMeters}.
   *
   * @default "cover"
   */
  fit?: PortableXRSurfaceFit;
  /**
   * Show the host's playback controls (play/pause, seek, time) under the
   * video. Playback still starts and loops on its own.
   */
  controls?: boolean;
}

/**
 * Linear RGBA, each channel 0-1.
 *
 * @see {@linkcode PortableXRPanelNode.tint}
 */
export type PortableXRColor = [number, number, number, number];

/** A framed container that situates its children in space. */
export interface PortableXRPanelNode extends PortableXRSizedNode {
  kind: "panel";
  /**
   * Surface colour. A platform's default panel chrome is tuned for its own
   * shell and rarely carries enough contrast inside a product, so set this
   * when the panel has to read against an unknown background.
   */
  tint?: PortableXRColor;
  /** Corner rounding in meters. Omit for the platform default. */
  cornerRadiusMeters?: number;
}

/**
 * A flat tinted rectangle with no chrome.
 *
 * Use it for the pieces that sit inside a panel — a header strip, a button
 * face, a scroll rail. A {@linkcode PortableXRPanelNode} is a container that
 * situates content in space and carries grab and resize affordances, so using
 * one per decorative rectangle produces a scene full of separate floating
 * panes.
 */
export interface PortableXRSurfaceNode extends PortableXRSizedNode {
  kind: "surface";
  /** Fill colour. @see {@linkcode PortableXRColor} */
  tint?: PortableXRColor;
  /** Corner rounding in meters. */
  cornerRadiusMeters?: number;
}

/** A clipped, scrollable region. Children scroll within {@linkcode PortableXRSizedNode.sizeMeters}. */
export interface PortableXRScrollNode extends PortableXRSizedNode {
  kind: "scroll";
  /**
   * Height of the scrollable content in meters. Children are laid out from
   * the content's centre, so its top edge is at `+contentHeightMeters / 2`.
   * The region opens scrolled to the top. Omit when the content fits.
   */
  contentHeightMeters?: number;
}

/**
 * One node of a portable XR scene.
 *
 * A variant carries only the fields its kind needs, so a video without a
 * `source` or a panel with a `text` will not typecheck.
 *
 * @see {@linkcode XRPlatformAdapter.updatePortableScene}
 */
export type PortableXRNode =
  | PortableXRGroupNode
  | PortableXRTextNode
  | PortableXRModelNode
  | PortableXRImageNode
  | PortableXRVideoNode
  | PortableXRPanelNode
  | PortableXRSurfaceNode
  | PortableXRScrollNode;

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
