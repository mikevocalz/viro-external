import { Android, type HybridObject } from "nitro-core";
import type { RivePanel } from "./RivePanel.nitro";
import type { RiveViewModelUpdate } from "./RiveViewModelUpdate";

export * from "#nitro/RiveViewModelInstance";

/**
 * The default view-model instance of a {@linkcode RivePanel}'s artboard,
 * from {@linkcode RivePanel.viewModelInstance}.
 *
 * Writes go into the panel's command queue and are applied on its render
 * thread before the next advance; each call returns at once. Prefer
 * {@linkcode RiveViewModelInstance.applyUpdate} for several values, so one
 * React commit is one native call. A path that does not exist is reported
 * through {@linkcode RivePanel.addOnStateChangedListener} with a detail
 * message, not thrown, because the lookup happens on the render thread.
 *
 * @throws Error from every method once the panel is disposed.
 * @platform android
 */
@Android({
  language: "c++",
  implementation: { className: "HybridRiveViewModelInstance", include: '"HybridRiveViewModelInstance.hpp"' },
})
export declare class RiveViewModelInstance extends HybridObject {
  /** Sets a number property. @throws Error when `value` is not finite. */
  setNumber(path: string, value: number): void;
  /** Sets a boolean property. */
  setBoolean(path: string, value: boolean): void;
  /** Sets a string property. */
  setString(path: string, value: string): void;
  /** Fires a trigger property. */
  fireTrigger(path: string): void;
  /**
   * Queues every value in `update`: numbers, then booleans, then strings,
   * then triggers. Validates the whole batch first and queues nothing when
   * a number is not finite.
   */
  applyUpdate(update: RiveViewModelUpdate): void;
}
