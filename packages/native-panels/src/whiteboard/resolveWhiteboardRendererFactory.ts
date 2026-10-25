import { NitroModules } from "react-native-nitro-modules";
import * as generated from "#nitro/WhiteboardRendererFactory";
import type { WhiteboardRendererFactory } from "../specs/WhiteboardRendererFactory.nitro";

// Bind to the nitrogen-generated runtime, not the spec module: the spec's
// decorators are not parseable by the stock React Native Babel preset. The
// type-only import is erased.
const runtime = generated as unknown as { readonly WhiteboardRendererFactory: typeof WhiteboardRendererFactory };

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
