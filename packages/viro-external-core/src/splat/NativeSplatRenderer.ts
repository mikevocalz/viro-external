/**
 * Capability-detection seam for the native Gaussian-splat renderer.
 *
 * Per PROMPT-4 rule 3: capability detection is correct engineering. If the native
 * path (WebGPU/TypeGPU compute + the ViroGPUTexture bridge) is not present, we
 * report an honest error — we do NOT fake the splat with a particle-field or .glb
 * approximation.
 *
 * Two native paths exist:
 *  - Legacy `ViroSplatRenderer` — texture-bound path via ViroGPUTexture.
 *  - New `ViroSplatPass` (from `@viro-external/splat-pass`) — render-pass
 *    inserted directly into VROChoreographer.
 * `isNativeSplatRendererAvailable()` returns true if EITHER is registered.
 */

import { NativeModules, Platform } from "react-native";

export interface NativeSplatRendererModule {
  /** Returns true iff a GPU-compute capable splat renderer is registered on this build. */
  isAvailable(): boolean;

  /** Device profile id as known to native (`quest2`, `quest3`, `arkit`, ...). */
  deviceProfile(): string;
}

const RAW_LEGACY = (NativeModules as Record<string, unknown>)["ViroSplatRenderer"];
const RAW_PASS = (NativeModules as Record<string, unknown>)["ViroSplatPass"];

export function getNativeSplatRenderer(): NativeSplatRendererModule | null {
  if (!RAW_LEGACY) return null;
  const mod = RAW_LEGACY as Partial<NativeSplatRendererModule>;
  if (typeof mod.isAvailable !== "function") return null;
  if (typeof mod.deviceProfile !== "function") return null;
  return mod as NativeSplatRendererModule;
}

function isLegacyAvailable(): boolean {
  return getNativeSplatRenderer()?.isAvailable() ?? false;
}

function isPassAvailable(): boolean {
  if (!RAW_PASS) return false;
  const mod = RAW_PASS as { isAvailable?: () => boolean };
  if (typeof mod.isAvailable !== "function") return false;
  return mod.isAvailable();
}

export function isNativeSplatRendererAvailable(): boolean {
  return isLegacyAvailable() || isPassAvailable();
}

/** Best-effort device profile id without the native module (used only as a fallback display value). */
export function fallbackDeviceProfile(): string {
  if (Platform.OS === "ios") return "arkit";
  if (Platform.OS === "android") return "unknown";
  return "unknown";
}
