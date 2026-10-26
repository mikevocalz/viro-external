import type { PanelHostCapabilities } from "../PanelHostCapabilities";
import type { PanelShape } from "../PanelShape";
import type { RiveFit } from "../RiveFit";
import type { NativeCompositorPanel } from "./NativeCompositorPanel";

/** Mirrors CompositorPanelOptions.kt. */
export interface NativeCompositorPanelOptions {
  id: string;
  shape: PanelShape;
  position: number[];
  orientation: number[];
  widthM: number;
  heightM: number;
  widthPx: number;
  heightPx: number;
  cylinderRadiusM: number;
  cornerRadiusM: number;
  visible: boolean;
  artboard: string;
  stateMachine: string;
  fit: RiveFit;
  alignmentX: number;
  alignmentY: number;
  clearColor: number;
  maxFrameRateHz: number;
}

/** The `ViroSpatialPanels` Expo module (android/.../SpatialPanelsModule.kt). */
export interface NativeSpatialPanelsModule {
  getCapabilities(): Promise<PanelHostCapabilities>;
  createRiveCompositorPanel(options: NativeCompositorPanelOptions, riveFile: Uint8Array): Promise<NativeCompositorPanel>;
}
