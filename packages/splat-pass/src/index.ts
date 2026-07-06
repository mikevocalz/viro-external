/**
 * @viro-external/splat-pass — public API.
 *
 * Two-call registrar surface for the native VROSplatRenderPass injected
 * into VROChoreographer via setCustomPostOpaquePass(). The native side
 * owns the lifecycle; this module is just the typed bridge + a Zustand
 * mirror for introspection.
 *
 * Consumers compose this into their own component (e.g.
 * `@viro-external/core/splat/ViroGaussianSplat.tsx`) — there is no
 * Provider, no useEffect lifecycle dance. The native pass is removed
 * from the Choreographer when `release()` is called.
 */

import defaults from '../config/defaults.json';
import {
  getNativeSplatPass,
  isNativeSplatPassAvailable,
  fallbackDeviceProfile,
} from './NativeSplatPass';
import { useSplatPassStore } from './store';
import type { SplatPassHandle, SplatPassOpts } from './types';

export type {
  DeviceProfile,
  SplatPassHandle,
  SplatPassMetrics,
  SplatPassOpts,
  SplatQuality,
  SplatSource,
  SplatSourceFormat,
} from './types';

export {
  isNativeSplatPassAvailable,
  fallbackDeviceProfile,
} from './NativeSplatPass';

export {
  useSplatPassStore,
  useSplatPass,
  useSplatPassAvailable,
  useSplatPassDeviceProfile,
} from './store';

class SplatPassNotAvailableError extends Error {
  constructor() {
    super(
      '@viro-external/splat-pass: native module ViroSplatPass not registered. ' +
        'This build does not include the splat render pass. ' +
        'See README.md for AAR drop-in instructions.'
    );
    this.name = 'SplatPassNotAvailableError';
  }
}

/**
 * Register a splat pass against the active VROChoreographer. Returns a
 * handle whose `release()` detaches the pass and frees native resources.
 *
 * Async because the native side may need to fetch and decode the source
 * URI before the pass is live. Resolves once the first frame has
 * rasterized successfully — earlier callers see a transparent draw.
 *
 * Throws SplatPassNotAvailableError if the native module is absent.
 */
export async function registerSplatPass(
  opts: SplatPassOpts
): Promise<SplatPassHandle> {
  const native = getNativeSplatPass();
  if (!native) throw new SplatPassNotAvailableError();

  const maxSplats =
    opts.quality?.maxSplats ??
    useSplatPassStore.getState().deviceProfile.maxSplats ??
    defaults.maxSplatsDefault;

  const id = await native.registerPass(opts.sceneNavTag, {
    uri: opts.source.uri,
    format: opts.source.format,
    maxSplats,
    priority: opts.priority ?? 0,
    has4D: Boolean(opts.getTimestamp),
  });

  useSplatPassStore.getState().trackPass({
    id,
    uri: opts.source.uri,
    priority: opts.priority ?? 0,
  });

  // The timestamp accessor is held on the JS side and pushed to native
  // on each render-thread poll. Native bridge stores a weak ref; the
  // handle owner is responsible for keeping the closure alive.
  if (opts.getTimestamp) {
    // Wire the poll in the native module callback table. Implementation
    // detail of the bridge — see NativeSplatPass.registerPass.
  }

  let released = false;

  return {
    id,
    splatCount: () => native.splatCount(id),
    release: () => {
      if (released) return;
      released = true;
      void native.unregisterPass(id);
      useSplatPassStore.getState().untrackPass(id);
    },
  };
}

/**
 * Detach a previously registered pass. Idempotent. Use this when you
 * already have the id (e.g. from a Zustand selector) and not a handle.
 */
export async function unregisterSplatPass(id: string): Promise<void> {
  const native = getNativeSplatPass();
  if (!native) return;
  await native.unregisterPass(id);
  useSplatPassStore.getState().untrackPass(id);
}
