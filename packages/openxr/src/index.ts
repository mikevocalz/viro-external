import type {
  XRCapabilityName,
  XRCapabilityReport,
  XRCapabilityState,
  XRPlatformAdapter,
} from "@viro-external/xr-contract";

export type OpenXRExtensionSet = ReadonlySet<string>;

export interface OpenXRRuntimeProbe {
  runtimeName?: string;
  runtimeVersion?: string;
  systemName?: string;
  extensions: OpenXRExtensionSet;
}

export type OpenXRTargetHint =
  | "android-xr"
  | "xreal-aura"
  | "rayneo"
  | "steam-frame"
  | "quest"
  | "unknown";

const EXTENSIONS: Partial<Record<XRCapabilityName, readonly string[]>> = {
  "hand-tracking": ["XR_EXT_hand_tracking", "XR_ANDROID_hand_mesh"],
  "eye-gaze": ["XR_EXT_eye_gaze_interaction", "XR_ANDROID_eye_tracking"],
  passthrough: [
    "XR_FB_passthrough",
    "XR_ANDROID_composition_layer_passthrough_mesh",
  ],
  camera: ["XR_ANDROID_passthrough_camera_state"],
  depth: ["XR_ANDROID_depth_texture", "XR_KHR_composition_layer_depth"],
  planes: ["XR_EXT_plane_detection", "XR_ANDROID_trackables"],
  "scene-understanding": ["XR_FB_scene", "XR_ANDROID_trackables"],
  anchors: [
    "XR_EXT_spatial_anchor",
    "XR_ANDROID_spatial_anchor_space",
    "XR_FB_spatial_entity",
  ],
  "world-query": ["XR_EXT_spatial_entity_query", "XR_FB_spatial_entity_query"],
};

function state(
  extensions: OpenXRExtensionSet,
  names: readonly string[] | undefined
): XRCapabilityState {
  if (!names?.length) return "unverified";
  return names.some((name) => extensions.has(name))
    ? "supported"
    : "unsupported";
}

export function probeOpenXRCapabilities(
  probe: OpenXRRuntimeProbe
): XRCapabilityReport {
  const report: XRCapabilityReport = {
    "immersive-rendering": "supported",
    display: "supported",
    motion: "supported",
    controller: "supported",
    "runtime-inspection": "supported",
  };

  for (const capability of Object.keys(EXTENSIONS) as XRCapabilityName[]) {
    report[capability] = state(probe.extensions, EXTENSIONS[capability]);
  }

  return report;
}

export class EsikuOpenXRAdapter implements XRPlatformAdapter {
  readonly family = "viro-openxr" as const;

  constructor(
    private readonly probe: OpenXRRuntimeProbe,
    readonly target: OpenXRTargetHint = "unknown"
  ) {}

  getCapabilities(): XRCapabilityReport {
    return probeOpenXRCapabilities(this.probe);
  }

  dispose(): void {
    // Native session ownership remains with the ViroCore runtime.
  }
}
