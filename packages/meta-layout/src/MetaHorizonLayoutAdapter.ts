import type { XRCapabilityReport, XRPlatformAdapter } from "@viro-external/xr-contract";
import type { MetaHorizonLayoutRuntime } from "./runtime";
import { META_HORIZON_RN_DEFAULT_SLOT_BUDGET } from "./runtime";

/** Capability reporter for the Meta Horizon Layout runtime. */
export class MetaHorizonLayoutAdapter implements XRPlatformAdapter {
  readonly family = "meta-horizon-layout" as const;

  private runtime: MetaHorizonLayoutRuntime;

  constructor(
    runtime: MetaHorizonLayoutRuntime = {
      isSpatialAvailable: false,
      maxPromotedWindows: META_HORIZON_RN_DEFAULT_SLOT_BUDGET,
    }
  ) {
    this.runtime = runtime;
  }

  setRuntime(runtime: MetaHorizonLayoutRuntime): void {
    this.runtime = runtime;
  }

  getCapabilities(): XRCapabilityReport {
    // This package maps props only. Nothing here creates a SpatialWindow, so a
    // capability is "unverified" until a native path proves it on device.
    const spatial = this.runtime.isSpatialAvailable ? "unverified" : "unsupported";

    return {
      "system-window": spatial,
      "spatial-layout": spatial,
      "multi-window": spatial,
      "spatial-priority": spatial,
      "spatial-fallback": "unverified",
      display: "unverified",
    };
  }

  dispose(): void {}
}
