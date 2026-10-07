import type {
  SpatialSurfaceIntent,
  XRCapabilityReport,
  XRPlatformAdapter,
} from "@viro-external/xr-contract";
import { spatialPriorityValue } from "@viro-external/xr-contract";

export type MetaAnchor =
  | "center"
  | "start"
  | "end"
  | "left"
  | "right"
  | "top"
  | "bottom";

export type MetaSpatialWindowProps = {
  label: string;
  windowWidth: number;
  windowHeight: number;
  priority: number;
  promotable: boolean;
  anchor: MetaAnchor;
  fallback: "inline" | "drop";
};

export type MetaHorizonLayoutRuntime = {
  isSpatialAvailable: boolean;
  maxPromotedWindows?: number;
};

export const META_HORIZON_LAYOUT_MIN_OS = 207;
export const META_HORIZON_RN_DEFAULT_SLOT_BUDGET = 2;

function anchorFor(intent: SpatialSurfaceIntent): MetaAnchor {
  switch (intent.placement) {
    case "start":
    case "end":
    case "top":
    case "bottom":
    case "center":
      return intent.placement;
    case "user":
      return "center";
    default:
      // Keep slot continuity when no placement is given:
      // master = start, inspector = end, everything else = center.
      if (intent.role === "master") return "start";
      if (intent.role === "inspector") return "end";
      return "center";
  }
}

export function toMetaSpatialWindowProps(
  intent: SpatialSurfaceIntent
): MetaSpatialWindowProps {
  const size = intent.preferredSize ?? { width: 360, height: 480 };

  return {
    label: intent.id,
    windowWidth: size.width,
    windowHeight: size.height,
    priority: spatialPriorityValue(intent.priority),
    promotable: intent.promotable ?? true,
    anchor: anchorFor(intent),
    fallback: intent.fallback,
  };
}

export class MetaHorizonLayoutAdapter implements XRPlatformAdapter {
  readonly family = "meta-horizon-layout" as const;

  constructor(
    private runtime: MetaHorizonLayoutRuntime = {
      isSpatialAvailable: false,
      maxPromotedWindows: META_HORIZON_RN_DEFAULT_SLOT_BUDGET,
    }
  ) {}

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
