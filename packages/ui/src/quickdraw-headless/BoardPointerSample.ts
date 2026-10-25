import type { HeadlessBoard } from "./HeadlessBoard";

/**
 * The input device behind a {@linkcode BoardPointerSample}.
 *
 * `pen` arms QuickDraw's pen mode on first contact (after which `touch`
 * pointers stop drawing) and marks strokes `isPen`, so their width follows
 * reported pressure instead of simulated speed.
 */
export type BoardPointerSource = "pen" | "controller" | "hand" | "touch";

/**
 * One pointer sample delivered to a headless board.
 *
 * @see {@linkcode HeadlessBoard.pointerDown}
 */
export interface BoardPointerSample {
  /** Stable id for one contact, from down to up or cancel. Safe integer. */
  pointerId: number;
  /** Device class of the contact. */
  source: BoardPointerSource;
  /**
   * Horizontal position on the board surface in board units, before the
   * camera is applied (QuickDraw's screen space). With the default camera
   * `{ x: 0, y: 0, z: 1 }` this equals the page coordinate.
   */
  x: number;
  /** Vertical position on the board surface; see {@linkcode BoardPointerSample.x}. */
  y: number;
  /**
   * Normalised pressure in `[0, 1]`. Leave it `undefined` when the device
   * reports none: the board records QuickDraw's "no reading" value `0.5`.
   * An explicit `0` is recorded as `0`.
   */
  pressure?: number;
  /** Sample time in milliseconds on a monotonic clock. Must not go backwards per pointer. */
  timestampMs: number;
}

