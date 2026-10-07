export type EsikuBackendFamily =
  | "openxr"
  | "android-xr"
  | "viture-native"
  | "rayneo-native"
  | "visionos"
  | "wearable";

export type EsikuTarget =
  | "android-xr"
  | "xreal-aura"
  | "rayneo"
  | "viture"
  | "vive-eagle"
  | "steam-frame"
  | "quest"
  | "vision-pro"
  | "unknown";

export type EsikuCapability =
  | "stereo-display"
  | "head-pose"
  | "pose-6dof"
  | "hand-tracking"
  | "eye-gaze"
  | "passthrough"
  | "camera"
  | "depth"
  | "planes"
  | "scene-understanding"
  | "world-anchors"
  | "controller"
  | "touch"
  | "gesture"
  | "haptics"
  | "spatial-audio"
  | "microphone"
  | "voice-input"
  | "voice-output"
  | "wearable-display"
  | "device-control";

export type EsikuCapabilityState =
  | "supported"
  | "unsupported"
  | "permission-required"
  | "temporarily-unavailable"
  | "unverified";

export type EsikuCapabilityReport = Partial<
  Record<EsikuCapability, EsikuCapabilityState>
>;

export interface EsikuDeviceProfile {
  target: EsikuTarget;
  backend: EsikuBackendFamily;
  runtime?: string;
  model?: string;
  capabilities: EsikuCapabilityReport;
}

export interface EsikuPose {
  position: [number, number, number];
  rotation: [number, number, number, number];
  timestampNs: number;
}

export interface EsikuInputEvent {
  source: "gaze" | "hand" | "controller" | "touch" | "gesture" | "voice";
  phase: "hover-enter" | "hover-move" | "hover-exit" | "select-start" | "select-end" | "drag" | "cancel";
  targetId?: string;
  position?: [number, number, number];
  direction?: [number, number, number];
  timestampNs: number;
}

export interface EsikuFrame {
  pose?: EsikuPose;
  inputs: readonly EsikuInputEvent[];
}

export interface EsikuRuntimeAdapter {
  readonly backend: EsikuBackendFamily;
  negotiate(): Promise<EsikuDeviceProfile> | EsikuDeviceProfile;
  beginSession?(): Promise<void> | void;
  pollFrame?(): Promise<EsikuFrame> | EsikuFrame;
  endSession?(): Promise<void> | void;
}

/**
 * Resolve the native lane from negotiated runtime facts.
 *
 * Device/model strings are diagnostic. Feature gating belongs to the
 * capability report so new Android XR hardware can share one OpenXR path.
 */
export function selectEsikuBackend(
  profile: Pick<EsikuDeviceProfile, "target" | "capabilities">
): EsikuBackendFamily {
  if (profile.target === "viture") return "viture-native";
  if (profile.target === "vive-eagle") return "wearable";
  if (profile.target === "vision-pro") return "visionos";

  if (
    profile.target === "rayneo" &&
    profile.capabilities["stereo-display"] === "supported" &&
    profile.capabilities["head-pose"] === "supported"
  ) {
    return "openxr";
  }

  if (
    profile.target === "android-xr" ||
    profile.target === "xreal-aura" ||
    profile.target === "steam-frame" ||
    profile.target === "quest"
  ) {
    return "openxr";
  }

  return "openxr";
}
