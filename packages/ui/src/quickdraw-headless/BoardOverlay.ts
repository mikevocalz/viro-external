import type { Bounds } from "@quickdrawjs/core";
import type { HeadlessBoard } from "./HeadlessBoard";

/** A point in page coordinates. */
export interface BoardPoint {
  x: number;
  y: number;
}

/**
 * Selection chrome for a box selection: everything except a lone arrow or line.
 * @see {@linkcode BoardOverlay.selection}
 */
export interface BoardBoxSelection {
  kind: "box";
  ids: readonly string[];
  /** Axis-aligned page bounds of the selection, rotation included. */
  bounds: Bounds;
  /** False for a single rotated shape, where QuickDraw hides resize handles. */
  isResizable: boolean;
  /** Whether the rotate knob is offered. */
  isRotatable: boolean;
}

/**
 * Selection chrome for a single arrow or line: endpoint and bend handles.
 * @see {@linkcode BoardOverlay.selection}
 */
export interface BoardLineSelection {
  kind: "line";
  id: string;
  start: BoardPoint;
  end: BoardPoint;
  bend: BoardPoint;
}

/** Selection chrome; see {@linkcode BoardBoxSelection} and {@linkcode BoardLineSelection}. */
export type BoardSelectionOverlay = BoardBoxSelection | BoardLineSelection;

/**
 * A laser trail. Never written to the Store.
 * @see {@linkcode HeadlessBoard.expireOverlay}
 */
export interface BoardLaserStroke {
  id: string;
  points: readonly BoardPoint[];
  /** Opacity at the time of the last {@linkcode HeadlessBoard.expireOverlay} call or edit. */
  opacity: number;
  /** When the pointer lifted; `undefined` while the trail is live. */
  endedAtMs: number | undefined;
}

/** The recent path of one erasing pointer, as flat `[x, y, ...]` page coordinates. */
export interface BoardEraserTrail {
  pointerId: number;
  points: readonly number[];
}

/**
 * Everything a renderer draws over the document that is not part of it.
 * Read with {@linkcode HeadlessBoard.getOverlay}.
 */
export interface BoardOverlay {
  selection: BoardSelectionOverlay | undefined;
  /** Live marquee rectangles in page coordinates, one per selecting pointer. */
  marquees: readonly Bounds[];
  laserStrokes: readonly BoardLaserStroke[];
  eraserTrails: readonly BoardEraserTrail[];
  /** Shapes an in-progress erase will delete; QuickDraw draws them ghosted. */
  pendingEraseIds: readonly string[];
}
