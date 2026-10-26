import type { RiveViewModelUpdate } from "../specs/RiveViewModelUpdate";
import type { RiveBindingValue } from "./RiveBindingValue";

/** Result of one {@linkcode RiveBindingWriter.diff}. */
export interface RiveBindingDiff {
  /** Values that changed since the last diff, ready for `applyUpdate`. `undefined` when nothing changed. */
  update: RiveViewModelUpdate | undefined;
  /** Paths of `enum` or `color` values seen for the first time; the native producer cannot write them. */
  unsupportedPaths: string[];
}

/**
 * Turns successive `bindings` objects into the smallest view-model update:
 * a value is sent when its type or value changed, a trigger when its serial
 * changed. Paths missing from a later object are left as they are, like
 * `ViroRivePanel`.
 */
export interface RiveBindingWriter {
  diff(bindings: Readonly<Record<string, RiveBindingValue>> | undefined): RiveBindingDiff;
  /** Forgets what was sent, for a new panel instance that has none of the old values. */
  reset(): void;
}

function fingerprint(value: RiveBindingValue): string {
  if (typeof value === "object") {
    return value.kind + ":" + String(value.kind === "trigger" ? value.serial : value.value);
  }
  return typeof value + ":" + String(value);
}

export function createRiveBindingWriter(): RiveBindingWriter {
  const sent = new Map<string, string>();
  const reported = new Set<string>();
  return {
    diff(bindings) {
      const unsupportedPaths: string[] = [];
      if (bindings === undefined) return { update: undefined, unsupportedPaths };
      const numbers: Record<string, number> = {};
      const booleans: Record<string, boolean> = {};
      const strings: Record<string, string> = {};
      const triggers: string[] = [];
      let changed = false;
      for (const [path, value] of Object.entries(bindings)) {
        const print = fingerprint(value);
        if (sent.get(path) === print) continue;
        sent.set(path, print);
        if (typeof value === "number") numbers[path] = value;
        else if (typeof value === "boolean") booleans[path] = value;
        else if (typeof value === "string") strings[path] = value;
        else if (value.kind === "trigger") triggers.push(path);
        else {
          if (!reported.has(path)) {
            reported.add(path);
            unsupportedPaths.push(path);
          }
          continue;
        }
        changed = true;
      }
      if (!changed) return { update: undefined, unsupportedPaths };
      const update: RiveViewModelUpdate = {};
      if (Object.keys(numbers).length > 0) update.numbers = numbers;
      if (Object.keys(booleans).length > 0) update.booleans = booleans;
      if (Object.keys(strings).length > 0) update.strings = strings;
      if (triggers.length > 0) update.triggers = triggers;
      return { update, unsupportedPaths };
    },
    reset() {
      sent.clear();
    },
  };
}
