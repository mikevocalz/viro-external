import type { CompositorPanelFallback } from "../CompositorPanelFallback";
import type { PanelEvictionReason } from "../PanelEvictionReason";
import type { PanelPose } from "../PanelPose";
import type { PanelPresentation } from "../PanelPresentation";
import type { PanelShape } from "../PanelShape";

/**
 * What the scene fallback of one panel should show. Owned by a Zustand store
 * per panel; {@link CompositorPanelFallback} renders it.
 */
export interface FallbackState {
  readonly presentation: PanelPresentation;
  readonly reason: PanelEvictionReason;
  readonly hasFallback: boolean;
  readonly isPanelVisible: boolean;
  readonly isSceneAllowed: boolean;
  readonly isDisposed: boolean;
  /** Derived: evicted, texture bound, visible, scene allowed, not disposed. */
  readonly isFallbackVisible: boolean;
  readonly pose: PanelPose;
  readonly shape: PanelShape;
  readonly widthM: number;
  readonly heightM: number;
  readonly cylinderRadiusM: number;
  readonly materialName: string;
}
