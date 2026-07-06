/**
 * JS entry for the external GPU texture bridge. Adapts the frozen contract
 * (`src/contract.ts`) onto the Nitro Hybrid Object
 * (`src/spec/ViroGPUTextureModule.nitro.ts`).
 *
 * Android v1 implements `kind: "surface-producer"` — see doc/TextureBridge.md.
 * iOS throws until the Metal/IOSurface path lands.
 */

import { NitroModules } from "react-native-nitro-modules";
import type { ExternalTextureHandle, ExternalTextureSource } from "./contract";
import type { ViroGPUTextureModule as NitroSpec } from "./spec/ViroGPUTextureModule.nitro";

let cached: NitroSpec | null = null;

/** Lazily created so merely importing the package never dereferences the native lib. */
function getModule(): NitroSpec {
  if (cached == null) {
    cached = NitroModules.createHybridObject<NitroSpec>("ViroGPUTextureModule");
  }
  return cached;
}

/**
 * Register an externally-produced GPU texture and bind it to `materialName`'s
 * diffuse slot. See `ViroGPUTextureModule` in contract.ts for semantics.
 *
 * The returned handle is synchronous; the underlying renderer binding is
 * asynchronous (renderer thread). Poll {@link isExternalTextureReady} before
 * pointing a producer at the surface.
 */
export function registerExternalTexture(
  materialName: string,
  source: ExternalTextureSource
): ExternalTextureHandle {
  const handle = getModule().registerExternalTexture(materialName, {
    id: source.id,
    kind: source.kind,
    width: source.width,
    height: source.height,
    colorSpace: source.colorSpace,
  });
  return {
    id: handle.id,
    kind: handle.kind,
    width: handle.width,
    height: handle.height,
    colorSpace: handle.colorSpace,
    nativeToken: handle.nativeToken,
  };
}

/** Release the renderer-side wrapper. Idempotent. Producer GPU memory is untouched. */
export function releaseExternalTexture(handle: ExternalTextureHandle): void {
  getModule().releaseTexture(handle.id);
}

/**
 * Per-frame dirty signal. No-op on the Android `surface-producer` path (the
 * renderer pumps SurfaceTexture.updateTexImage every frame); reserved for
 * future fence-gated paths.
 */
export function updateExternalTexture(handle: ExternalTextureHandle): void {
  getModule().updateTexture(handle.id);
}

/**
 * True once the producer-facing android.view.Surface exists and the material
 * is bound. Native producers fetch the Surface via
 * `com.margelo.nitro.viromux.ViroGPUTextureSurfaces.getSurface(handle.id)`.
 */
export function isExternalTextureReady(handle: ExternalTextureHandle): boolean {
  return getModule().isSurfaceReady(handle.id);
}
