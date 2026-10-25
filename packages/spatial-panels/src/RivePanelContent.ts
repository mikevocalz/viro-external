import type { RiveFit } from "./RiveFit";

/**
 * The Rive content of a compositor panel. The panel renders one state machine;
 * it redraws only while the state machine advances or after input or data
 * changes.
 *
 * @see {@link CompositorPanelOptions.content}
 */
export interface RivePanelContent {
  readonly kind: "rive";
  /** The .riv file, up to 64 MiB, starting with the `RIVE` signature. Copied when the panel is created. */
  readonly file: Uint8Array;
  /** Artboard name. @default the file's default artboard */
  readonly artboard?: string;
  /** State machine name. @default the artboard's default state machine */
  readonly stateMachine?: string;
  /** @default "contain" */
  readonly fit?: RiveFit;
  /** -1 left, 0 centre, 1 right. @default 0 */
  readonly alignmentX?: number;
  /** -1 top, 0 centre, 1 bottom. @default 0 */
  readonly alignmentY?: number;
  /** Straight 0xAARRGGBB drawn under the artboard; alpha 0 draws nothing. @default 0 */
  readonly clearColor?: number;
  /** Upper bound while animating; match the display rate. @default 72 */
  readonly maxFrameRateHz?: number;
}
