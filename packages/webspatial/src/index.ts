import type {
  SpatialSurfaceIntent,
  XRCapabilityReport,
  XRPlatformAdapter,
} from "@viro-external/xr-contract";

export { SpatialBoot } from "@webspatial/react-sdk";

export type WebSpatialRuntimeState = "ready" | "ordinary-web" | "unknown";
export type WebSpatialBackgroundMaterial =
  | "none"
  | "transparent"
  | "translucent"
  | "thin"
  | "regular"
  | "thick";

export type WebSpatialElementOptions = {
  back?: number | string;
  backgroundMaterial?: WebSpatialBackgroundMaterial;
  monitorParent?: boolean;
};

export type WebSpatialElementProps = {
  className: string;
  style: Record<string, string | number | boolean>;
  "data-viro-spatial-surface": string;
};

/**
 * Convert shared Viro surface intent into WebSpatial-compatible JSX props.
 * Apply the returned className/style to a normal DOM element.
 */
export function createWebSpatialElementProps(
  intent: SpatialSurfaceIntent,
  options: WebSpatialElementOptions = {}
): WebSpatialElementProps {
  const style: Record<string, string | number | boolean> = {
    position: "relative",
    enableXr: true,
  };

  if (options.back != null) {
    style["--xr-back"] =
      typeof options.back === "number" ? `${options.back}px` : options.back;
  }
  if (options.backgroundMaterial) {
    style["--xr-background-material"] = options.backgroundMaterial;
  }

  return {
    className: "__enableXr__",
    style,
    "data-viro-spatial-surface": intent.id,
  };
}

export type WebSpatialMainScene = {
  type: "window" | "volume";
  default_size?: {
    width?: number;
    height?: number;
    depth?: number | string;
  };
  resizability?: {
    min_width?: number;
    max_width?: number;
    min_height?: number;
    max_height?: number;
  };
  world_scaling?: "automatic" | "dynamic";
  world_alignment?: "automatic" | "gravityAligned";
  baseplate_visibility?: "automatic" | "hidden";
};

/** Build the `xr_main_scene` portion of a Web App Manifest. */
export function createWebSpatialMainScene(
  intent: SpatialSurfaceIntent,
  options: {
    type?: "window" | "volume";
    minScale?: number;
    maxScale?: number;
    worldScaling?: "automatic" | "dynamic";
    worldAlignment?: "automatic" | "gravityAligned";
    baseplateVisibility?: "automatic" | "hidden";
  } = {}
): WebSpatialMainScene {
  const size = intent.preferredSize;
  const scene: WebSpatialMainScene = {
    type: options.type ?? "window",
    ...(options.worldScaling ? { world_scaling: options.worldScaling } : {}),
    ...(options.worldAlignment ? { world_alignment: options.worldAlignment } : {}),
    ...(options.baseplateVisibility
      ? { baseplate_visibility: options.baseplateVisibility }
      : {}),
  };

  if (size) {
    scene.default_size = { width: size.width, height: size.height };
    if (intent.resizable) {
      const minScale = options.minScale ?? 0.6;
      const maxScale = options.maxScale ?? 1.5;
      scene.resizability = {
        min_width: Math.round(size.width * minScale),
        max_width: Math.round(size.width * maxScale),
        min_height: Math.round(size.height * minScale),
        max_height: Math.round(size.height * maxScale),
      };
    }
  }

  return scene;
}

export class WebSpatialAdapter implements XRPlatformAdapter {
  readonly family = "webspatial" as const;

  constructor(private runtimeState: WebSpatialRuntimeState = "unknown") {}

  setRuntimeState(state: WebSpatialRuntimeState): void {
    this.runtimeState = state;
  }

  getCapabilities(): XRCapabilityReport {
    const spatialState =
      this.runtimeState === "ready"
        ? "supported"
        : this.runtimeState === "ordinary-web"
          ? "unsupported"
          : "unverified";

    return {
      "responsive-web": "supported",
      "spatial-web": spatialState,
      "spatial-layout": spatialState,
      "spatial-volume": spatialState,
      "spatial-fallback": "supported",
      "system-window": spatialState,
      display: "supported",
    };
  }

  dispose(): void {}
}
