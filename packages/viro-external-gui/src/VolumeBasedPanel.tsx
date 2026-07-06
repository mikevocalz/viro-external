import React, { useCallback } from "react";
import { MovableNode, type MovableProps, type Vec3 } from "react-native-viro-mux";
import { Container3D, type ArrangedChild } from "./Container3D";
import { MovablePanelContext } from "./MovablePanelContext";

export interface VolumeMappingContext {
  index: number;
  col: number;
  row: number;
  count: number;
  columns: number;
  rows: number;
}

export type VolumeMapper = (ctx: VolumeMappingContext) => {
  position: Vec3;
  rotation?: Vec3;
};

export interface VolumeBasedPanelProps extends MovableProps {
  columns: number;
  rows: number;
  margin: number;
  /** Concrete panels supply this — maps slot → world transform on the volume. */
  map: VolumeMapper;
  blockLayout?: boolean;
  position?: Vec3;
  rotation?: Vec3;
  scale?: Vec3;
  children: React.ReactNode;
}

/**
 * Base for PlanePanel, SpherePanel, ScatterPanel. Subclasses only supply `map`.
 * Movability and the MovablePanelContext rule live here once.
 */
export function VolumeBasedPanel(props: VolumeBasedPanelProps): React.ReactElement {
  const {
    columns,
    rows,
    map,
    blockLayout,
    position,
    rotation,
    scale,
    movable,
    tag,
    dragType,
    dragPlane,
    axisLock,
    onMoveStart,
    onMove,
    onMoveEnd,
    pinchToScale,
    children,
  } = props;

  const arrange = useCallback(
    (kids: React.ReactNode[]): ArrangedChild[] => {
      const count = Math.min(kids.length, columns * rows);
      const out: ArrangedChild[] = new Array(count);
      for (let i = 0; i < count; i++) {
        const col = i % columns;
        const row = Math.floor(i / columns);
        const slot = map({ index: i, col, row, count, columns, rows });
        out[i] = { child: kids[i], position: slot.position, rotation: slot.rotation };
      }
      return out;
    },
    [map, columns, rows]
  );

  return (
    <MovableNode
      movable={movable}
      tag={tag}
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
