import type { RiveFit } from "../specs/RiveFit";
import type { RivePanel } from "../specs/RivePanel.nitro";
import type { RivePanelState } from "../specs/RivePanelState";
import type { mountNativeRivePanel } from "./mountNativeRivePanel";
import type { NativeRiveRuntime } from "./NativeRiveRuntime";

/** Options for {@linkcode mountNativeRivePanel}. */
export interface NativeRivePanelMountOptions {
  rive: NativeRiveRuntime;
  /** `ViroMaterials`, or a stand-in in tests. */
  materials: {
    createMaterials(materials: Record<string, unknown>): void;
    deleteMaterials(names: string[]): void;
  };
  rivBytes: ArrayBuffer;
  artboardName?: string;
  stateMachineName?: string;
  fit: RiveFit;
  surfaceId: number;
  materialName: string;
  widthPx: number;
  heightPx: number;
  /** Quad size in meters. */
  widthM: number;
  heightM: number;
  /** Corner radius in meters; 0 for square corners. */
  cornerRadiusM: number;
  lightingModel: string;
  fallbackColor: string;
  blendMode: "PremultiplyAlpha" | "None";
  maxFrameRateHz: number;
  onPanel(panel: RivePanel): void;
  onState(state: RivePanelState, detail: string): void;
  onError(error: Error): void;
}
