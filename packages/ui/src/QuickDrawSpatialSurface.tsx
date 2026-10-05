import React, { useEffect, useMemo, useRef } from "react";
import { ViroQuad } from "@reactvision/react-viro";
import {
  type NativeQuickDrawSpatialAdapter,
  type QuickDrawSpatialSurfaceConfig,
} from "@viro-external/xr-contract";
import { MovableNode } from "@viro-external/core";
import type { Vec3 } from "@viro-external/core";

export type QuickDrawSpatialSurfaceProps = {
  adapter: NativeQuickDrawSpatialAdapter;
  width: number;
  height: number;
  pageWidth: number;
  pageHeight: number;
  position?: Vec3;
  movable?: boolean;
  dragType?: "FixedDistance" | "FixedToPlane" | "FixedDistanceOrigin";
  dragPlane?: unknown;
  onMoveStart?: () => void;
  onMove?: (position: Vec3) => void;
  onMoveEnd?: (position: Vec3) => void;
  interactive?: boolean;
  children?: React.ReactNode;
};

export function QuickDrawSpatialSurface({
  adapter,
  width,
  height,
  pageWidth,
  pageHeight,
  position,
  movable = true,
  dragType,
  dragPlane,
  onMoveStart,
  onMove,
  onMoveEnd,
  interactive = true,
  children,
}: QuickDrawSpatialSurfaceProps): React.ReactElement {
  const handleRef = useRef<ReturnType<NativeQuickDrawSpatialAdapter["mount"]> | null>(null);

  const config = useMemo<QuickDrawSpatialSurfaceConfig>(
    () => ({
      width,
      height,
      pageWidth,
      pageHeight,
      interactive,
      drag: { enabled: movable },
    }),
    [height, interactive, movable, pageHeight, pageWidth, width],
  );

  useEffect(() => {
    const handle = adapter.mount(config);
    handleRef.current = handle;
    return () => {
      handle.dispose();
      adapter.unmount(handle);
      handleRef.current = null;
    };
  }, [adapter, config]);

  return (
    <MovableNode
      movable={movable}
      dragType={dragType}
      dragPlane={dragPlane}
      position={position}
      onMoveStart={onMoveStart}
      onMove={onMove}
      onMoveEnd={onMoveEnd}
    >
      <ViroQuad
        width={width}
        height={height}
        materials={[handleRef.current?.materialName ?? "quickdraw_spatial_placeholder"]}
      >
        {children}
      </ViroQuad>
    </MovableNode>
  );
}
