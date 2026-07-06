import type { HybridObject } from "react-native-nitro-modules";

/**
 * Nitro spec for the external GPU texture bridge (Android v1).
 *
 * Mirrors the frozen surface in `src/contract.ts` (`ViroGPUTextureModule`),
 * plus the per-frame / lifecycle methods from TASKS.md Phase 2:
 *   - registerExternalTexture(materialName, source) → handle
 *   - updateTexture(id)   — per-frame dirty signal (no-op on the
 *                           surface-producer path; see doc/TextureBridge.md)
 *   - releaseTexture(id)  — releases the renderer-side wrapper
 *
 * iOS is intentionally NOT declared yet — the Metal/IOSurface path lands
 * later. Adding `ios: 'swift'` to the platforms map is an additive change.
 */

/** Keep in sync with `ExternalTextureHandle["kind"]` in contract.ts. */
export type ExternalTextureKind =
  | "iosurface"
  | "gl-2d"
  | "gl-external-oes"
  | "surface-producer";

export type ExternalTextureColorSpace = "srgb" | "linear";

/** Struct mirror of `ExternalTextureSource` in contract.ts. */
export interface NitroExternalTextureSource {
  id: number;
  kind: ExternalTextureKind;
  width: number;
  height: number;
  colorSpace: ExternalTextureColorSpace;
}

/** Struct mirror of `ExternalTextureHandle` in contract.ts. */
export interface NitroExternalTextureHandle {
  id: number;
  kind: ExternalTextureKind;
  width: number;
  height: number;
  colorSpace: ExternalTextureColorSpace;
  nativeToken: number;
}

export interface ViroGPUTextureModule
  extends HybridObject<{ android: "kotlin" }> {
  /**
   * Register an external texture and bind it to `materialName`'s diffuse slot.
   *
   * v1 (Android) implements `kind: "surface-producer"`: the module creates a
   * SurfaceTexture-backed GL_TEXTURE_EXTERNAL_OES texture inside the Viro GL
   * context, binds it to the named material, and exposes the producer-facing
   * android.view.Surface via the native-side surface registry
   * (`ViroGPUTextureSurfaces.getSurface(handle.id)` in Kotlin). Binding is
   * asynchronous under the hood (renderer thread); poll `isSurfaceReady`.
   *
   * Throws for kinds not implemented on the current platform.
   */
  registerExternalTexture(
    materialName: string,
    source: NitroExternalTextureSource
  ): NitroExternalTextureHandle;

  /**
   * Per-frame dirty signal. No-op on the surface-producer path: the renderer's
   * frame-listener pump calls SurfaceTexture.updateTexImage() every rendered
   * frame already (VideoSink pattern).
   */
  updateTexture(id: number): void;

  /** Release the renderer-side wrapper. Idempotent. Does NOT free producer GPU memory. */
  releaseTexture(id: number): void;

  /** True once the producer-facing Surface exists and the material is bound. */
  isSurfaceReady(id: number): boolean;
}
