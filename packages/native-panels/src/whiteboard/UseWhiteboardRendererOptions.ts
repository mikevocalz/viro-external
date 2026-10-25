import type { Store } from "@quickdrawjs/core";
import type { WhiteboardRendererOptions } from "../specs/WhiteboardRendererOptions";
import type { useWhiteboardRenderer } from "./useWhiteboardRenderer";
import type { WhiteboardRendererBindingOptions } from "./WhiteboardRendererBindingOptions";

/**
 * Options for {@linkcode useWhiteboardRenderer}: the renderer options plus
 * the document to draw. Changing any field except `onError` replaces the
 * renderer.
 */
export interface UseWhiteboardRendererOptions extends WhiteboardRendererOptions {
  /** The QuickDraw document. */
  store: Store;
  /** The headless board editing `store`, for overlay and camera. */
  board?: WhiteboardRendererBindingOptions["board"];
  /** See {@linkcode WhiteboardRendererBindingOptions.onError}. */
  onError?: (error: Error) => void;
}
