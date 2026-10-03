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
  videoIds: string[] = [];

  // Lens imports a video as a Texture backed by a VideoTextureProvider, so this
  // stays a Texture array and the provider is read off control at playback.
  @input
  videoTextures: Texture[] = [];

  // ponytail: no longer read; UI Kit Frame draws panel chrome. Kept so scenes
  // that still assign it keep loading. Delete with the next scene migration.
  @input
  @allowUndefined
  defaultPanelPrefab: ObjectPrefab | null = null;

  @input
  @allowUndefined
  defaultFont: Font | null = null;

  @input
  @allowUndefined
  defaultImageMaterial: Material | null = null;

  resolveModel(source: string): ObjectPrefab | null {
    return this.resolveById(source, this.modelIds, this.modelPrefabs);
  }

  resolveImage(source: string): Texture | null {
    return this.resolveById(source, this.imageIds, this.imageTextures);
  }

  resolveMaterial(source: string): Material | null {
    return this.resolveById(source, this.materialIds, this.materials);
  }

  resolveVideo(source: string): Texture | null {
    return this.resolveById(source, this.videoIds, this.videoTextures);
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
