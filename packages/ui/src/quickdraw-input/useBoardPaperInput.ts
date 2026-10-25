import { useEffect, useMemo, useRef } from "react";
import { AppState } from "react-native";
import type { Vec3 } from "@viro-external/core";
import { assertFlatBoard, boardDragPlane, type BoardSurfaceGeometry, type Mat4 } from "./board-geometry";
import type { BoardInputRouter } from "./BoardInputRouter";

/**
 * Options for {@linkcode useBoardPaperInput}.
 */
export interface BoardPaperInputOptions {
  geometry: BoardSurfaceGeometry;
  /** World matrix of the paper quad's node. Changing it cancels in-flight strokes. */
  boardWorld: Mat4;
  /** `false` cancels every stroke and drops input. @default true */
  isEnabled?: boolean;
  /**
   * Change this value on tracking loss, focus loss, recenter or a change of
   * board owner: every captured stroke is cancelled when it changes.
   */
  resetKey?: unknown;
  /** The paper's curvature. Anything but 0 throws: input is flat-only. @default 0 */
  curvature?: number;
}

/**
 * Props for the `ViroQuad` that shows the paper.
 * @see {@linkcode useBoardPaperInput}
 */
export interface BoardPaperInputProps {
  onClickState: (clickState: number, position: Vec3, source: number) => void;
  onDrag: (dragToPos: Vec3, source: number) => void;
  onHover: (isHovering: boolean, position: Vec3, source: number) => void;
  /** Viro reports the live ray/plane intersection, offset by the press (see `planeHitFromDrag`). */
  dragType: "FixedToPlane";
  dragPlane: { planePoint: Vec3; planeNormal: Vec3; maxDistance: number };
  /** Viro computes the drag but moves nothing: drawing never repositions the board. */
  dragTransform: "none";
  /** Triangle hits instead of the bounding box, so the hit lies on the paper's plane. */
  highAccuracyEvents: true;
}

/**
 * Connects a paper `ViroQuad` to a {@linkcode BoardInputRouter}.
 *
 * Handlers are stable for the router's lifetime and write straight into the
 * router, so a pointer sample never re-renders React. The hook also cancels
 * every stroke when the app leaves the foreground, when `resetKey` changes,
 * when input is disabled, and on unmount. It does not dispose the router: a
 * session owns it and outlives this component.
 */
export function useBoardPaperInput(router: BoardInputRouter, options: BoardPaperInputOptions): BoardPaperInputProps {
  const { geometry, boardWorld, isEnabled = true, resetKey, curvature } = options;
  assertFlatBoard(curvature);

  const routerRef = useRef(router);
  routerRef.current = router;

  useEffect(() => {
    router.setSurface(geometry, boardWorld);
  }, [router, geometry, boardWorld]);

  useEffect(() => {
    router.setEnabled(isEnabled);
  }, [router, isEnabled]);

  // Skip the first run: only a change of key is a reset.
  const lastResetKey = useRef(resetKey);
  useEffect(() => {
    if (Object.is(lastResetKey.current, resetKey)) return;
    lastResetKey.current = resetKey;
    router.cancelAll("tracking-lost");
  }, [router, resetKey]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") router.cancelAll("background");
    });
    return () => {
      subscription.remove();
      router.cancelAll("unmount");
      router.setEnabled(false);
    };
  }, [router]);

  const dragPlane = useMemo(() => boardDragPlane(boardWorld), [boardWorld]);

  const handlers = useMemo(
    () => ({
      onClickState: (clickState: number, position: Vec3, source: number) =>
        routerRef.current.handleViroClickState(clickState, position ?? [], source),
      onDrag: (dragToPos: Vec3, source: number) => routerRef.current.handleViroDrag(dragToPos ?? [], source),
      onHover: (isHovering: boolean, position: Vec3, source: number) =>
        routerRef.current.handleViroHover(isHovering, position ?? [], source),
    }),
    [],
  );

  return useMemo(
    () => ({
      ...handlers,
      dragType: "FixedToPlane" as const,
      dragPlane,
      dragTransform: "none" as const,
      highAccuracyEvents: true as const,
    }),
    [handlers, dragPlane],
  );
}
