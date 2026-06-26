import React, { useCallback } from "react";
import { MovableNode, type MovableProps, type Vec3 } from "react-native-viro-mux";
import defaults from "../config/defaults.json";
import { Container3D, type ArrangedChild } from "./Container3D";
import { MovablePanelContext } from "./MovablePanelContext";

export interface StackPanel3DProps extends MovableProps {
  isVertical?: boolean;
  margin?: number;
  /** Per-child advance along the stacking axis (meters). Defaults to button width/height. */
  childAdvance?: number;
  blockLayout?: boolean;
  position?: Vec3;
  rotation?: Vec3;
  scale?: Vec3;
  children: React.ReactNode;
}

export function StackPanel3D(props: StackPanel3DProps): React.ReactElement {
  const {
    isVertical = defaults.stackPanel.isVertical,
    margin = defaults.stackPanel.margin,
    childAdvance,
    blockLayout,
    position,
    rotation,
    scale,
    movable,
    dragType,
    dragPlane,
    axisLock,
    onMoveStart,
    onMove,
    onMoveEnd,
    pinchToScale,
    children,
  } = props;

  const advance =
    childAdvance ?? (isVertical ? defaults.button.heightMeters : defaults.button.widthMeters);
  const step = advance + margin;

  const arrange = useCallback(
    (kids: React.ReactNode[]): ArrangedChild[] => {
      const n = kids.length;
      return kids.map((child, i) => {
        const offset = -((n - 1) / 2) * step + i * step;
        const pos: Vec3 = isVertical ? [0, -offset, 0] : [offset, 0, 0];
        return { child, position: pos };
      });
    },
    [isVertical, step]
  );

  return (
    <MovableNode
      movable={movable}
      dragType={dragType}
      dragPlane={dragPlane}
      axisLock={axisLock}
      onMoveStart={onMoveStart}
      onMove={onMove}
      onMoveEnd={onMoveEnd}
      pinchToScale={pinchToScale}
      position={position}
      scale={scale}
    >
      <MovablePanelContext.Provider value={!!movable}>
        <Container3D blockLayout={blockLayout} arrange={arrange} rotation={rotation}>
          {children}
        </Container3D>
      </MovablePanelContext.Provider>
    </MovableNode>
  );
}
