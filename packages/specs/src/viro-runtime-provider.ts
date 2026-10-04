import type { XRCapabilityReport } from "@viro-external/xr-contract";
import { getSpecsRuntime, type SpecsRuntimeInfo } from "./runtime.js";

export type ViroRuntimeCapabilityState =
  | "supported"
  | "unsupported"
  | "permission-required"
  | "temporarily-unavailable"
  | "unverified";

export type ViroRuntimeSnapshotLike = {
  platform: "specs";
  runtime: "lens-studio";
  deviceFamily: "snap-specs";
  isSpecs: true;
  isHorizon: false;
  isPico: false;
  isVisionOS: false;
  isWeb: false;
  isPhysicalDevice: boolean;
  isSimulator: boolean;
  isEditor: boolean;
  capabilities: Record<string, ViroRuntimeCapabilityState>;
};

export type ViroRuntimeProviderLike = {
  getSnapshot(): ViroRuntimeSnapshotLike;
  subscribe?: (listener: () => void) => () => void;
};

const CAPABILITY_ALIASES: Record<string, string> = {
  controller: "controllers",
  planes: "plane-detection",
};

function normalizeCapabilityName(name: string): string {
  return CAPABILITY_ALIASES[name] ?? name;
}

export function specsCapabilitiesToViroRuntime(
  report: XRCapabilityReport
): Record<string, ViroRuntimeCapabilityState> {
  const result: Record<string, ViroRuntimeCapabilityState> = {};

  for (const [name, state] of Object.entries(report)) {
    result[normalizeCapabilityName(name)] = state;
  }

  return result;
}

/**
 * Structural adapter for @reactvision/react-viro's registerViroXRRuntimeProvider().
 *
 * The function intentionally returns a shape instead of importing Viro so the
 * two packages remain optional peers rather than creating a hard dependency
 * cycle.
 */
export function createViroSpecsRuntimeProvider(
  capabilities: XRCapabilityReport,
  runtime: SpecsRuntimeInfo = getSpecsRuntime()
): ViroRuntimeProviderLike {
  return {
    getSnapshot() {
      return {
        platform: "specs",
        runtime: "lens-studio",
        deviceFamily: "snap-specs",
        isSpecs: true,
        isHorizon: false,
        isPico: false,
        isVisionOS: false,
        isWeb: false,
        isPhysicalDevice: runtime.isDevice,
        isSimulator: runtime.isEditor && !runtime.isDevice,
        isEditor: runtime.isEditor,
        capabilities: specsCapabilitiesToViroRuntime(capabilities),
      };
    },
  };
}
