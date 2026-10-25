import type { MusePenSample, QuickDrawPointerEvent, QuickDrawPointerSource } from "@viro-external/xr-contract";
import type { BoardSurfaceGeometry, Mat4 } from "./board-geometry";

/**
 * Why every captured pointer was cancelled.
 * @see {@linkcode BoardInputRouter.cancelAll}
 */
export type BoardInputCancelReason =
  | "tracking-lost"
  | "focus-lost"
  | "background"
  | "unmount"
  | "ownership-changed"
  | "board-moved"
  | "surface-changed"
  | "disabled"
  | "disposed";

/** Cleanup handle for {@linkcode BoardInputRouter.addOnPointerEventListener}. `remove` is idempotent. */
export interface BoardInputSubscription {
  remove(): void;
}

/**
 * Options for `createBoardInputRouter`.
 */
export interface BoardInputRouterOptions {
  /**
   * Monotonic clock in milliseconds for events whose source carries no
   * timestamp (Viro scene events). Defaults to `performance.now()`. These
   * stamps are the time JS received the event, not the native sample time.
   */
  now?: () => number;
  /**
   * Device class for a Viro input source id (`nativeEvent.source`, the native
   * `InputSource` enum). Viro does not report the device class, so the
   * default treats every ray as `controller` and ignores eye gaze (12,
   * `ViroEventSource.EYE_GAZE`), which must never draw.
   */
  classifyViroSource?: (source: number) => QuickDrawPointerSource | "ignore";
  /** Off-plane tolerance in metres for ray hits. @default 0.01 */
  planeToleranceM?: number;
  /** How far from the board plane the Muse tip may be and still touch it, in metres. @default 0.02 */
  penContactToleranceM?: number;
  /** How far from the plane a tracked, unpressed pen still hovers, in metres. @default 0.1 */
  penHoverDistanceM?: number;
}

/**
 * One input path from Viro scene hits and the Muse pen to a QuickDraw board.
 *
 * It maps world hits to paper UV, owns pointer capture, and emits
 * {@linkcode QuickDrawPointerEvent}s to listeners. Each device has its own
 * capture; cancelling one device never ends another's gesture. Holds its
 * state in plain fields: nothing here re-renders React.
 *
 * Created by `createBoardInputRouter`, usually through a board session.
 */
export interface BoardInputRouter {
  /** Paper geometry and world matrix. Cancels captured pointers when either changes. Enables input. */
  setSurface(geometry: BoardSurfaceGeometry, boardWorld: Mat4): void;
  /** `false` cancels everything and drops input until set back to `true`. */
  setEnabled(isEnabled: boolean): void;
  /** Board movement started (grip drag): cancels every gesture and ignores input until {@linkcode BoardInputRouter.endBoardMove}. */
  beginBoardMove(): void;
  /** Board movement ended at `boardWorld`. */
  endBoardMove(boardWorld: Mat4): void;

  /** Viro `onClickState(clickState, position, source)` from the paper quad. */
  handleViroClickState(clickState: number, position: readonly number[], source: number): void;
  /** Viro `onDrag(dragToPos, source)` from the paper quad (FixedToPlane, `dragTransform="none"`). */
  handleViroDrag(dragToPos: readonly number[], source: number): void;
  /** Viro `onHover(isHovering, position, source)` from the paper quad. */
  handleViroHover(isHovering: boolean, position: readonly number[], source: number): void;
  /** One sample from `MusePenInput`, position in Viro world metres. */
  handlePenSample(sample: MusePenSample): void;

  /** Cancels the gesture of one Viro input source, e.g. on controller disconnect. */
  cancelViroSource(source: number): void;
  /** Cancels the pen's gesture. */
  cancelPen(): void;
  /** Cancels every captured gesture and ends every hover. */
  cancelAll(reason: BoardInputCancelReason): void;
  /** Number of pointers currently captured. */
  readonly capturedCount: number;

  addOnPointerEventListener(listener: (event: QuickDrawPointerEvent) => void): BoardInputSubscription;
  /** Cancels everything and stops emitting. Idempotent. */
  dispose(): void;
}
