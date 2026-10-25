import React, { useEffect, useRef } from "react";
import { SpatialPanel } from "./SpatialPanel";
import { toLegacyQuickdrawSpatialPointer } from "./quickdraw-input/pointer-sinks";
import type { QuickdrawSpatialPanelProps } from "./QuickdrawSpatialPanel.types";

/**
 * Viro panel chrome around a QuickDraw surface.
 *
 * `surface` is supplied by the caller (`QuickDrawNativeBoard` or
 * `QuickDrawSpatialSurface`); this component owns only the chrome, hit
 * geometry and frame dragging. Input reaches the board through the surface's
 * `BoardInputRouter`; pass it as `inputRouter` to observe it with `onPointer`.
 */
export function QuickdrawSpatialPanel({
  width = 1.6,
  height = 1,
  title = "QuickDraw",
  draggable = true,
  position,
  surface,
  inputRouter,
  onPointer,
}: QuickdrawSpatialPanelProps): React.ReactElement {
  const onPointerRef = useRef(onPointer);
  onPointerRef.current = onPointer;
  const hasListener = onPointer !== undefined;

  useEffect(() => {
    if (inputRouter === undefined || !hasListener) return undefined;
    const subscription = inputRouter.addOnPointerEventListener((event) => {
      const legacy = toLegacyQuickdrawSpatialPointer(event);
      if (legacy !== undefined) onPointerRef.current?.(legacy);
    });
    return () => subscription.remove();
  }, [inputRouter, hasListener]);

  return (
    <SpatialPanel
      title={title}
      width={width}
      height={height}
      draggable={draggable}
      resizable={false}
      showPinAction={false}
      showCloseAction={false}
      position={position}
    >
      <>{surface}</>
    </SpatialPanel>
  );
}
