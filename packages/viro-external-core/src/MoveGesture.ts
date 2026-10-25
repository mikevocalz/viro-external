import type { AxisLock, Vec3 } from "./spatialTypes";

/**
 * Drag state of one `MovableNode` grip. Viro's `onDrag` has no
 * start or end flag, so the first sample starts a move and a release (or a
 * pinch end) finishes it. Plain fields, no React state.
 */
export interface MoveGesture {
  /** `true` between the first drag sample and the release or abort. */
  readonly isActive: boolean;
  /**
   * One `onDrag` sample. `isStart` is `true` for the first sample of a move.
   * Locked axes keep the first sample's coordinate.
   */
  drag(dragToPos: Vec3, axisLock: readonly AxisLock[] | undefined): { position: Vec3; isStart: boolean };
  /** Ends the move. Returns the last position, or `undefined` when no move is active. */
  release(): Vec3 | undefined;
  /**
   * Drops the move without reporting a release, for example when the node
   * stops being movable or unmounts mid-grip. The next sample starts a new
   * move.
   */
  abort(): void;
}
