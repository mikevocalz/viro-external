import type { SpatialPanelsHost } from "./SpatialPanelsHost";

/**
 * Compositor facts of the current OpenXR session, read from the runtime.
 *
 * @see {@link SpatialPanelsHost.getCapabilities}
 */
export interface PanelHostCapabilities {
  /** A session exists and accepts compositor panels. */
  readonly isSessionReady: boolean;
  /** Cylinder layers are enabled for this session. */
  readonly supportsCylinder: boolean;
  /** Layer budget for panels. A ceiling: panels past it are evicted, not refused at runtime. */
  readonly maxPanels: number;
  /** Rive is linked into this build and can share the session's GL context. */
  readonly supportsRive: boolean;
}
