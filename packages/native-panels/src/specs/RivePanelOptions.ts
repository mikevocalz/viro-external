import type { RiveFile } from "./RiveFile.nitro";
import type { RiveFit } from "./RiveFit";
import type { RivePanel } from "./RivePanel.nitro";

/**
 * Options for {@linkcode RivePanel.create}.
 */
export interface RivePanelOptions {
  /**
   * The id the Viro `canvasSource` material was created with. The panel
   * draws into the Surface Viro provides for this id. Integer.
   */
  surfaceId: number;
  /**
   * Width in pixels the caller allocated the material with. A Surface of a
   * different size resizes the panel. Integer from 1 to 8192.
   */
  widthPx: number;
  /** Height in pixels; see {@linkcode RivePanelOptions.widthPx}. Integer from 1 to 8192. */
  heightPx: number;
  /** The `.riv` file to show. The panel keeps its own copy of the bytes. */
  file: RiveFile;
  /** Artboard name. Omit for the file's default artboard. */
  artboardName?: string;
  /** State machine name. Omit for the artboard's default state machine. */
  stateMachineName?: string;
  /** How the artboard fits the panel. */
  fit: RiveFit;
  /** Horizontal alignment, -1 (left) to 1 (right). 0 centres. */
  alignmentX: number;
  /** Vertical alignment, -1 (top) to 1 (bottom). 0 centres. */
  alignmentY: number;
  /**
   * Corner radius in meters that the Viro material rounds the panel with
   * (the same value as the material's `cornerRadius`). The panel draws square
   * content and uses this only so presses in a transparent corner do not
   * reach Rive. 0 for square corners.
   */
  cornerRadiusM: number;
  /** Width in meters of the quad the panel covers. Must be > 0 when `cornerRadiusM` is above 0. */
  panelWidthM: number;
  /** Height in meters of the quad the panel covers. Must be > 0 when `cornerRadiusM` is above 0. */
  panelHeightM: number;
  /**
   * Upper bound on frames per second while the state machine animates.
   * A settled state machine draws nothing. Match the headset's display rate.
   */
  maxFrameRateHz: number;
}
