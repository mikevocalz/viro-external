import type { CompositorPanelHandle } from "./CompositorPanelHandle";
import type { CompositorPanelOptions } from "./CompositorPanelOptions";
import type { PanelHostCapabilities } from "./PanelHostCapabilities";
import type { SpatialPanelsError } from "./SpatialPanelsError";
import type { SpatialPanelsErrorCode } from "./SpatialPanelsErrorCode";
import type { spatialPanels } from "./spatialPanels";

/**
 * Creates compositor panels on the mounted ViroViewOpenXR. Android GLES only;
 * on iOS and visionOS {@link isAvailable} is false and every call rejects
 * with `COMPOSITOR_UNAVAILABLE`.
 *
 * @see {@link spatialPanels}
 */
export interface SpatialPanelsHost {
  /** The native module is linked into this build. */
  readonly isAvailable: boolean;
  /** Facts of the current session; all false and zero with no session. */
  getCapabilities(): Promise<PanelHostCapabilities>;
  /**
   * Resolves once the layer is registered and the .riv is queued.
   * @throws {SpatialPanelsError} with a {@link SpatialPanelsErrorCode}
   */
  createCompositorPanel(options: CompositorPanelOptions): Promise<CompositorPanelHandle>;
}
