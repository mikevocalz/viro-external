/**
 * @viro-external/orb-pass — public API.
 *
 * Registers a `VROOrbRenderPass` as a child of the multiplex on the
 * choreographer owned by a Viro scene navigator. Two-call surface:
 *
 *   const handle = await registerOrbPass({ sceneNavTag, priority });
 *   // ... orb draws inside every subsequent Viro frame ...
 *   handle.release();
 *
 * The native pass renders a hardcoded icosphere with the ember-pulse
 * fragment shader lifted from ~/orb/src/orb.ts:262-273 (three.js
 * onBeforeCompile). Depth policy: always-in-front (glDepthFunc(GL_ALWAYS),
 * depth-mask false). Matches spec §2 scope.
 */

import { NativeModules } from 'react-native';

interface NativeOrbPassModule {
  isAvailable(): Promise<boolean>;
  registerPass(sceneNavTag: number, priority: number): Promise<string>;
  unregisterPass(id: string): Promise<boolean>;
  setTalk(id: string, value: number): void;
  setIgnition(id: string, value: number): void;
  setBreath(id: string, value: number): void;
  setListen(id: string, value: number): void;
  setPosition(id: string, x: number, y: number, z: number): void;
}

const Native = (NativeModules as Record<string, unknown>)['ViroOrbPass'] as
  | NativeOrbPassModule
  | undefined;

export function isNativeOrbPassAvailable(): boolean {
  return Native != null && typeof Native.registerPass === 'function';
}

export interface OrbPassOpts {
  /**
   * `findNodeHandle()` result for the host `ViroXRSceneNavigator` /
   * `ViroVRSceneNavigator`. Same resolution path as splat-pass.
   */
  sceneNavTag: number;

  /**
   * Priority within the multiplex. Higher renders later — for orb that
   * means on top of other passes (splat). Default 100 (renders after
   * splat's priority 0).
   */
  priority?: number;
}

export interface OrbPassHandle {
  readonly id: string;
  release(): Promise<void>;

  /**
   * Push a target talk-energy in [0,1]. Native side springs toward it
   * (k=45, d=11 — same shape as ~/orb/src/orb.ts:432). Talk drives the
   * ember pulse boost, the breath talk-pulse harmonic, and (once
   * lipsync is wired) viseme intensity.
   */
  setTalk(value: number): void;

  /**
   * Ignition target in [0,1]. Springs toward it (k=60, d=14). Drives
   * ember dim↔bright mix and overall emissive intensity.
   */
  setIgnition(value: number): void;

  /**
   * Override breath. Any value ≥ 0 replaces the auto-sine breath signal
   * for exactly one field. Pass -1 to release the override and go back
   * to auto-sine + micro-noise + talk-pulse.
   */
  setBreath(value: number): void;
  /** 1 = awake and listening (attentive look), 0 = idle. */
  setListen(value: number): void;

  /**
   * Pin the orb to a world-space position. First call switches the orb
   * from head-relative (auto-tracks the head at 1.8m forward) to a fixed
   * anchor. Pass NaN for x to release the anchor and return to head-follow.
   */
  setPosition(x: number, y: number, z: number): void;
}

class OrbPassNotAvailableError extends Error {
  constructor() {
    super(
      '@viro-external/orb-pass: native module ViroOrbPass not registered. ' +
        'Make sure the app is built with the viro_bridge AAR that includes ' +
        'ViroOrbPassModule.class and links libviro_orb_pass.so.'
    );
    this.name = 'OrbPassNotAvailableError';
  }
}

export async function registerOrbPass(
  opts: OrbPassOpts
): Promise<OrbPassHandle> {
  if (!Native) throw new OrbPassNotAvailableError();

  const priority = opts.priority ?? 100;
  const id = await Native.registerPass(opts.sceneNavTag, priority);

  let released = false;
  return {
    id,
    release: async () => {
      if (released) return;
      released = true;
      await Native.unregisterPass(id);
    },
    setTalk: (v: number) => { if (!released) Native.setTalk(id, v); },
    setIgnition: (v: number) => { if (!released) Native.setIgnition(id, v); },
    setBreath: (v: number) => { if (!released) Native.setBreath(id, v); },
    setListen: (v: number) => { if (!released) Native.setListen(id, v); },
    setPosition: (x: number, y: number, z: number) => {
      if (!released) Native.setPosition(id, x, y, z);
    },
  };
}

export async function unregisterOrbPass(id: string): Promise<void> {
  if (!Native) return;
  await Native.unregisterPass(id);
}
