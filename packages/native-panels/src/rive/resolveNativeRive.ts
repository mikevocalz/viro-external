import { NitroModules } from "react-native-nitro-modules";
import * as generatedFile from "#nitro/RiveFile";
import * as generatedPanel from "#nitro/RivePanel";
import type { RiveFile } from "../specs/RiveFile.nitro";
import type { RivePanel } from "../specs/RivePanel.nitro";
import type { NativeRiveRuntime } from "./NativeRiveRuntime";

type FileModule = { readonly RiveFile: typeof RiveFile };
type PanelModule = { readonly RivePanel: typeof RivePanel };

// Same interop as resolveWhiteboardRendererFactory: the generated runtime is
// CommonJS with a lazy getter, exposed as `default` under Node ESM.
const fileModule: FileModule =
  (generatedFile as unknown as { readonly default?: FileModule }).default ?? (generatedFile as unknown as FileModule);
const panelModule: PanelModule =
  (generatedPanel as unknown as { readonly default?: PanelModule }).default ??
  (generatedPanel as unknown as PanelModule);

/**
 * The native Rive classes, or `undefined` when this build cannot create a
 * {@linkcode RivePanel}: no implementation is registered (iOS today), or
 * {@linkcode RivePanel.isAvailable} is false (an ABI other than arm64-v8a, a
 * ViroCore renderer built without Rive, or a Viro build without the
 * `CanvasSurfaces` registry).
 */
export function resolveNativeRive(): NativeRiveRuntime | undefined {
  if (!NitroModules.hasHybridClass("nativepanels.RivePanel")) return undefined;
  if (!NitroModules.hasHybridClass("nativepanels.RiveFile")) return undefined;
  const RivePanelClass = panelModule.RivePanel;
  if (!RivePanelClass.isAvailable) return undefined;
  return { RiveFile: fileModule.RiveFile, RivePanel: RivePanelClass };
}
