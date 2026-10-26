import type { PanelBackend } from "./PanelBackend";
import type { PanelPose } from "./PanelPose";
import type { PanelShape } from "./PanelShape";
import type { RivePanelContent } from "./RivePanelContent";
import type { SpatialPanelsHost } from "./SpatialPanelsHost";

/**
 * Options for {@link SpatialPanelsHost.createCompositorPanel}.
 */
export interface CompositorPanelOptions {
  /** Unique among the session's compositor panels. */
  readonly id: string;
  /** @default "quad" */
  readonly shape?: PanelShape;
  readonly pose: PanelPose;
  /** Panel width in metres (the arc length for a cylinder). */
  readonly widthM: number;
  readonly heightM: number;
  /** Rendered width, 16 to 4096. */
  readonly widthPx: number;
  /** Rendered height, 16 to 4096. */
  readonly heightPx: number;
  /** Required for a cylinder: the circle's radius in metres. */
  readonly cylinderRadiusM?: number;
  /**
   * Rounded-corner radius in metres, read from the panel tokens. The layer
   * and the scene fallback use the same shared coverage function.
   * @default 0
   */
  readonly cornerRadiusM?: number;
  /** @default true */
  readonly isVisible?: boolean;
  /**
   * Acceptable backends in priority order. `["compositor"]` forbids the scene
   * fallback: an evicted panel then shows nothing until a layer slot frees.
   * @default ["compositor", "scene"]
   */
  readonly presentation?: readonly PanelBackend[];
  readonly content: RivePanelContent;
}
