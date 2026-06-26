import React, { useCallback, useRef } from "react";
import { ViroNode } from "@reactvision/react-viro";
import defaults from "../config/defaults.json";
import type { MovableProps, Vec3 } from "./contract";

type MovableNodeProps = MovableProps & {
  children: React.ReactNode;
  /** Forwarded straight to the wrapper ViroNode. */
  position?: Vec3;
  scale?: Vec3;
};

/**
 * The single implementation of drag / pinch / axisLock for every @viro-external/* component.
 *
 * Downstream components MUST NOT rewire onDrag/onPinch themselves — they spread MovableProps
 * into <MovableNode>. axisLock clamping lives here, once.
 */
export function MovableNode(props: MovableNodeProps): React.ReactElement {
  const {
    movable,
    dragType = defaults.movability.dragTypeDefault as MovableProps["dragType"],
    dragPlane,
    axisLock,
    onMoveStart,
    onMove,
    onMoveEnd,
    pinchToScale,
    position,
    scale,
    children,
  } = props;

  // World position of the node at the start of the current drag — anchor for axisLock clamping.
  const dragStartWorld = useRef<Vec3 | null>(null);
  // Last drag world-pos, used so onMoveEnd can report a final value (Viro's onDrag has no end event).
  const lastDragWorld = useRef<Vec3 | null>(null);

  // ponytail: Viro fires onDrag continuously while dragging but emits no start/end events.
  // We synthesize start on first frame and end on pinch/click-state changes downstream.
  const handleDrag = useCallback(
    (dragToPos: Vec3) => {
      if (dragStartWorld.current === null) {
        dragStartWorld.current = dragToPos;
        onMoveStart?.();
      }
      const anchor = dragStartWorld.current;
      const clamped: Vec3 = [
        axisLock?.includes("x") ? anchor[0] : dragToPos[0],
        axisLock?.includes("y") ? anchor[1] : dragToPos[1],
        axisLock?.includes("z") ? anchor[2] : dragToPos[2],
      ];
      lastDragWorld.current = clamped;
      onMove?.(clamped);
    },
    [axisLock, onMove, onMoveStart]
  );

  // PINCH_END = 3 in Viro 2.56.0 (verified in components/Types/ViroEvents.ts).
  const pinchStartScale = useRef<Vec3>([1, 1, 1]);
  const currentScale = useRef<Vec3>(scale ?? [1, 1, 1]);
  const handlePinch = useCallback(
    (pinchState: number, scaleFactor: number) => {
      if (!pinchToScale) return;
      if (pinchState === 1) {
        pinchStartScale.current = currentScale.current;
      } else if (pinchState === 3) {
        const s = pinchStartScale.current;
        currentScale.current = [s[0] * scaleFactor, s[1] * scaleFactor, s[2] * scaleFactor];
        // Also close out any in-flight drag so consumers see a clean end.
        if (lastDragWorld.current && dragStartWorld.current) {
          onMoveEnd?.(lastDragWorld.current);
          dragStartWorld.current = null;
          lastDragWorld.current = null;
        }
      }
    },
    [onMoveEnd, pinchToScale]
  );

  if (!movable) {
    return (
      <ViroNode position={position} scale={scale}>
        {children}
      </ViroNode>
    );
  }

  return (
    <ViroNode
      position={position}
      scale={currentScale.current}
      dragType={dragType}
      dragPlane={dragPlane}
      onDrag={handleDrag}
      onPinch={pinchToScale ? handlePinch : undefined}
    >
      {children}
    </ViroNode>
  );
}
