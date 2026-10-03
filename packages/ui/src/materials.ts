import { ViroMaterials } from "@reactvision/react-viro";

/**
 * Colours are #RRGGBBAA: React Native's processColor, which Viro uses, reads
 * the last byte as alpha.
 */
export const PremiumMaterials = {
  panel: "vxp_ui_panel",
  panelGlass: "vxp_ui_panel_glass",
  header: "vxp_ui_header",
  button: "vxp_ui_button",
  buttonHover: "vxp_ui_button_hover",
  buttonDisabled: "vxp_ui_button_disabled",
  rail: "vxp_ui_scroll_rail",
  thumb: "vxp_ui_scroll_thumb",
} as const;

/**
 * renderingOrder for panel layers. Viro sorts translucent geometry by
 * distance, which flips as the head moves, so a backing drawn after the video
 * or text in front of it covers them. Backings always draw first.
 */
export const RenderOrder = { panel: -2, backing: -1 } as const;

let registered = false;

export function registerPremiumMaterials(): void {
  if (registered) return;
  registered = true;

  ViroMaterials.createMaterials({
    [PremiumMaterials.panel]: {
      diffuseColor: "#181B24F2",
      lightingModel: "Constant",
    },
    [PremiumMaterials.panelGlass]: {
      diffuseColor: "#222733D5",
      lightingModel: "Constant",
    },
    [PremiumMaterials.header]: {
      diffuseColor: "#2A2F3CF5",
      lightingModel: "Constant",
    },
    [PremiumMaterials.button]: {
      diffuseColor: "#3A4152F4",
      lightingModel: "Constant",
    },
    [PremiumMaterials.buttonHover]: {
      diffuseColor: "#587CFFFF",
      lightingModel: "Constant",
    },
    [PremiumMaterials.buttonDisabled]: {
      diffuseColor: "#40475599",
      lightingModel: "Constant",
    },
    [PremiumMaterials.rail]: {
      diffuseColor: "#343B4AAA",
      lightingModel: "Constant",
    },
    [PremiumMaterials.thumb]: {
      diffuseColor: "#E4E9F5FF",
      lightingModel: "Constant",
    },
  });
}
