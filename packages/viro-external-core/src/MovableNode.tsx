import React, { useCallback, useRef } from "react";
import { ViroNode } from "@reactvision/react-viro";
import type { MovableProps, Vec3 } from "./spatialTypes";

export type MovableNodeProps = MovableProps & {
  children: React.ReactNode;
  position?: Vec3;
  scale?: Vec3;
};

export function MovableNode(props: MovableNodeProps): React.ReactElement {
  const {
    movable = false,
    tag,
    dragType = "FixedDistance",
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

  const dragStartWorld = useRef<Vec3 | null>(null);
  const lastDragWorld = useRef<Vec3 | null>(null);
  const pinchStartScale = useRef<Vec3>(scale ?? [1, 1, 1]);
  const currentScale = useRef<Vec3>(scale ?? [1, 1, 1]);

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

  const handlePinch = useCallback(
    (pinchState: number, scaleFactor: number) => {
      if (!pinchToScale) return;

      if (pinchState === 1) {
        pinchStartScale.current = currentScale.current;
      } else if (pinchState === 3) {
        const start = pinchStartScale.current;
        currentScale.current = [
          start[0] * scaleFactor,
          start[1] * scaleFactor,
          start[2] * scaleFactor,
        ];

        if (lastDragWorld.current && dragStartWorld.current) {
          onMoveEnd?.(lastDragWorld.current);
          dragStartWorld.current = null;
          lastDragWorld.current = null;
        }
      }
    },
    [onMoveEnd, pinchToScale]
  );

  const tagProps = (
    tag !== undefined ? { viroTag: tag } : {}
  ) as Record<string, never>;

  if (!movable) {
    return (
      <ViroNode {...tagProps} position={position} scale={scale}>
        {children}
      </ViroNode>
    );
  }

  return (
    <ViroNode
      {...tagProps}
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
