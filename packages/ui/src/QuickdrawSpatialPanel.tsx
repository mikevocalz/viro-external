import React from "react";
import { SpatialPanel } from "./SpatialPanel";
import type { QuickdrawSpatialPanelProps } from "./QuickdrawSpatialPanel.types";

/**
 * Native spatial host for QuickDraw.
 *
 * `surface` is deliberately supplied by the renderer adapter: production
 * Moyo wiring passes the ESIKU-backed native surface here. This component
 * owns only Viro panel chrome, hit geometry and frame dragging.
 */
export function QuickdrawSpatialPanel({
  width = 1.6,
  height = 1,
  title = "QuickDraw",
  draggable = true,
  position,
  surface,
}: QuickdrawSpatialPanelProps): React.ReactElement {
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
