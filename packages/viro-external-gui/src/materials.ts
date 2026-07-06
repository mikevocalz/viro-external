import { ViroMaterials } from "@reactvision/react-viro";

/**
 * Fluent-dark defaults (MRTK/Babylon HolographicBackplate palette). Registered
 * once; components fall back to these when no material props are given —
 * unmaterialed Viro geometry renders flat white otherwise.
 */
export const FluentMaterials = {
  buttonBack: "vxg_btn_back",
  buttonPlate: "vxg_btn_plate",
  buttonPlateHover: "vxg_btn_plate_hover",
  buttonGlow: "vxg_btn_glow",
  slateChrome: "vxg_slate_chrome",
  slateTitleBar: "vxg_slate_titlebar",
  slateContent: "vxg_slate_content",
  borderIdle: "vxg_border_idle",
  borderHover: "vxg_border_hover",
  iconIdle: "vxg_icon_idle",
  iconHover: "vxg_icon_hover",
  gizmoHandle: "vxg_gizmo_handle",
} as const;

let registered = false;
export function registerFluentMaterials(): void {
  if (registered) return;
  registered = true;
  // All colors are Android-order #AARRGGBB (alpha FIRST). Palette follows
  // Babylon GUI3D / MRTK dark Fluent: near-black #0F0F0F-ish backplates,
  // slightly lighter content plates, additive blue border glow.
  ViroMaterials.createMaterials({
    [FluentMaterials.buttonBack]: {
      diffuseColor: "#F50F1014",
      lightingModel: "Constant",
    },
    [FluentMaterials.buttonPlate]: {
      diffuseColor: "#FA1B1E25",
      lightingModel: "Constant",
    },
    [FluentMaterials.buttonPlateHover]: {
      diffuseColor: "#FA2B3040",
      lightingModel: "Constant",
    },
    [FluentMaterials.buttonGlow]: {
      diffuseColor: "#2EFFFFFF",
      lightingModel: "Constant",
      blendMode: "Add",
    },
    [FluentMaterials.slateChrome]: {
      diffuseColor: "#F8131418",
      lightingModel: "Constant",
    },
    // Title bar reads slightly lighter than the backplate — a visible grab
    // affordance, MRTK slate style.
    [FluentMaterials.slateTitleBar]: {
      diffuseColor: "#FA20232C",
      lightingModel: "Constant",
    },
    [FluentMaterials.slateContent]: {
      diffuseColor: "#F60C0D11",
      lightingModel: "Constant",
    },
    // MRTK-blue border glow — idle is faint, hover flares (additive).
    [FluentMaterials.borderIdle]: {
      diffuseColor: "#405E8AE0",
      lightingModel: "Constant",
      blendMode: "Add",
    },
    [FluentMaterials.borderHover]: {
      diffuseColor: "#907FB2FF",
      lightingModel: "Constant",
      blendMode: "Add",
    },
    [FluentMaterials.iconIdle]: {
      diffuseColor: "#F22A2E38",
      lightingModel: "Constant",
    },
    vxgMuxBlackout: {
      diffuseColor: "#FF000000",
      lightingModel: "Constant",
      cullMode: "None",
    },
    [FluentMaterials.gizmoHandle]: {
      diffuseColor: "#FFFFFFFF",
      lightingModel: "Constant",
    },
    [FluentMaterials.iconHover]: {
      diffuseColor: "#F2434A5C",
      lightingModel: "Constant",
    },
  });
}
