import type { RiveViewModelInstance } from "../specs/RiveViewModelInstance.nitro";

/**
 * One view-model value for {@linkcode ViroNativeRivePanel}'s `bindings`, the
 * same shape `ViroRivePanel` takes. Strings, numbers and booleans set the
 * property of that type; a trigger fires when its `serial` changes.
 *
 * `enum` and `color` values are accepted for prop compatibility but the
 * native producer cannot write them yet: each is reported once through
 * `onError` and skipped.
 *
 * @see {@linkcode RiveViewModelInstance.applyUpdate}
 */
export type RiveBindingValue =
  | string
  | number
  | boolean
  | { kind: "enum"; value: string }
  | { kind: "color"; value: number }
  | { kind: "trigger"; serial: number };
