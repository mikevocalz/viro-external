export type SpecsUpstreamRole =
  | "runtime"
  | "rendering"
  | "interaction"
  | "world"
  | "navigation"
  | "camera"
  | "network"
  | "testing"
  | "utility";

export type SpecsUpstreamPackage = {
  name: string;
  role: SpecsUpstreamRole;
  required: boolean;
  purpose: string;
};

export const SPECS_UPSTREAM = {
  repository: "specs-devs/packages",
  commit: "df8820c0c4970f052e545b8da1dd288c2516d912",
  target: "SPECS 27",
  lensStudio: ">=5.22.0",
  legacySpectacles2024Branch: "5.15.4",
  licensePath: "LICENSE.md",
} as const;

export const SPECS_UPSTREAM_PACKAGES = [
  {
    name: "AccessComponents",
    role: "utility",
    required: true,
    purpose: "SceneObject/component lookup and hierarchy access patterns.",
  },
  {
    name: "Instantiation",
    role: "rendering",
    required: true,
    purpose: "Runtime prefab and object creation for Viro node/model parity.",
  },
  {
    name: "AnimationExamples",
    role: "rendering",
    required: true,
    purpose: "Native AnimationPlayer, curves, tracks, events, and authored assets.",
  },
  {
    name: "SpecsInteractionKitExamples",
    role: "interaction",
    required: true,
    purpose: "SIK interaction and UIKit reference implementations.",
  },
  {
    // Ships from the Lens Studio Asset Library, not from specs-devs/packages.
    name: "SpectaclesUIKit",
    role: "interaction",
    required: true,
    purpose: "UI Kit Frame (panel chrome, grab, resize) and ScrollWindow.",
  },
  {
    name: "InteractableHelper",
    role: "interaction",
    required: true,
    purpose: "Low-level interactable wiring for hover/select/manipulation.",
  },
  {
    name: "WorldQueryHit",
    role: "world",
    required: true,
    purpose: "WorldQueryModule raycasts and real-world surface hit tests.",
  },
  {
    name: "SurfacePlacement",
    role: "world",
    required: true,
    purpose: "Horizontal, vertical, and near-surface placement.",
  },
  {
    name: "Solvers",
    role: "world",
    required: false,
    purpose: "Spatial behaviors useful for head/world relative layout parity.",
  },
  {
    name: "SpecsNavigationKit",
    role: "navigation",
    required: false,
    purpose: "Location-aware AR navigation and place/user-position primitives.",
  },
  {
    name: "VolumetricLine",
    role: "rendering",
    required: false,
    purpose: "Runtime 3D path mesh suitable for ViroPolyline parity.",
  },
  {
    name: "SpecsShaderLibrary",
    role: "rendering",
    required: false,
    purpose: "Power-conscious material/shader fallbacks for Specs.",
  },
  {
    name: "RuntimeGizmos",
    role: "utility",
    required: false,
    purpose: "Runtime spatial debugging and visualization.",
  },
  {
    name: "CompositeCameraTexture",
    role: "camera",
    required: false,
    purpose: "Camera texture compositing.",
  },
  {
    name: "CropCameraTexture",
    role: "camera",
    required: false,
    purpose: "Camera crop/ROI processing.",
  },
  {
    name: "HandAttacher",
    role: "interaction",
    required: false,
    purpose: "Attach scene content to tracked hand joints.",
  },
  {
    name: "Specs3DHandHints",
    role: "interaction",
    required: false,
    purpose: "On-device gesture instruction and feedback.",
  },
  {
    name: "WebSocketExamples",
    role: "network",
    required: false,
    purpose: "Realtime bidirectional transport reference implementation.",
  },
  {
    name: "AiPreviewAgentInspect",
    role: "testing",
    required: false,
    purpose: "Inspect a running Lens and capture renderer state.",
  },
  {
    name: "AiPreviewAgentInteract",
    role: "testing",
    required: false,
    purpose: "Synthetic pinch, poke, and drag for end-to-end validation.",
  },
] as const satisfies readonly SpecsUpstreamPackage[];

export type SpecsUpstreamPackageName =
  (typeof SPECS_UPSTREAM_PACKAGES)[number]["name"];

export function getSpecsUpstreamPackage(
  name: SpecsUpstreamPackageName
): SpecsUpstreamPackage {
  const match = SPECS_UPSTREAM_PACKAGES.find((entry) => entry.name === name);
  if (!match) {
    throw new Error(`Unknown Specs upstream package: ${name}`);
  }
  return match;
}

export function getRequiredSpecsUpstreamPackages(): readonly SpecsUpstreamPackage[] {
  return SPECS_UPSTREAM_PACKAGES.filter((entry) => entry.required);
}
