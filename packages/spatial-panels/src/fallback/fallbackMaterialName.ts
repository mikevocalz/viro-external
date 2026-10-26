/** The Viro material name that carries a panel's scene fallback texture. */
export function fallbackMaterialName(panelId: string): string {
  return `viro-external.spatial-panels.${panelId}.fallback`;
}
