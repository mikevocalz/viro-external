import { NitroModules } from "react-native-nitro-modules";
import * as generated from "#nitro/WhiteboardRendererFactory";
import type { WhiteboardRendererFactory } from "../specs/WhiteboardRendererFactory.nitro";

type Runtime = { readonly WhiteboardRendererFactory: typeof WhiteboardRendererFactory };

// Bind to the nitrogen-generated runtime, not the spec module: the spec's
// decorators are not parseable by the stock React Native Babel preset. The
// type-only import is erased. The runtime is CommonJS with a lazy getter;
// Babel's interop and Node's ESM loader both expose its module.exports as
// `default`, and only Babel also copies the getter onto the namespace.
const runtime: Runtime =
  (generated as unknown as { readonly default?: Runtime }).default ?? (generated as unknown as Runtime);

/**
 * The native {@linkcode WhiteboardRendererFactory}, or `undefined` when this
 * platform or device cannot run it: no implementation is registered (iOS
 * today), or {@linkcode WhiteboardRendererFactory.isAvailable} is false.
 */
export function resolveWhiteboardRendererFactory(): typeof WhiteboardRendererFactory | undefined {
  if (!NitroModules.hasHybridClass("nativepanels.WhiteboardRendererFactory")) return undefined;
  const factory = runtime.WhiteboardRendererFactory;
  return factory.isAvailable ? factory : undefined;
}
