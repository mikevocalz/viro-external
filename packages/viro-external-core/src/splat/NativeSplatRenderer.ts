/**
 * Capability-detection seam for the native Gaussian-splat renderer.
 *
 * Per PROMPT-4 rule 3: capability detection is correct engineering. If the native
 * path (WebGPU/TypeGPU compute + the ViroGPUTexture bridge) is not present, we
 * report an honest error — we do NOT fake the splat with a particle-field or .glb
 * approximation.
 */

import { NativeModules, Platform } from "react-native";

export interface NativeSplatRendererModule {
  /** Returns true iff a GPU-compute capable splat renderer is registered on this build. */
  isAvailable(): boolean;

  /** Device profile id as known to native (`quest2`, `quest3`, `arkit`, ...). */
  deviceProfile(): string;
}

const RAW = (NativeModules as Record<string, unknown>)["ViroSplatRenderer"];

export function getNativeSplatRenderer(): NativeSplatRendererModule | null {
  if (!RAW) return null;
  const mod = RAW as Partial<NativeSplatRendererModule>;
  if (typeof mod.isAvailable !== "function") return null;
  if (typeof mod.deviceProfile !== "function") return null;
  return mod as NativeSplatRendererModule;
}

export function isNativeSplatRendererAvailable(): boolean {
  return getNativeSplatRenderer()?.isAvailable() ?? false;
}

/** Best-effort device profile id without the native module (used only as a fallback display value). */
export function fallbackDeviceProfile(): string {
  if (Platform.OS === "ios") return "arkit";
  if (Platform.OS === "android") return "unknown";
  return "unknown";
}
