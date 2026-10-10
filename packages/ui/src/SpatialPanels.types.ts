/**
 * API DESIGN SKETCH — NOT THE RUNTIME HOST.
 * The current SpatialPanel renders Viro scene geometry.
 * Do not export a createCompositorPanel function until the native host exists.
 * See docs/SPATIAL_PANELS_API.md.
 */

/** Preferred panel backends in priority order. @platform android, ios, web */
export type PanelPresentation = "compositor" | "scene" | "system-window";

/** Post-negotiation state, never inferred from JavaScript package presence. */
export type ResolvedPanelPresentation =
  | { readonly kind: "compositor"; readonly shape: "quad" | "cylinder"; readonly isDepthTested: boolean }
  | { readonly kind: "scene" }
  | { readonly kind: "system-window" };

/** World-space coordinates in metres, with XYZW quaternion orientation. */
export interface PanelPose {
  readonly position: readonly [number, number, number];
  readonly orientation: readonly [number, number, number, number];
}

/** Render target pixel resolution is distinct from physical dimensions. */
export interface PanelSize {
  /** Physical panel width in metres. */
  readonly widthM: number;
  /** Physical panel height in metres. */
  readonly heightM: number;
  /** Rendered pixel width (16–4096 for the GLES path). */
  readonly widthPx: number;
  /** Rendered pixel height (16–4096 for the GLES path). */
  readonly heightPx: number;
}

export interface CompositorPanelOptions extends PanelSize {
  /** Stable panel identifier; the host must reject collisions. */
  readonly id: string;
  /** Prefer a cylinder over a quad when the runtime supports it. @default false */
  readonly curved?: boolean;
  /** Initial panel pose in the current world-locked workspace. */
  readonly pose: PanelPose;
}

export type PanelEvictionReason =
  | "layer-budget"
  | "runtime-resource-limit"
  | "session-stopped";

export interface PanelEvictedEvent {
  readonly reason: PanelEvictionReason;
}

export interface PanelPointerEvent {
  readonly action: "down" | "move" | "up" | "cancel" | "hover";
  readonly xPx: number;
  readonly yPx: number;
  readonly source: "controller" | "hand";
}

export interface PanelSubscription {
  /** Unsubscribe before disposing a panel. */
  remove(): void;
}

/**
 * Stable capability snapshot from the OpenXR/OS host.
 * @platform android
 */
export interface PanelHostCapabilities {
  readonly supportsCompositorPanels: boolean;
  readonly supportsCurvedCompositorPanels: boolean;
  readonly supportsDepthTestedPanels: boolean;
  readonly supportsSystemWindows: boolean;
  readonly maxCompositorPanels: number;
}

/** A native resource; callers must dispose even after RN reloads. @platform android */
export interface CompositorPanelHandle {
  readonly id: string;
  /** Enqueue pose update on the Viro renderer thread. */
  setPose(pose: PanelPose): void;
  /** Enqueue visibility update. */
  setVisible(isVisible: boolean): void;
  /** Reallocate backing Surface and display; resolves after allocation. */
  resize(size: PanelSize): Promise<void>;
  /** Idempotently close native content and destroy its swapchain. */
  dispose(): void;
  /** Fires when the host demotes this panel; the handle is unusable afterwards. */
  addOnEvictedListener(callback: (event: PanelEvictedEvent) => void): PanelSubscription;
  addOnPointerListener(callback: (event: PanelPointerEvent) => void): PanelSubscription;
}

/**
 * Proposed Expo Modules 2.0 SharedObject factory, not implemented.
 * @platform android
 */
export interface SpatialPanelsHost {
  readonly capabilities: PanelHostCapabilities;
  /** @throws COMPOSITOR_UNAVAILABLE when no supported swapchain is available.
   *  @throws PANEL_INVALID_ARGUMENT for invalid pose/size/id.
   *  @throws PANEL_DUPLICATE_ID for a collision.
   */
  createCompositorPanel(options: CompositorPanelOptions): Promise<CompositorPanelHandle>;
}

export interface SpatialPanelPresentationIntent {
  /**
   * Rank acceptable backends. An array with only 'compositor' makes it a
   * requirement; no silent mesh fallback is permitted.
   * @default ['compositor', 'scene']
   */
  readonly presentation?: readonly PanelPresentation[];
  /** Fires whenever runtime promotion or eviction changes the actual backend. */
  readonly onPresentationChange?: (result: ResolvedPanelPresentation) => void;
}
