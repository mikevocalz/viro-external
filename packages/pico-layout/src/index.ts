import type {
  SpatialSurfaceIntent,
  XRCapabilityReport,
  XRPlatformAdapter,
} from "@viro-external/xr-contract";

export type PicoSpatialPrimitive =
  | "window-container-planar"
  | "window-container-volume"
  | "subwindow-start"
  | "subwindow-end"
  | "augment"
  | "toolbar"
  | "tab-bar"
  | "spatial-popup"
  | "attachment-panel"
  | "stage"
  | "inline";

export type PicoSpatialRuntime = {
  isSpatialAvailable: boolean;
  supportsWindowContainer?: boolean;
  supportsSubwindow?: boolean;
  supportsAugment?: boolean;
  supportsToolbar?: boolean;
  supportsSpatialPopup?: boolean;
  supportsVolume?: boolean;
  supportsStage?: boolean;
  supportsAttachmentPanel?: boolean;
};

export type PicoResolvedSurface = {
  id: string;
  primitive: PicoSpatialPrimitive;
  fallback: "inline" | "drop";
  width?: number;
  height?: number;
  depth?: number;
  resizable: boolean;
};

function sideFor(intent: SpatialSurfaceIntent): "start" | "end" {
  // Only "start" and "end" name a side. Anything else ("center", "top", ...)
  // falls back to the role default: master to start, everything else to end.
  // Matches resolvePicoLayoutPrimitive in @expo-pico/spatial.
  if (intent.placement === "start" || intent.placement === "end") {
    return intent.placement;
  }
  return intent.role === "master" ? "start" : "end";
}

export function resolvePicoSpatialPrimitive(
  intent: SpatialSurfaceIntent,
  runtime: PicoSpatialRuntime
): PicoSpatialPrimitive {
  if (!runtime.isSpatialAvailable) return "inline";

  switch (intent.role) {
    case "master":
      if (runtime.supportsSubwindow) {
        return sideFor(intent) === "start" ? "subwindow-start" : "subwindow-end";
      }
      return runtime.supportsAugment ? "augment" : "inline";
    case "inspector":
      if (runtime.supportsSubwindow) {
        return sideFor(intent) === "start" ? "subwindow-start" : "subwindow-end";
      }
      return runtime.supportsAugment ? "augment" : "inline";
    case "accessory":
      return runtime.supportsToolbar
        ? "toolbar"
        : runtime.supportsAugment
          ? "augment"
          : "inline";
    case "popup":
      return runtime.supportsSpatialPopup
        ? "spatial-popup"
        : runtime.supportsAugment
          ? "augment"
          : "inline";
    case "volume":
      return runtime.supportsVolume ? "window-container-volume" : "inline";
    case "immersive":
      return runtime.supportsStage ? "stage" : "inline";
    case "content":
      return runtime.supportsWindowContainer ? "window-container-planar" : "inline";
    default:
      if (intent.preferredPresentation === "spatial-volume" && runtime.supportsVolume) {
        return "window-container-volume";
      }
      if (intent.preferredPresentation === "spatial-stage" && runtime.supportsStage) {
        return "stage";
      }
      if (runtime.supportsAttachmentPanel) return "attachment-panel";
      return runtime.supportsAugment ? "augment" : "inline";
  }
}

export function resolvePicoSurface(
  intent: SpatialSurfaceIntent,
  runtime: PicoSpatialRuntime
): PicoResolvedSurface {
  return {
    id: intent.id,
    primitive: resolvePicoSpatialPrimitive(intent, runtime),
    fallback: intent.fallback,
    width: intent.preferredSize?.width,
    height: intent.preferredSize?.height,
    depth: intent.preferredSize?.depth,
    resizable: intent.resizable ?? true,
  };
}

export class PicoSpatialLayoutAdapter implements XRPlatformAdapter {
  readonly family = "pico-spatial" as const;

  constructor(private runtime: PicoSpatialRuntime = { isSpatialAvailable: false }) {}

  setRuntime(runtime: PicoSpatialRuntime): void {
    this.runtime = runtime;
  }

  getCapabilities(): XRCapabilityReport {
    // Flags describe SDK classes the caller probed, not bound native calls.
    // Nothing is "supported" until expo-pico binds and device-validates it.
    const spatial = this.runtime.isSpatialAvailable ? "unverified" : "unsupported";

    return {
      "system-window": this.runtime.supportsWindowContainer ? spatial : "unsupported",
      "spatial-layout": spatial,
      "multi-window":
        this.runtime.supportsSubwindow || this.runtime.supportsAugment
          ? spatial
          : "unsupported",
      "spatial-fallback": "unverified",
      "spatial-volume": this.runtime.supportsVolume ? spatial : "unsupported",
      "spatial-stage": this.runtime.supportsStage ? spatial : "unsupported",
      "surface-placement":
        this.runtime.supportsAugment || this.runtime.supportsAttachmentPanel
          ? spatial
          : "unsupported",
      display: "unverified",
    };
  }

  dispose(): void {}
}
