import React, { useMemo } from "react";
import defaults from "../config/defaults.json";
import { VolumeBasedPanel, type VolumeMapper, type VolumeBasedPanelProps } from "./VolumeBasedPanel";
import type { Vec3 } from "react-native-viro-mux";

export interface PlanePanelProps extends Omit<VolumeBasedPanelProps, "map" | "columns" | "rows" | "margin"> {
  columns?: number;
  rows?: number;
  margin?: number;
  /** Per-cell width/height in meters. Defaults to button defaults. */
  cellWidth?: number;
  cellHeight?: number;
}

export function PlanePanel(props: PlanePanelProps): React.ReactElement {
  const {
    columns = defaults.cylinderPanel.columns,
    rows = defaults.cylinderPanel.rows,
    margin = defaults.cylinderPanel.margin,
    cellWidth = defaults.button.widthMeters,
    cellHeight = defaults.button.heightMeters,
    children,
    ...rest
  } = props;

  const map: VolumeMapper = useMemo(() => {
    const stepX = cellWidth + margin;
    const stepY = cellHeight + margin;
    return ({ col, row }) => {
      const x = -((columns - 1) / 2) * stepX + col * stepX;
      const y = ((rows - 1) / 2) * stepY - row * stepY;
      return { position: [x, y, 0] as Vec3 };
    };
  }, [cellWidth, cellHeight, margin, columns, rows]);

  return (
    <VolumeBasedPanel
      {...rest}
      columns={columns}
      rows={rows}
      margin={margin}
      map={map}
    >
      {children}
    </VolumeBasedPanel>
  );
}
