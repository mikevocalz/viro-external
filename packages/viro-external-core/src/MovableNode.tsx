import React, {
  useCallback,
  useEffect,
  useRef,
} from "react";
import { createStore, type StoreApi } from "zustand/vanilla";
import { useStore } from "zustand";
import { ViroNode } from "@reactvision/react-viro";
import { createMoveGesture } from "./createMoveGesture";
import type { MoveGesture } from "./MoveGesture";
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

  const gestureRef = useRef<MoveGesture | null>(null);
  if (gestureRef.current === null) gestureRef.current = createMoveGesture();
  const gesture = gestureRef.current;
  const pinchStartScale = useRef<Vec3>([sx, sy, sz]);
  const storeRef = useRef<StoreApi<{ scale: Vec3 }> | null>(null);
  if (storeRef.current === null) {
    storeRef.current = createStore(() => ({ scale: [sx, sy, sz] as Vec3 }));
  }
  const store = storeRef.current;
  const currentScale = useStore(store, (state) => state.scale);

  useEffect(() => {
    store.setState({ scale: [sx, sy, sz] });
  }, [store, sx, sy, sz]);

  // Turning movable off or unmounting mid-grip drops the grip: its release
  // never arrives, and the next drag must start a new move (onMoveStart)
  // instead of continuing from the old anchor. The cleanup also covers
  // StrictMode's simulated unmount, which keeps refs. A position change
  // alone does not drop it: callers may echo onMove into position while the
  // controller is still held.
  useEffect(() => {
    gesture.abort();
    return () => gesture.abort();
  }, [gesture, movable]);

  const handleDrag = useCallback(
    (dragToPos: Vec3) => {
      const { position: clamped, isStart } = gesture.drag(dragToPos, axisLock);
      if (isStart) onMoveStart?.();
      onMove?.(clamped);
    },
    [axisLock, gesture, onMove, onMoveStart]
  );

  const finishDrag = useCallback(() => {
    const released = gesture.release();
    if (released !== undefined) onMoveEnd?.(released);
  }, [gesture, onMoveEnd]);

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
        store.setState({ scale: [
          start[0] * scaleFactor,
          start[1] * scaleFactor,
          start[2] * scaleFactor,
        ] });

        finishDrag();
      }
    },
    [currentScale, finishDrag, pinchToScale, store]
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
