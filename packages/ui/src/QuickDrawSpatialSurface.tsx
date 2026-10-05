import React, { useEffect, useMemo, useRef, useState } from "react";
import { ViroQuad } from "@reactvision/react-viro";
import {
  type NativeQuickDrawSpatialAdapter,
  type QuickDrawSpatialSurfaceConfig,
} from "@viro-external/xr-contract";
import { MovableNode } from "@viro-external/core";
import type { MovableProps, Vec3 } from "@viro-external/core";

export type QuickDrawSpatialSurfaceProps = MovableProps & {
  adapter: NativeQuickDrawSpatialAdapter;
  width: number;
  height: number;
  pageWidth: number;
  pageHeight: number;
  position?: Vec3;
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
  const [materialName, setMaterialName] = useState("quickdraw_spatial_placeholder");

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
    setMaterialName(handle.materialName);
    return () => {
      handle.dispose();
      adapter.unmount(handle);
      handleRef.current = null;
      setMaterialName("quickdraw_spatial_placeholder");
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
        materials={[materialName]}
      >
        {children}
      </ViroQuad>
    </MovableNode>
  );
}
