/**
 * Zustand store for splat-pass. Per CLAUDE.md: never useState for app
 * state. The store holds the read-only mirror of native pass state so
 * consumers can render overlays / debug HUDs without poking the bridge
 * every frame.
 *
 * Mutation surface is the four actions below — anything else is a
 * review block.
 */

import { create } from 'zustand';
import type { DeviceProfile, SplatPassMetrics } from './types';
import {
  fallbackDeviceProfile,
  getNativeSplatPass,
  isNativeSplatPassAvailable,
} from './NativeSplatPass';

interface RegisteredPass {
  id: string;
  uri: string;
  priority: number;
  metrics: SplatPassMetrics | null;
}

interface SplatPassState {
  available: boolean;
  deviceProfile: DeviceProfile;
  passes: Record<string, RegisteredPass>;

  // Actions
  refreshAvailability: () => void;
  trackPass: (pass: Omit<RegisteredPass, 'metrics'>) => void;
  untrackPass: (id: string) => void;
  syncMetrics: (id: string) => void;
}

function initialDeviceProfile(): DeviceProfile {
  const native = getNativeSplatPass();
  if (native) {
    try {
      return native.getDeviceProfile();
    } catch {
      // fall through
    }
  }
  return fallbackDeviceProfile();
}

export const useSplatPassStore = create<SplatPassState>((set, get) => ({
  available: isNativeSplatPassAvailable(),
  deviceProfile: initialDeviceProfile(),
  passes: {},

  refreshAvailability: () => {
    set({
      available: isNativeSplatPassAvailable(),
      deviceProfile: initialDeviceProfile(),
    });
  },

  trackPass: (pass) => {
    set((s) => ({
      passes: { ...s.passes, [pass.id]: { ...pass, metrics: null } },
    }));
  },

  untrackPass: (id) => {
    set((s) => {
      const next = { ...s.passes };
      delete next[id];
      return { passes: next };
    });
  },

  syncMetrics: (id) => {
    const native = getNativeSplatPass();
    if (!native) return;
    const pass = get().passes[id];
    if (!pass) return;
    try {
      const metrics = native.metrics(id);
      set((s) => ({
        passes: { ...s.passes, [id]: { ...pass, metrics } },
      }));
    } catch {
      // metrics read failed — leave the last value in place
    }
  },
}));

/**
 * Convenience selector hooks. Consumers should use these instead of
 * `useSplatPassStore(s => …)` directly so the selector list stays
 * grep-able and reviewable.
 */
export const useSplatPassAvailable = (): boolean =>
  useSplatPassStore((s) => s.available);

export const useSplatPassDeviceProfile = (): DeviceProfile =>
  useSplatPassStore((s) => s.deviceProfile);

export const useSplatPass = (id: string): RegisteredPass | undefined =>
  useSplatPassStore((s) => s.passes[id]);
