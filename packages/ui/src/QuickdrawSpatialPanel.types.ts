import type React from "react";
import type { Vec3 } from "@viro-external/core";

export type QuickdrawSpatialPointer = {
  phase: "hover" | "down" | "move" | "up" | "cancel";
  uv: readonly [number, number];
  pressure: number;
  timestamp: number;
};

export type QuickdrawSpatialPanelProps = {
  width?: number;
  height?: number;
  title?: string;
  draggable?: boolean;
  position?: Vec3;
  surface: React.ReactNode;
  onPointer?: (event: QuickdrawSpatialPointer) => void;
};
