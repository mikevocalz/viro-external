import { ViroMaterials } from "@reactvision/react-viro";

export const PremiumMaterials = {
  panel: "vxp_ui_panel",
  panelGlass: "vxp_ui_panel_glass",
  header: "vxp_ui_header",
  button: "vxp_ui_button",
  buttonHover: "vxp_ui_button_hover",
  buttonDisabled: "vxp_ui_button_disabled",
  rail: "vxp_ui_scroll_rail",
  thumb: "vxp_ui_scroll_thumb",
  panelEdge: "vxp_ui_panel_edge",
  panelHighlight: "vxp_ui_panel_highlight",
  buttonEdge: "vxp_ui_button_edge",
  buttonHighlight: "vxp_ui_button_highlight",
} as const;

let registered = false;

export function registerPremiumMaterials(): void {
  if (registered) return;
  registered = true;

  ViroMaterials.createMaterials({
    [PremiumMaterials.panel]: {
      diffuseColor: "#F2181B24",
      lightingModel: "Constant",
    },
    [PremiumMaterials.panelGlass]: {
      diffuseColor: "#D5222733",
      lightingModel: "Constant",
    },
    [PremiumMaterials.header]: {
      diffuseColor: "#F52A2F3C",
      lightingModel: "Constant",
    },
    [PremiumMaterials.button]: {
      diffuseColor: "#F43A4152",
      lightingModel: "Constant",
    },
    [PremiumMaterials.buttonHover]: {
      diffuseColor: "#FF587CFF",
      lightingModel: "Constant",
    },
    [PremiumMaterials.buttonDisabled]: {
      diffuseColor: "#99404755",
      lightingModel: "Constant",
    },
    [PremiumMaterials.rail]: {
      diffuseColor: "#AA343B4A",
      lightingModel: "Constant",
    },
    [PremiumMaterials.panelEdge]: {
      diffuseColor: "#FF070A10",
      lightingModel: "Blinn",
    },
    [PremiumMaterials.panelHighlight]: {
      diffuseColor: "#4AFFFFFF",
      lightingModel: "Constant",
    },
    [PremiumMaterials.buttonEdge]: {
      diffuseColor: "#FF090C14",
      lightingModel: "Blinn",
    },
    [PremiumMaterials.buttonHighlight]: {
      diffuseColor: "#55FFFFFF",
      lightingModel: "Constant",
    },
    [PremiumMaterials.thumb]: {
      diffuseColor: "#FFE4E9F5",
      lightingModel: "Constant",
    },
  });
}
