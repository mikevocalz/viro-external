/**
 * Capability-detection seam for the native splat-pass module. Mirrors the
 * legacy `@viro-external/core/splat/NativeSplatRenderer.ts` pattern so the
 * combined capability probe can union them.
 *
 * The native module is registered by libviro_renderer.so on builds that
 * include this pass; absent on stock Viro builds. Honest errors only —
 * never fake a splat.
 */

import { NativeModules, Platform } from 'react-native';
import type { DeviceProfile, SplatPassMetrics } from './types';

export interface NativeSplatPassModule {
  /** True iff the native render pass is registered with VROChoreographer. */
  isAvailable(): boolean;

  /** Device profile id as the native side knows it. */
  deviceProfile(): string;

  /**
   * Register a new splat pass against the choreographer owned by the
   * Viro scene-navigator at `sceneNavTag`. Returns the native pass id.
   * Throws if the native module is absent or the tag is not a
   * `VRT3DSceneNavigator`.
   */
  registerPass(
    sceneNavTag: number,
    opts: {
      uri: string;
      format: string;
      maxSplats: number;
      priority: number;
      has4D: boolean;
    }
  ): Promise<string>;

  /** Detach and free. Idempotent. */
  unregisterPass(id: string): Promise<void>;

  /** Read the live splat count for a registered pass. */
  splatCount(id: string): number;

  /** Pull the rolling-average metrics for inspection / overlay. */
  metrics(id: string): SplatPassMetrics;

  /** Read the active device profile. */
  getDeviceProfile(): DeviceProfile;
}

const RAW = (NativeModules as Record<string, unknown>)['ViroSplatPass'];

export function getNativeSplatPass(): NativeSplatPassModule | null {
  if (!RAW) return null;
  const mod = RAW as Partial<NativeSplatPassModule>;
  if (typeof mod.isAvailable !== 'function') return null;
  if (typeof mod.registerPass !== 'function') return null;
  if (typeof mod.unregisterPass !== 'function') return null;
  return mod as NativeSplatPassModule;
}

export function isNativeSplatPassAvailable(): boolean {
  return getNativeSplatPass()?.isAvailable() ?? false;
}

/**
 * Best-effort device profile id without the native module. Used only as
 * a display fallback when consumers introspect before the native bridge
 * has loaded.
 */
export function fallbackDeviceProfile(): DeviceProfile {
  const baseline: DeviceProfile = {
    id: Platform.OS === 'ios' ? 'arkit' : 'unknown',
    maxSplats: 500_000,
    sortWorkgroupSize: 32,
    expectedFps: 60,
  };
  return baseline;
}
