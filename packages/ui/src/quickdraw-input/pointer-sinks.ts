import {
  toQuickDrawSpatialPointer,
  type QuickDrawPointerEvent,
  type QuickDrawPointerSource,
  type QuickDrawSpatialSurfaceHandle,
} from "@viro-external/xr-contract";
import type { BoardPointerSource } from "../quickdraw-headless/BoardPointerSample";
import type { HeadlessBoard } from "../quickdraw-headless/HeadlessBoard";
import type { QuickdrawSpatialPointer } from "../QuickdrawSpatialPanel.types";
import { paperUvToBoard, type BoardSurfaceGeometry } from "./board-geometry";

const toBoardSource = (source: QuickDrawPointerSource): BoardPointerSource => {
  if (source === "pen") return "pen";
  if (source === "hand" || source === "pinch") return "hand";
  if (source === "touch") return "touch";
  return "controller";
};

/**
 * Forwards router events to a headless board in board units. Hover and leave
 * have no board effect and are dropped; cancel ends only that pointer.
 */
export function createHeadlessBoardSink(
  board: Pick<HeadlessBoard, "pointerDown" | "pointerMove" | "pointerUp" | "pointerCancel">,
  size: Pick<BoardSurfaceGeometry, "boardWidth" | "boardHeight">,
): (event: QuickDrawPointerEvent) => void {
  return (event) => {
    if (event.phase === "cancel") {
      board.pointerCancel(event.pointerId);
      return;
    }
    if (event.phase === "hover" || event.phase === "leave") return;
    const { x, y } = paperUvToBoard(event.uv, size);
    const sample = { pointerId: event.pointerId, source: toBoardSource(event.source), x, y, timestampMs: event.timestampMs };
    const withPressure = event.pressure === undefined ? sample : { ...sample, pressure: event.pressure };
    if (event.phase === "down") board.pointerDown(withPressure);
    else if (event.phase === "move") board.pointerMove(withPressure);
    else board.pointerUp(withPressure);
  };
}

/**
 * Forwards router events to an adapter handle: `dispatchPointerEvent` when the
 * handle has it, otherwise the deprecated `dispatchPointer`.
 */
export function createAdapterHandleSink(
  handle: Pick<QuickDrawSpatialSurfaceHandle, "dispatchPointer" | "dispatchPointerEvent">,
): (event: QuickDrawPointerEvent) => void {
  return (event) => {
    if (handle.dispatchPointerEvent !== undefined) handle.dispatchPointerEvent(event);
    else handle.dispatchPointer(toQuickDrawSpatialPointer(event));
  };
}

/** QuickDraw's "no reading" pressure, the value the board records when a device reports none. */
const NO_READING_PRESSURE = 0.5;

/**
 * Converts to the deprecated {@linkcode QuickdrawSpatialPointer}. Its
 * `pressure` is required, so a pointer without pressure reports QuickDraw's
 * no-reading value 0.5; read `QuickDrawPointerEvent.pressure` to tell the two
 * apart. `leave` has no counterpart and returns `undefined`.
 */
export function toLegacyQuickdrawSpatialPointer(event: QuickDrawPointerEvent): QuickdrawSpatialPointer | undefined {
  if (event.phase === "leave") return undefined;
  return {
    phase: event.phase,
    uv: event.uv,
    pressure: event.pressure ?? NO_READING_PRESSURE,
    timestamp: event.timestampMs,
  };
}
