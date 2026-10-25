import type { MoveGesture } from "./MoveGesture";
import type { Vec3 } from "./spatialTypes";

/** Creates an idle {@linkcode MoveGesture}. */
export function createMoveGesture(): MoveGesture {
  let start: Vec3 | undefined;
  let last: Vec3 | undefined;

  return {
    get isActive() {
      return start !== undefined;
    },

    drag(dragToPos, axisLock) {
      const isStart = start === undefined;
      const anchor = start ?? dragToPos;
      start = anchor;
      const position: Vec3 = [
        axisLock?.includes("x") ? anchor[0] : dragToPos[0],
        axisLock?.includes("y") ? anchor[1] : dragToPos[1],
        axisLock?.includes("z") ? anchor[2] : dragToPos[2],
      ];
      last = position;
      return { position, isStart };
    },

    release() {
      const released = start === undefined ? undefined : last;
      start = undefined;
      last = undefined;
      return released;
    },

    abort() {
      start = undefined;
      last = undefined;
    },
  };
}
