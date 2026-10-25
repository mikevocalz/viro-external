import type { mountNativeRivePanel } from "./mountNativeRivePanel";

/** A mounted native Rive panel from {@linkcode mountNativeRivePanel}. */
export interface NativeRivePanelMount {
  /**
   * Disposes the panel (which ends its Surface subscription first), then
   * deletes the material, so Viro revokes the Surface only after nothing
   * draws into it. Idempotent.
   */
  dispose(): void;
}
