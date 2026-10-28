/**
 * Lens Studio-side asset registry for the Viro Specs backend.
 *
 * Portable Viro scene payloads use stable string source IDs. Lens Studio assets
 * are editor/import-time objects, so this registry maps those IDs to imported
 * ObjectPrefab, Texture, and Material assets without leaking Lens asset handles
 * into shared application code.
 */
@component
export class ViroSpecsAssetRegistry extends BaseScriptComponent {
  @input
  modelIds: string[] = [];

  @input
  modelPrefabs: ObjectPrefab[] = [];

  @input
  imageIds: string[] = [];

  @input
  imageTextures: Texture[] = [];

  @input
  materialIds: string[] = [];

  @input
  materials: Material[] = [];

  @input
  @allowUndefined
  defaultPanelPrefab: ObjectPrefab | null = null;

  @input
  @allowUndefined
  defaultFont: Font | null = null;

  @input
  @allowUndefined
  defaultImageMaterial: Material | null = null;

  /** Font assets by fontFamily name, for manifest text style. */
  @input
  fontIds: string[] = [];

  @input
  fonts: Font[] = [];

  /**
   * Unlit material the scene host clones for missing-asset placeholders.
   * Falls back to defaultImageMaterial.
   */
  @input
  @allowUndefined
  placeholderMaterial: Material | null = null;

  /**
   * Base material the scene host clones for scene-defined materials
   * (`materials` in a protocol 2 scene). Falls back to defaultImageMaterial.
   */
  @input
  @allowUndefined
  defaultMaterial: Material | null = null;

  /** Material for polylines without a materialId. */
  @input
  @allowUndefined
  defaultLineMaterial: Material | null = null;

  /**
   * Registers or replaces an image at runtime, for textures that only exist
   * once the Lens is running (remote media, WebView, camera crops). Nodes
   * whose `source` is `id` resolve to it on their next render.
   */
  registerImage(id: string, texture: Texture): void {
    if (!id || !texture) throw new Error("registerImage requires an id and a texture");
    // Inspector arrays may be read-only at runtime and shorter than their ids,
    // so rebuild both, aligned, instead of mutating them.
    const ids = this.imageIds.slice();
    const textures = ids.map((_, i) => this.imageTextures[i] ?? (null as unknown as Texture));
    const index = ids.indexOf(id);
    if (index >= 0) {
      textures[index] = texture;
    } else {
      ids.push(id);
      textures.push(texture);
    }
    this.imageIds = ids;
    this.imageTextures = textures;
  }

  resolveModel(source: string): ObjectPrefab | null {
    return this.resolveById(source, this.modelIds, this.modelPrefabs);
  }

  resolveImage(source: string): Texture | null {
    return this.resolveById(source, this.imageIds, this.imageTextures);
  }

  resolveMaterial(source: string): Material | null {
    return this.resolveById(source, this.materialIds, this.materials);
  }

  resolveFont(family: string): Font | null {
    return this.resolveById(family, this.fontIds, this.fonts);
  }

  private resolveById<T>(
    source: string,
    ids: readonly string[],
    assets: readonly T[]
  ): T | null {
    const index = ids.indexOf(source);
    if (index < 0 || index >= assets.length) {
      return null;
    }
    return assets[index] ?? null;
  }
}
