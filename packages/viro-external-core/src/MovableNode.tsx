import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
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

  const sx = scale?.[0] ?? 1;
  const sy = scale?.[1] ?? 1;
  const sz = scale?.[2] ?? 1;

  const dragStartWorld = useRef<Vec3 | null>(null);
  const lastDragWorld = useRef<Vec3 | null>(null);
  const pinchStartScale = useRef<Vec3>([sx, sy, sz]);
  const [currentScale, setCurrentScale] = useState<Vec3>([sx, sy, sz]);

  useEffect(() => {
    setCurrentScale([sx, sy, sz]);
  }, [sx, sy, sz]);

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

  const finishDrag = useCallback(() => {
    if (dragStartWorld.current === null || lastDragWorld.current === null) return;
    const released = lastDragWorld.current;
    dragStartWorld.current = null;
    lastDragWorld.current = null;
    onMoveEnd?.(released);
  }, [onMoveEnd]);

  const handleClickState = useCallback((clickState: number) => {
    // onDrag has no end-state flag. Viro CLICK_UP=2 is the controller release.
    if (clickState === 2) finishDrag();
  }, [finishDrag]);

  const handlePinch = useCallback(
    (pinchState: number, scaleFactor: number) => {
      if (!pinchToScale) return;

      if (pinchState === 1) {
        pinchStartScale.current = currentScale;
      } else if (pinchState === 3) {
        const start = pinchStartScale.current;
        setCurrentScale([
          start[0] * scaleFactor,
          start[1] * scaleFactor,
          start[2] * scaleFactor,
        ]);

        finishDrag();
      }
    },
    [currentScale, finishDrag, pinchToScale]
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
      scale={currentScale}
      dragType={dragType}
      dragPlane={dragPlane}
      onDrag={handleDrag}
      onClickState={handleClickState}
      onPinch={pinchToScale ? handlePinch : undefined}
    >
      {children}
    </ViroNode>
  );
}
