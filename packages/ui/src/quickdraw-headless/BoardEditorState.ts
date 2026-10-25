import type { Camera, GeoId, Styles, ToolId } from "@quickdrawjs/core";
import type { HeadlessBoard } from "./HeadlessBoard";

/**
 * An open text edit on a freshly placed `text` or `note` shape. The host owns
 * the input field (and IME); it pushes the value with
 * {@linkcode HeadlessBoard.setEditingText} and closes the edit with
 * {@linkcode HeadlessBoard.commitText}.
 */
export interface BoardTextEdit {
  id: string;
  field: "text";
}

/**
 * Editor view state that is not part of the document.
 * @see {@linkcode HeadlessBoard.getEditorState}
 */
export interface BoardEditorState {
  /** Active tool. Line, arrow, geo, text and note switch to `select` when they finish, as in QuickDraw. */
  tool: ToolId;
  geoKind: GeoId;
  /** Pen styles applied to new shapes. */
  styles: Styles;
  camera: Camera;
  selection: readonly string[];
  /** Set once a `pen` source touches down; while set, `touch` pointers do not draw. */
  isPenMode: boolean;
  textEdit: BoardTextEdit | undefined;
}
