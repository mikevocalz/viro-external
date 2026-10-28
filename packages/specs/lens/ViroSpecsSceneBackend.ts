/**
 * Contract between ViroSpecsSceneController and whatever draws the scene.
 *
 * The Lens implementation is ViroSpecsLensSceneBackend; tests use a mock
 * that records every call. The controller owns ordering, ownership and
 * diagnostics; a backend owns only "make this SceneObject look like this".
 *
 * Backends may throw. The controller catches every backend exception and
 * turns it into a host diagnostic, so a backend never has to.
 *
 * Dependency-free and free of Lens globals.
 */
import type {
  ViroSpecsDocumentInteraction,
  ViroSpecsDocumentLight,
  ViroSpecsDocumentMaterial,
  ViroSpecsDocumentPolyline,
  ViroSpecsExtents,
  ViroSpecsHostInteractionSource,
  ViroSpecsInteractionPhase,
  ViroSpecsNativeAnimationPlan,
  ViroSpecsQuat,
  ViroSpecsScroll,
  ViroSpecsVec3,
} from "./ViroSpecsProtocol";
import type { ViroSpecsHostNode, ViroSpecsResolvedTextStyle } from "./ViroSpecsSceneDocument";

/** Stops a scheduled callback or a subscription. Calling it twice is harmless. */
export type ViroSpecsCancel = () => void;

/**
 * Frame clock. On Lens this is DelayedCallbackEvent; in tests a manual queue.
 * Callbacks never run synchronously inside the scheduling call.
 */
export interface ViroSpecsHostScheduler {
  /** Runs `callback` on the next frame. */
  nextFrame(callback: () => void): ViroSpecsCancel;
  /** Runs `callback` after `seconds`. */
  after(seconds: number, callback: () => void): ViroSpecsCancel;
  /** Milliseconds since an arbitrary epoch, for event timestamps. */
  nowMs(): number;
}

/** Node kinds a backend creates. Lights and polylines get their own calls. */
export type ViroSpecsBackendNodeKind = ViroSpecsHostNode["kind"];

/** Transform in protocol units: meters, `[x, y, z, w]`. Absent means identity. */
export type ViroSpecsBackendTransform = {
  position: ViroSpecsVec3;
  rotation: ViroSpecsQuat;
  scale: ViroSpecsVec3;
};

/** Text content after style resolution. */
export type ViroSpecsBackendText = {
  text: string;
  style: ViroSpecsResolvedTextStyle;
  extents?: ViroSpecsExtents;
  maxLines?: number;
  /** Font asset name to use, or undefined for the default font. */
  fontFamily?: string;
};

/** UI state that survives patches and, for stable IDs, navigation. */
export type ViroSpecsNodeUiState = {
  /** Normalized scroll position of a scroll group, `[x, y]` in 0..1. */
  scrollNormalized?: [number, number];
};

/**
 * Row stepping of a SpatialScrollView group (`component.type` "scroll-view"),
 * passed to {@linkcode ViroSpecsSceneBackend.setScroll}.
 */
export type ViroSpecsScrollRows = {
  /** One row in meters; drags settle on whole rows. */
  stepMeters: number;
  /** Distance from the content top shown when the backend creates the window. */
  initialOffsetMeters: number;
};

/** Raw interaction a backend reports for one bound node. */
export type ViroSpecsBackendInteraction = {
  phase: ViroSpecsInteractionPhase;
  source: ViroSpecsHostInteractionSource;
  position?: ViroSpecsVec3;
  normal?: ViroSpecsVec3;
  direction?: ViroSpecsVec3;
};

/**
 * Drawing operations. `N` is the backend's node handle, `A` an asset handle
 * (texture or prefab), `M` a material handle.
 */
export interface ViroSpecsSceneBackend<N, A, M> {
  /** Creates a disabled container for one scene. Staging builds under it. */
  createSceneRoot(revision: number): N;
  /** Shows or hides a scene root or node subtree without changing `visible`. */
  setEnabled(node: N, enabled: boolean): void;
  /** Creates the SceneObject and kind-specific components for `spec` under `parent`. */
  createNode(spec: ViroSpecsHostNode, parent: N): N;
  /** Moves `node` under `parent`, keeping its local transform. */
  setParent(node: N, parent: N): void;
  /** Destroys `node`, its children and everything it owns. */
  destroy(node: N): void;

  setTransform(node: N, transform: ViroSpecsBackendTransform): void;
  setVisible(node: N, visible: boolean): void;
  /** 0..1. The backend clones whatever materials it must, and owns the clones. */
  setOpacity(node: N, opacity: number): void;
  setText(node: N, text: ViroSpecsBackendText): void;
  /** Size of an image or panel surface in meters. */
  setExtents(node: N, extents: ViroSpecsExtents): void;
  /**
   * Makes `node` a vertical scroll window. Content `y = 0` is the window's top
   * edge. The first call creates the window at the content top, or at
   * `rows.initialOffsetMeters`; later calls resize it and keep the position.
   */
  setScroll(node: N, scroll: ViroSpecsScroll, rows?: ViroSpecsScrollRows): void;
  /** Moves a scroll window's content by `deltaMeters` (positive is further down the list), clamped to its ends. */
  scrollBy(node: N, deltaMeters: number): void;
  /** Binds a loaded image texture or model prefab. */
  setAsset(node: N, asset: A): void;
  /**
   * Shows a bounded tinted box in place of a missing asset. Returns false
   * when the backend has nothing to draw it with.
   */
  showPlaceholder(node: N, extents: ViroSpecsExtents): boolean;
  clearPlaceholder(node: N): void;
  /** Applies a material, or the backend default when `material` is null. */
  setMaterial(node: N, material: M | null): void;

  /** Starts loading an asset. Sync registries return the asset or null. */
  loadAsset(kind: "image" | "model", source: string): A | null | Promise<A | null>;
  /** A material the app registered. Borrowed: the controller never disposes it. */
  resolveMaterial(id: string): M | null;
  /** Builds a material the controller owns. Null when the backend has no base material. */
  createMaterial(definition: ViroSpecsDocumentMaterial, texture: A | null): M | null;
  disposeMaterial(material: M): void;
  /** Whether a font with this family name is registered. */
  hasFont(family: string): boolean;

  createLight(light: ViroSpecsDocumentLight, parent: N): N;
  createPolyline(line: ViroSpecsDocumentPolyline, material: M | null, parent: N): N;

  /** Makes `node` interactable. The returned cancel unbinds and releases SIK state. */
  bindInteraction(
    node: N,
    interaction: ViroSpecsDocumentInteraction,
    emit: (event: ViroSpecsBackendInteraction) => void
  ): ViroSpecsCancel;
  /** Plays one animation. `onComplete` fires once for `single` playback. Cancel stops it. */
  playAnimation(node: N, plan: ViroSpecsNativeAnimationPlan, onComplete: () => void): ViroSpecsCancel;

  captureUiState(node: N): ViroSpecsNodeUiState;
  restoreUiState(node: N, state: ViroSpecsNodeUiState): void;
}
