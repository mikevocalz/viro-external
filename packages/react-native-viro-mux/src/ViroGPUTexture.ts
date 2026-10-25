/**
 * JS entry for the external GPU texture bridge. Adapts the frozen contract
 * (`src/contract.ts`) onto the Nitro Hybrid Object
 * (`src/spec/ViroGPUTextureModule.nitro.ts`).
 *
 * Android v1 implements `kind: "surface-producer"` — see doc/TextureBridge.md.
 * iOS throws until the Metal/IOSurface path lands.
 */

import * as generated from "#nitro/ViroGPUTextureModule";
import type { ExternalTextureHandle, ExternalTextureSource } from "./contract";
import type { ViroGPUTextureModule as ViroGPUTextureModuleClass } from "./spec/ViroGPUTextureModule.nitro";

// Bind to the nitrogen-generated runtime, not the spec module. The spec uses
// `@Android(...)` decorators, which @react-native/babel-preset cannot parse
// without `parserOpts: { plugins: ['decorators'] }`; this package ships `src/`,
// so consumers would bundle the spec. The type-only import is erased.
const runtime = generated as unknown as {
  readonly ViroGPUTextureModule: typeof ViroGPUTextureModuleClass;
};

// The generated getter resolves `viromux.ViroGPUTextureModule` on first read.
// Read it per call, never at module scope, so importing the package (e.g. on
// iOS, which has no implementation) never touches the native lib.
function nitroClass(): typeof ViroGPUTextureModuleClass {
  return runtime.ViroGPUTextureModule;
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
  const handle = nitroClass().registerExternalTexture(materialName, {
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
  nitroClass().releaseTexture(handle.id);
}

/**
 * Per-frame dirty signal. No-op on the Android `surface-producer` path (the
 * renderer pumps SurfaceTexture.updateTexImage every frame); reserved for
 * future fence-gated paths.
 */
export function updateExternalTexture(handle: ExternalTextureHandle): void {
  nitroClass().updateTexture(handle.id);
}

/**
 * True once the producer-facing android.view.Surface exists and the material
 * is bound. Native producers fetch the Surface via
 * `com.margelo.nitro.viromux.ViroGPUTextureSurfaces.getSurface(handle.id)`.
 */
export function isExternalTextureReady(handle: ExternalTextureHandle): boolean {
  return nitroClass().isSurfaceReady(handle.id);
}
