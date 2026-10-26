import type { Camera, GeoId, Styles, ToolId } from "@quickdrawjs/core";
import type { BoardEditorState } from "./BoardEditorState";
import type { BoardOverlay } from "./BoardOverlay";
import type { BoardPointerSample } from "./BoardPointerSample";

/**
 * Cleanup handle returned by listener registration. `remove` is idempotent.
 * @see {@linkcode HeadlessBoard.addOnOverlayChangedListener}
 */
export interface BoardListenerSubscription {
  remove(): void;
}

/**
 * A QuickDraw editor without a DOM. It turns board-space pointer samples into
 * transactions on the QuickDraw `Store` it was given, with the same records,
 * ids, styles and history boundaries as QuickDraw's `Editor`.
 *
 * Every pointer is captured on its own: a cancel or lift ends only that
 * pointer's gesture. Methods that take a sample throw `TypeError` or
 * `RangeError` for malformed input (non-finite numbers, pressure outside
 * `[0, 1]`, unknown source, a timestamp older than the pointer's last
 * sample, a second down for a captured pointer) and leave the Store as it was.
 *
 * Created by `createHeadlessBoard`; call {@linkcode HeadlessBoard.dispose} when done.
 */
export interface HeadlessBoard {
  /**
   * Starts a gesture with the active tool.
   * @returns `true` when the board captured the pointer. `false` when the
   * sample was not a gesture start: a `touch` source in pen mode, or a second
   * pointer pressing with the `select` tool while another select gesture runs.
   */
  pointerDown(sample: BoardPointerSample): boolean;
  /** Extends the pointer's gesture. Samples for uncaptured pointers are validated and ignored. */
  pointerMove(sample: BoardPointerSample): void;
  /** Completes the pointer's gesture. A completed stroke is one undo step. */
  pointerUp(sample: BoardPointerSample): void;
  /**
   * Abandons the pointer's gesture. An in-progress stroke, line, arrow or geo
   * shape is removed and leaves no undo step; an erase deletes nothing. A
   * move, resize or rotate keeps what it applied, as QuickDraw's abort does.
   */
  pointerCancel(pointerId: number): void;

  /** @throws RangeError for a tool QuickDraw does not define. */
  setTool(tool: ToolId): void;
  setGeoKind(kind: GeoId): void;
  /**
   * Sets a pen style and applies it to the selected shapes it fits, in one
   * transaction, as QuickDraw's `setStyle`.
   * @throws RangeError for a value QuickDraw does not define for `key`.
   */
  setStyle<K extends keyof Styles>(key: K, value: Styles[K]): void;
  /** @throws RangeError unless every field is finite and `z > 0`. */
  setCamera(camera: Camera): void;
  setPenMode(isEnabled: boolean): void;
  setSelection(ids: readonly string[]): void;
  /** Removes the selected shapes in one undoable transaction. */
  deleteSelection(): void;

  /** Replaces the text of the open {@linkcode BoardEditorState.textEdit}. @throws Error when no edit is open. */
  setEditingText(value: string): void;
  /** Closes the open text edit; an empty text shape is removed. No-op without an open edit. */
  commitText(): void;

  /**
   * Undoes the last step through `store.undo()`. Gestures that are writing
   * history are dropped first, so an in-progress stroke is what gets undone,
   * exactly as QuickDraw's `Store.undo` behaves mid-gesture.
   */
  undo(): void;
  redo(): void;

  getEditorState(): BoardEditorState;
  addOnEditorStateChangedListener(listener: (state: BoardEditorState) => void): BoardListenerSubscription;
  /** Non-persistent chrome: selection, marquee, laser, eraser trail. */
  getOverlay(): BoardOverlay;
  addOnOverlayChangedListener(listener: (overlay: BoardOverlay) => void): BoardListenerSubscription;
  /**
   * Advances laser fading to `nowMs` (same clock as sample timestamps) and
   * drops fully faded trails. Call it from the render loop while
   * {@linkcode BoardOverlay.laserStrokes} is non-empty.
   */
  expireOverlay(nowMs: number): void;

  /** Cancels open gestures, commits an open text edit and stops listening to the Store. */
  dispose(): void;
}
