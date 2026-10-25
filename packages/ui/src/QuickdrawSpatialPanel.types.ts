import type React from "react";
import type { Vec3 } from "@viro-external/core";
import type { BoardInputRouter } from "./quickdraw-input/BoardInputRouter";

/**
 * @deprecated Use `QuickDrawPointerEvent` from `@viro-external/xr-contract`,
 * which carries `pointerId`, `source` and optional pressure. When a device
 * reports no pressure this shape carries QuickDraw's no-reading value 0.5.
 * `toLegacyQuickdrawSpatialPointer` converts.
 */
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
  /**
   * The router that receives the surface's input, usually `session.input`.
   * `onPointer` observes its events.
   */
  inputRouter?: BoardInputRouter;
  /**
   * @deprecated Subscribe with `inputRouter.addOnPointerEventListener` to get
   * `QuickDrawPointerEvent`s. Called only when `inputRouter` is given; hover
   * `leave` events are not forwarded because this shape has no such phase.
   */
  onPointer?: (event: QuickdrawSpatialPointer) => void;
};
