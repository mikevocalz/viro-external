import type { RiveViewModelInstance } from "./RiveViewModelInstance.nitro";

/**
 * A batch of view-model writes keyed by property path, applied by
 * {@linkcode RiveViewModelInstance.applyUpdate} in one call.
 */
export interface RiveViewModelUpdate {
  /** Number properties. Values must be finite. */
  numbers?: Record<string, number>;
  /** Boolean properties. */
  booleans?: Record<string, boolean>;
  /** String properties. */
  strings?: Record<string, string>;
  /** Trigger properties to fire, in order. */
  triggers?: string[];
}
