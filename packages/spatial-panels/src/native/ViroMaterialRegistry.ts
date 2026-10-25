/**
 * The two ViroMaterials calls the host makes, so tests can pass a fake.
 * Production passes `ViroMaterials` from @reactvision/react-viro.
 */
export interface ViroMaterialRegistry {
  createMaterials(materials: Record<string, Record<string, unknown>>): void;
  deleteMaterials(names: string[]): void;
}
