import { ViroMaterials } from "@reactvision/react-viro";

/**
 * D.E.C.A. cyber theme — the orb's ember palette (deep red → rose over dark
 * chrome, additive neon glow). Shared by the radial menu, the account panel,
 * and any HUD element that should read as part of D.E.C.A.'s presence.
 *
 * Colors are Android-order #AARRGGBB (alpha FIRST). Orb embers: deep red
 * #FF3040, mid #FF5060, light rose #FF7888.
 */
export const DecaTheme = {
  plate: "vxg_deca_plate",
  plateHover: "vxg_deca_plate_hover",
  back: "vxg_deca_back",
  ember: "vxg_deca_ember",
  emberHot: "vxg_deca_ember_hot",
  emberDim: "vxg_deca_ember_dim",
  rose: "vxg_deca_rose",
  hit: "vxg_deca_hit",
} as const;

let registered = false;
export function registerDecaTheme(): void {
  if (registered) return;
  registered = true;
  ViroMaterials.createMaterials({
    // Near-opaque dark chrome with a red bias — the glass the embers sit on.
    [DecaTheme.plate]: { diffuseColor: "#F0140909", lightingModel: "Constant" },
    [DecaTheme.plateHover]: { diffuseColor: "#F0241012", lightingModel: "Constant" },
    [DecaTheme.back]: { diffuseColor: "#F51A0A0A", lightingModel: "Constant" },
    // Additive ember glow — idle deep red, hot mid-red, dim + rose accents.
    [DecaTheme.ember]: { diffuseColor: "#9CFF3040", lightingModel: "Constant", blendMode: "Add" },
    [DecaTheme.emberHot]: { diffuseColor: "#F0FF5060", lightingModel: "Constant", blendMode: "Add" },
    [DecaTheme.emberDim]: { diffuseColor: "#48FF3040", lightingModel: "Constant", blendMode: "Add" },
    [DecaTheme.rose]: { diffuseColor: "#D8FF7888", lightingModel: "Constant", blendMode: "Add" },
    [DecaTheme.hit]: { diffuseColor: "#000000", lightingModel: "Constant" },
  });
}
