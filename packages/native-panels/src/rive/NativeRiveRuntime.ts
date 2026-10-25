import type { RiveFile } from "../specs/RiveFile.nitro";
import type { RivePanel } from "../specs/RivePanel.nitro";

/**
 * The native Rive classes: {@linkcode RiveFile} and {@linkcode RivePanel}.
 *
 * @see {@linkcode resolveNativeRive}
 */
export interface NativeRiveRuntime {
  readonly RiveFile: typeof RiveFile;
  readonly RivePanel: typeof RivePanel;
}
