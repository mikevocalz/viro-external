import React, { useMemo } from "react";
import defaults from "../config/defaults.json";
import { VolumeBasedPanel, type VolumeMapper, type VolumeBasedPanelProps } from "./VolumeBasedPanel";
import type { Vec3 } from "react-native-viro-mux";

export interface SpherePanelProps extends Omit<VolumeBasedPanelProps, "map" | "columns" | "rows" | "margin"> {
  radius?: number;
  columns?: number;
  rows?: number;
  margin?: number;
  /** Per-cell width/height in meters. Used to derive minimum angular spacing. */
  cellWidth?: number;
  cellHeight?: number;
}

export function deriveSphereSpacing(opts: {
  radius: number;
  cellWidth: number;
  cellHeight: number;
  columns: number;
  rows: number;
  marginRadians: number;
}): { stepPhi: number; stepTheta: number } {
  const { radius, cellWidth, cellHeight, columns, rows, marginRadians } = opts;
  if (cellWidth >= 2 * radius || cellHeight >= 2 * radius) {
    throw new Error("SpherePanel: cell size must be < 2 * radius");
  }
  // Horizontal (around the y axis) — minimum angular step so adjacent cells don't overlap.
  const stepPhi = 2 * Math.asin(cellWidth / (2 * radius)) + marginRadians;
  const stepTheta = 2 * Math.asin(cellHeight / (2 * radius)) + marginRadians;
  if (columns * stepPhi > 2 * Math.PI) {
    throw new Error("SpherePanel: over-subscribed in columns. Increase radius or reduce columns.");
  }
  if (rows * stepTheta > Math.PI) {
    throw new Error("SpherePanel: over-subscribed in rows. Increase radius or reduce rows.");
  }
  return { stepPhi, stepTheta };
}

export function SpherePanel(props: SpherePanelProps): React.ReactElement {
  const {
    radius = defaults.cylinderPanel.radius,
    columns = defaults.cylinderPanel.columns,
    rows = defaults.cylinderPanel.rows,
    margin = defaults.cylinderPanel.margin,
    cellWidth = defaults.button.widthMeters,
    cellHeight = defaults.button.heightMeters,
    children,
    ...rest
  } = props;

  const { stepPhi, stepTheta } = deriveSphereSpacing({
    radius,
    cellWidth,
    cellHeight,
    columns,
    rows,
    marginRadians: margin / radius,
  });

  const map: VolumeMapper = useMemo(() => {
    return ({ col, row }) => {
      const phi = -((columns - 1) / 2) * stepPhi + col * stepPhi; // horizontal around y
      const theta = ((rows - 1) / 2) * stepTheta - row * stepTheta; // vertical, top to bottom
      const x = radius * Math.cos(theta) * Math.sin(phi);
      const y = radius * Math.sin(theta);
      const z = -radius * Math.cos(theta) * Math.cos(phi);
      // Face the sphere center (the user): the +z normal must point from the
      // cell toward the origin → yaw = -φ, pitch = +θ. (+φ was the same
      // sideways-facing bug as CylinderPanel.)
      const yawDeg = (-phi * 180) / Math.PI;
      const pitchDeg = (theta * 180) / Math.PI;
      return { position: [x, y, z] as Vec3, rotation: [pitchDeg, yawDeg, 0] };
    };
  }, [radius, stepPhi, stepTheta, columns, rows]);

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
