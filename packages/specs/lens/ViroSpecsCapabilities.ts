import type { ViroSpecsCapabilityReport } from "./ViroSpecsProtocol";

export function createSpecsLensCapabilityReport(): ViroSpecsCapabilityReport {
  const isEditor = global.deviceInfoSystem.isEditor();

  return {
    "immersive-rendering": "supported",
    "display": "supported",
    "motion": "supported",
    "hand-tracking": "supported",
    "pinch": "supported",
    "gaze-targeting": "supported",
    "drag-manipulation": "supported",
    "world-query": "supported",
    "surface-placement": "supported",
    "volumetric-line": "supported",
    "location-navigation": "permission-required",
    "runtime-inspection": isEditor ? "supported" : "unsupported",
    "synthetic-interaction": isEditor ? "supported" : "unsupported",
    "audio-output": "supported",
    "camera": "permission-required",
    "microphone": "permission-required",

    // Keep these conservative until the runtime probes a concrete API path.
    "eye-gaze": "unverified",
    "anchors": "unverified",
    "planes": "unverified",
    "scene-understanding": "unverified",
    "depth": "unverified",
    "controller": "unsupported",
    "system-window": "unsupported",
    "spatial-web": "unsupported",
  };
}
