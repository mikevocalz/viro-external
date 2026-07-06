/**
 * @viro-external/render-passes — public API.
 *
 * Diagnostics surface for the render-passes multiplex, exposed via the Expo
 * module `RenderPasses`. Attach / detach happen from sibling C++ packages
 * (splat-pass, orb-pass) that link against libviro_external_render_passes.so
 * directly — see doc/DECA-unified-render-pass-spec.md §2.1.
 *
 * On non-Android platforms and in builds where the native module is absent,
 * `isAvailable()` returns false and the accessors return safe defaults.
 */

import { requireOptionalNativeModule } from 'expo-modules-core';

interface RenderPassesNativeModule {
  childCount(choreographerRef: number): number;
  childIds(choreographerRef: number): string[];
  attachNoOp(choreographerRef: number, priority: number): string;
  detachNoOp(id: string): boolean;
}

const Native = requireOptionalNativeModule<RenderPassesNativeModule>('RenderPasses');

export function isAvailable(): boolean {
  return Native != null;
}

/**
 * Number of child passes currently attached to the multiplex on the given
 * choreographer. `choreographerRef` is a `jlong` handle from
 * `Renderer.getChoreographerRef()` (virocore Renderer.java:385).
 */
export function childCount(choreographerRef: number): number {
  return Native?.childCount(choreographerRef) ?? 0;
}

/**
 * Ordered child ids for the multiplex on the given choreographer. Priority
 * ascending — first entry renders first, last renders on top. Used by the
 * six-gate verification (spec §6, gate 5) to confirm coexistence.
 */
export function childIds(choreographerRef: number): string[] {
  return Native?.childIds(choreographerRef) ?? [];
}

/**
 * Six-gate verification canary. Attach a no-op child to the multiplex on
 * the given choreographer, returning its opaque id. Used to prove
 * multiplex dispatches to N children — attach one alongside splat-pass,
 * confirm both fire in the same frame via `MultiplexPass: dispatch [...]`
 * log. See doc/DECA-unified-render-pass-spec.md §6 gate 5.
 *
 * When a real orb-pass package lands, delete this API.
 */
export function attachNoOp(choreographerRef: number, priority = 0): string {
  return Native?.attachNoOp(choreographerRef, priority) ?? '';
}

export function detachNoOp(id: string): boolean {
  return Native?.detachNoOp(id) ?? false;
}
