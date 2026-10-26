import { useCallback, useEffect, useMemo, useRef } from "react";
import { useStore } from "zustand";
import { createStore, type StoreApi } from "zustand/vanilla";
import type { Vec3 } from "@viro-external/core";
import { composeNodeWorld, IDENTITY_MAT4, invertAffine, transformPoint, type Mat4 } from "./board-geometry";
import type { BoardInputRouter } from "./BoardInputRouter";

type PoseState = { movedPosition: Vec3 | undefined };

/** Options for {@linkcode useMovableBoardPose}. */
export interface MovableBoardPoseOptions {
  router: BoardInputRouter;
  position?: Vec3;
  rotation?: Vec3;
  scale?: Vec3;
  /** World matrix of the node the board is mounted under. @default identity */
  parentWorld?: Mat4;
  onMoveStart?: () => void;
  onMoveEnd?: (position: Vec3) => void;
}

/**
 * The board's world matrix plus `MovableNode` callbacks that keep it right
 * across grip drags. The node tree it describes is
 * `MovableNode(position) > ViroNode(rotation, scale) > paper quad`, so the
 * world matrix is `parentWorld · T · R · S`.
 *
 * A grip drag cancels every stroke at its start and hands the router the new
 * pose at release. State changes once per drag, never per sample.
 */
export function useMovableBoardPose(options: MovableBoardPoseOptions) {
  const { router, position, rotation, scale, parentWorld = IDENTITY_MAT4 } = options;
  const storeRef = useRef<StoreApi<PoseState> | undefined>(undefined);
  if (storeRef.current === undefined) storeRef.current = createStore<PoseState>(() => ({ movedPosition: undefined }));
  const store = storeRef.current;
  const movedPosition = useStore(store, (s) => s.movedPosition);
  const callbacks = useRef(options);
  callbacks.current = options;

  // A new position from the caller replaces where the grip left the board.
  const px = position?.[0], py = position?.[1], pz = position?.[2];
  useEffect(() => {
    store.setState({ movedPosition: undefined });
  }, [store, px, py, pz]);

  const resolvedPosition: Vec3 = movedPosition ?? position ?? [0, 0, 0];
  const rx = rotation?.[0] ?? 0, ry = rotation?.[1] ?? 0, rz = rotation?.[2] ?? 0;
  const sx = scale?.[0] ?? 1, sy = scale?.[1] ?? 1, sz = scale?.[2] ?? 1;
  const [x, y, z] = resolvedPosition;
  const boardWorld = useMemo(
    () => composeNodeWorld({ position: [x, y, z], rotation: [rx, ry, rz], scale: [sx, sy, sz] }, parentWorld),
    [x, y, z, rx, ry, rz, sx, sy, sz, parentWorld],
  );

  const onMoveStart = useCallback(() => {
    router.beginBoardMove();
    callbacks.current.onMoveStart?.();
  }, [router]);

  const onMoveEnd = useCallback(
    (releasedWorld: Vec3) => {
      // MovableNode reports the node's world destination; its position prop is parent-local.
      const inverse = invertAffine(callbacks.current.parentWorld ?? IDENTITY_MAT4);
      const local = inverse === undefined ? releasedWorld : transformPoint(inverse, releasedWorld);
      store.setState({ movedPosition: local });
      const o = callbacks.current;
      router.endBoardMove(
        composeNodeWorld({ position: local, rotation: o.rotation, scale: o.scale }, o.parentWorld ?? IDENTITY_MAT4),
      );
      o.onMoveEnd?.(local);
    },
    [router, store],
  );

  return { boardWorld, position: resolvedPosition, onMoveStart, onMoveEnd };
}
