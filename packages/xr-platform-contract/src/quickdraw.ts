/** Native QuickDraw spatial rendering contract. */
import type { QuickDrawSurfaceIdentity } from "./quickdrawIdentity";

/**
 * Device class of a pointer on a QuickDraw board.
 *
 * @see {@linkcode QuickDrawPointerEvent.source}
 */
export type QuickDrawPointerSource =
  | "pointer" | "gaze" | "pinch" | "touch" | "controller" | "hand" | "dpad" | "keyboard" | "pen";

/**
 * Phase of a {@linkcode QuickDrawPointerEvent}.
 *
 * - `hover`: the pointer is over the board and not pressed.
 * - `down`: a press started on the board; the pointer is captured until `up` or `cancel`.
 * - `move`: a captured pointer moved. Positions outside the paper are clamped to its edge.
 * - `up`: the captured press ended normally. A stroke commits.
 * - `cancel`: the captured press was abandoned (tracking or focus loss, disconnect,
 *   app background, unmount, ownership change, board moved). A stroke is discarded.
 * - `leave`: a hovering pointer left the board.
 */
export type QuickDrawPointerEventPhase = "hover" | "down" | "move" | "up" | "cancel" | "leave";

/**
 * One pointer event on a QuickDraw board, after the scene hit has been mapped
 * onto the paper. This is the single pointer type every input path produces:
 * Viro controller and hand rays, the Muse pen, and adapter dispatch.
 *
 * @see {@linkcode QuickDrawSpatialSurfaceHandle.dispatchPointer}
 */
export interface QuickDrawPointerEvent {
  phase: QuickDrawPointerEventPhase;
  /** Stable id for one input device for the lifetime of the input router. Safe integer. */
  pointerId: number;
  source: QuickDrawPointerSource;
  /**
   * Position on the paper, normalized: `[0, 0]` is the top-left corner of the
   * paper and `[1, 1]` the bottom-right. Within `[0, 1]` except for `hover`,
   * which is only emitted inside the paper.
   */
  uv: readonly [number, number];
  /**
   * Milliseconds on a monotonic clock (`performance.now()` in React Native).
   * Never decreases for one `pointerId`.
   */
  timestampMs: number;
  /**
   * Normalized pressure in `[0, 1]` when the device reports one. `undefined`
   * means the device reports no pressure; `0` is a real reading.
   */
  pressure?: number;
}

/**
 * @deprecated Use {@linkcode QuickDrawPointerEventPhase}. `enter` maps to
 * `hover` and `exit` to `leave`.
 */
export type QuickDrawPointerPhase = "enter" | "move" | "down" | "up" | "cancel" | "exit";

/**
 * @deprecated Use {@linkcode QuickDrawPointerEvent}, which adds `pointerId`
 * and names its clock (`timestampMs`). Kept so existing adapters that read
 * this shape keep compiling; {@linkcode toQuickDrawSpatialPointer} converts.
 */
export type QuickDrawSpatialPointer = {
  phase: QuickDrawPointerPhase;
  source: QuickDrawPointerSource;
  /** Normalized board coordinates, 0..1 from top-left. */
  uv: readonly [number, number];
  timestamp: number;
  pressure?: number;
};

/**
 * Converts a {@linkcode QuickDrawPointerEvent} to the deprecated
 * {@linkcode QuickDrawSpatialPointer} shape for adapters that still read it.
 * `hover` maps to `move` (the old shape has no hover phase; `enter` is never
 * produced) and `leave` to `exit`. `pointerId` is dropped.
 */
export function toQuickDrawSpatialPointer(event: QuickDrawPointerEvent): QuickDrawSpatialPointer {
  const phase: QuickDrawPointerPhase =
    event.phase === "hover" ? "move" : event.phase === "leave" ? "exit" : event.phase;
  const pointer: QuickDrawSpatialPointer = {
    phase,
    source: event.source,
    uv: event.uv,
    timestamp: event.timestampMs,
  };
  if (event.pressure !== undefined) pointer.pressure = event.pressure;
  return pointer;
}

export type QuickDrawSpatialDrag = {
  enabled: boolean;
  activationDistance?: number;
  maxDistance?: number;
};

export type QuickDrawSpatialSurfaceConfig = {
  width: number;
  height: number;
  pageWidth: number;
  pageHeight: number;
  interactive?: boolean;
  drag?: QuickDrawSpatialDrag;
};

type QuickDrawSpatialAdapterMethods = {
  mount(config: QuickDrawSpatialSurfaceConfig): QuickDrawSpatialSurfaceHandle;
  unmount(handle: QuickDrawSpatialSurfaceHandle): void;
};

/**
 * Native adapter boundary for the QuickDraw runtime.
 *
 * QuickDraw's `Store` is the editor authority. The adapter states which host
 * draws the board, with which backend, and who owns the texture, through
 * {@linkcode QuickDrawSurfaceIdentity}. Resolve it with
 * `resolveQuickDrawSurfaceIdentity`, which rejects contradictory declarations.
 *
 * Migration: adapters that declared only `renderer: "esiku"` keep working and
 * resolve to the ESIKU identity. An adapter whose host is not ESIKU must
 * declare `identity` and drop `renderer`.
 */
export type NativeQuickDrawSpatialAdapter = QuickDrawSpatialAdapterMethods & (
  | {
      /** Who draws the board and who owns its texture. */
      readonly identity: QuickDrawSurfaceIdentity;
      /**
       * @deprecated Declare {@linkcode QuickDrawSurfaceIdentity} in `identity`.
       * Only accepted alongside an identity whose host is `esiku`.
       */
      readonly renderer?: "esiku";
    }
  | {
      /**
       * @deprecated Declare `identity` instead. Means: an ESIKU host draws the
       * board into an ESIKU-owned external render target.
       */
      readonly renderer: "esiku";
      readonly identity?: undefined;
    }
);

export type QuickDrawSpatialSurfaceHandle = {
  /** Viro material name bound to the live external render target. */
  materialName: string;
  /**
   * Delivers one pointer event in the deprecated shape. `QuickDrawSpatialSurface`
   * calls it for every event its input router produces, converted with
   * {@linkcode toQuickDrawSpatialPointer}.
   */
  dispatchPointer(event: QuickDrawSpatialPointer): void;
  /**
   * Delivers one pointer event. Preferred over `dispatchPointer` when present:
   * it carries `pointerId`, so a cancel on one device does not end another's stroke.
   */
  dispatchPointerEvent?(event: QuickDrawPointerEvent): void;
  setTool(tool: string): void;
  setStyle(key: string, value: string | number | boolean): void;
  undo(): void;
  redo(): void;
  clear(): void;
  getSnapshot(): unknown;
  loadSnapshot(snapshot: unknown): void;
  exportPng(): Promise<string | null>;
  dispose(): void;
};
