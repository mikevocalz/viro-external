import React from "react";
import { ViroSlate } from "@viro-external/core";
import { MovableNode, type MovableProps, type Vec3 } from "react-native-viro-mux";
import { MovablePanelContext } from "./MovablePanelContext";
import { PlanePanel, type PlanePanelProps } from "./PlanePanel";

export interface TouchHolographicMenuProps extends MovableProps {
  /** Grid layout for the buttons. */
  columns?: PlanePanelProps["columns"];
  rows?: PlanePanelProps["rows"];
  margin?: PlanePanelProps["margin"];
  cellWidth?: PlanePanelProps["cellWidth"];
  cellHeight?: PlanePanelProps["cellHeight"];
  /** Backplate size in meters. Defaults from cell × grid + padding. */
  backplateWidth?: number;
  backplateHeight?: number;
  backplatePadding?: number;
  /** Title shown on the grab bar. */
  title?: string;
  position?: Vec3;
  rotation?: Vec3;
  scale?: Vec3;
  children: React.ReactNode;
}

/**
 * MRTK-style near menu: glass backplate hosting a PlanePanel grid of buttons,
 * with a title-bar grab bar as the ONLY movable handle. Per PROMPT-5's container
 * rule, child buttons inside this menu never drag loose — MovablePanelContext
 * disables their own `movable`.
 */
export function TouchHolographicMenu(props: TouchHolographicMenuProps): React.ReactElement {
  const {
    columns = 3,
    rows = 2,
    margin = 0.04,
    cellWidth = 0.18,
    cellHeight = 0.18,
    backplatePadding = 0.04,
    title,
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

  const gridWidth = columns * cellWidth + (columns - 1) * margin;
  const gridHeight = rows * cellHeight + (rows - 1) * margin;
  const backplateWidth = props.backplateWidth ?? gridWidth + backplatePadding * 2;
  const backplateHeight = props.backplateHeight ?? gridHeight + backplatePadding * 2;

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
        <ViroSlate
          title={title}
          widthMeters={backplateWidth}
          heightMeters={backplateHeight}
          variant="glass"
          rotation={rotation}
        />
        <PlanePanel
          columns={columns}
          rows={rows}
          margin={margin}
          cellWidth={cellWidth}
          cellHeight={cellHeight}
        >
          {children}
        </PlanePanel>
      </MovablePanelContext.Provider>
    </MovableNode>
  );
}
