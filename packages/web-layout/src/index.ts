import type {
  SpatialSurfaceIntent,
  SpatialSurfaceRole,
  XRCapabilityReport,
  XRPlatformAdapter,
} from "@viro-external/xr-contract";

export type WebLayoutMode = "compact" | "dual-pane" | "triple-pane";

export type WebSpatialRuntimeKind =
  | "pico-os-6"
  | "visionos"
  | "planned-meta"
  | "none";

export type WebRuntimeEnvironment = {
  width: number;
  pwa?: boolean;
  webXR?: boolean;
  viroWeb?: boolean;
  browser3D?: boolean;
  webSpatial?: WebSpatialRuntimeKind;
};

export type WebSurfacePresentation =
  | "stack"
  | "drawer"
  | "main"
  | "rail"
  | "pane"
  | "inspector"
  | "sheet"
  | "toolbar"
  | "popover"
  | "webspatial-element"
  | "webspatial-volume"
  | "viro-web-canvas"
  | "webxr-immersive"
  | "drop";

export type ResolvedWebSurface = {
  id: string;
  role: SpatialSurfaceRole;
  presentation: WebSurfacePresentation;
  fallbackUsed: boolean;
};

export type WebBreakpoints = {
  dualPaneMinWidth: number;
  triplePaneMinWidth: number;
};

export const DEFAULT_WEB_BREAKPOINTS: WebBreakpoints = {
  dualPaneMinWidth: 768,
  triplePaneMinWidth: 1180,
};

export function resolveWebLayoutMode(
  width: number,
  breakpoints: WebBreakpoints = DEFAULT_WEB_BREAKPOINTS
): WebLayoutMode {
  if (width >= breakpoints.triplePaneMinWidth) return "triple-pane";
  if (width >= breakpoints.dualPaneMinWidth) return "dual-pane";
  return "compact";
}

function flatPresentation(
  role: SpatialSurfaceRole,
  mode: WebLayoutMode
): WebSurfacePresentation {
  switch (role) {
    case "master":
      return mode === "compact" ? "drawer" : mode === "dual-pane" ? "rail" : "pane";
    case "content":
      return "main";
    case "inspector":
      return mode === "compact" ? "sheet" : "inspector";
    case "accessory":
      return "toolbar";
    case "popup":
      return "popover";
    case "volume":
      return "main";
    case "immersive":
      return "main";
  }
}

export function resolveWebSurface(
  intent: SpatialSurfaceIntent,
  environment: WebRuntimeEnvironment
): ResolvedWebSurface {
  const role = intent.role ?? "content";
  const mode = resolveWebLayoutMode(environment.width);
  const hasWebSpatial =
    environment.webSpatial === "pico-os-6" ||
    environment.webSpatial === "visionos";

  if (intent.preferredPresentation === "spatial-web-element") {
    if (hasWebSpatial) {
      return {
        id: intent.id,
        role,
        presentation:
          role === "volume" ? "webspatial-volume" : "webspatial-element",
        fallbackUsed: false,
      };
    }

    return {
      id: intent.id,
      role,
      presentation:
        intent.fallback === "drop" ? "drop" : flatPresentation(role, mode),
      fallbackUsed: true,
    };
  }

  if (
    intent.preferredPresentation === "webxr-immersive" ||
    intent.preferredPresentation === "immersive-scene" ||
    role === "immersive"
  ) {
    if (environment.webXR) {
      return {
        id: intent.id,
        role,
        presentation: "webxr-immersive",
        fallbackUsed: false,
      };
    }

    // Viro Web is a browser 3D/AR canvas today; it is not a WebXR immersive
    // session. It is still the best non-immersive 3D fallback when available.
    if (environment.viroWeb) {
      return {
        id: intent.id,
        role,
        presentation: "viro-web-canvas",
        fallbackUsed: true,
      };
    }

    return {
      id: intent.id,
      role,
      presentation: intent.fallback === "drop" ? "drop" : "main",
      fallbackUsed: true,
    };
  }

  if (
    role === "volume" &&
    hasWebSpatial &&
    intent.preferredPresentation === "spatial-volume"
  ) {
    return {
      id: intent.id,
      role,
      presentation: "webspatial-volume",
      fallbackUsed: false,
    };
  }

  return {
    id: intent.id,
    role,
    presentation: flatPresentation(role, mode),
    fallbackUsed: false,
  };
}

export type WebWorkspaceStyle = Record<string, string | number>;

export function createWebWorkspaceStyle(
  mode: WebLayoutMode
): WebWorkspaceStyle {
  if (mode === "triple-pane") {
    return {
      display: "grid",
      gridTemplateColumns: "minmax(220px, 0.8fr) minmax(0, 2fr) minmax(280px, 1fr)",
      gridTemplateAreas: '"master content inspector" "accessory accessory accessory"',
      gap: 16,
      minWidth: 0,
      minHeight: 0,
    };
  }

  if (mode === "dual-pane") {
    return {
      display: "grid",
      gridTemplateColumns: "minmax(220px, 0.8fr) minmax(0, 2fr)",
      gridTemplateAreas: '"master content" "master inspector" "accessory accessory"',
      gap: 12,
      minWidth: 0,
      minHeight: 0,
    };
  }

  return {
    display: "grid",
    gridTemplateColumns: "minmax(0, 1fr)",
    gridTemplateAreas: '"content" "accessory"',
    gap: 8,
    minWidth: 0,
    minHeight: 0,
  };
}

export function createWebSurfaceStyle(
  role: SpatialSurfaceRole
): WebWorkspaceStyle {
  switch (role) {
    case "master":
      return { gridArea: "master", minWidth: 0, minHeight: 0 };
    case "content":
      return { gridArea: "content", minWidth: 0, minHeight: 0 };
    case "inspector":
      return { gridArea: "inspector", minWidth: 0, minHeight: 0 };
    case "accessory":
      return { gridArea: "accessory", minWidth: 0, minHeight: 0 };
    default:
      return { minWidth: 0, minHeight: 0 };
  }
}

export class WebLayoutAdapter implements XRPlatformAdapter {
  readonly family = "web" as const;

  constructor(private environment: WebRuntimeEnvironment) {}

  setEnvironment(environment: WebRuntimeEnvironment): void {
    this.environment = environment;
  }

  getCapabilities(): XRCapabilityReport {
    const webSpatial =
      this.environment.webSpatial === "pico-os-6" ||
      this.environment.webSpatial === "visionos";

    return {
      "responsive-web": "supported",
      pwa: this.environment.pwa ? "supported" : "unverified",
      "browser-3d":
        this.environment.browser3D || this.environment.viroWeb
          ? "supported"
          : "unverified",
      webxr: this.environment.webXR ? "supported" : "unsupported",
      "spatial-web": webSpatial
        ? "supported"
        : this.environment.webSpatial === "planned-meta"
          ? "unverified"
          : "unsupported",
      "spatial-layout": webSpatial ? "supported" : "unsupported",
      "spatial-volume": webSpatial ? "supported" : "unsupported",
      "immersive-rendering": this.environment.webXR
        ? "supported"
        : "unsupported",
      display: "supported",
    };
  }

  dispose(): void {}
}
