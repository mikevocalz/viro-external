import React from "react";
import { ViroSlate, type ViroSlateProps } from "@viro-external/core";
import type { MovableProps, Vec3 } from "react-native-viro-mux";
import defaults from "../config/defaults.json";
import { MovablePanelContext } from "./MovablePanelContext";

export interface HolographicSlateProps extends MovableProps {
  title?: string;
  /** Babylon prop: title bar height in meters. */
  titleBarHeight?: number;
  /** Babylon prop: title bar margin in meters. */
  titleBarMargin?: number;
  /** Babylon prop: slate dimensions. */
  dimensions?: { width: number; height: number };
  /** Babylon prop: optional minimum dimensions clamp. */
  minDimensions?: { width: number; height: number };
  renderingGroupId?: number;
  externalTexture?: ViroSlateProps["externalTexture"];
  position?: Vec3;
  rotation?: Vec3;
  scale?: Vec3;
  children?: React.ReactNode;
}

/**
 * Babylon name for the spatial window control. Thin wrap of `ViroSlate` from
 * `@viro-external/core`, which already implements the title-bar-as-grab-handle.
 */
export function HolographicSlate(props: HolographicSlateProps): React.ReactElement {
  const {
    title,
    dimensions = defaults.holographicSlate.dimensions,
    minDimensions,
    renderingGroupId,
    externalTexture,
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
  } = props;

  void renderingGroupId; // Carried through Babylon API parity; not surfaced to Viro layer.
  void minDimensions; // Babylon parity prop; consumer enforces.

  const width = Math.max(dimensions.width, minDimensions?.width ?? 0);
  const height = Math.max(dimensions.height, minDimensions?.height ?? 0);

  return (
    <MovablePanelContext.Provider value={!!movable}>
      <ViroSlate
        title={title}
        widthMeters={width}
        heightMeters={height}
        externalTexture={externalTexture}
        position={position}
        rotation={rotation}
        scale={scale}
        movable={movable}
        dragType={dragType}
        dragPlane={dragPlane}
        axisLock={axisLock}
        onMoveStart={onMoveStart}
        onMove={onMove}
        onMoveEnd={onMoveEnd}
        pinchToScale={pinchToScale}
      />
    </MovablePanelContext.Provider>
  );
}
