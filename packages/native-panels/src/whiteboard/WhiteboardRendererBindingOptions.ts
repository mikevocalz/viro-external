import type { ShapeRecord, Store } from "@quickdrawjs/core";
import type { HeadlessBoard } from "@viro-external/ui";
import type { WhiteboardRendererTarget } from "./WhiteboardRendererTarget";
import type { createWhiteboardRendererBinding } from "./createWhiteboardRendererBinding";

/**
 * Options for {@linkcode createWhiteboardRendererBinding}.
 */
export interface WhiteboardRendererBindingOptions {
  /** The QuickDraw document. Every diff it emits reaches the renderer, coalesced per frame. */
  store: Store;
  /** The renderer to keep in sync. The binding never disposes it. */
  renderer: WhiteboardRendererTarget;
  /**
   * The headless board editing {@linkcode WhiteboardRendererBindingOptions.store}.
   * When given, its overlay and camera reach the renderer and fading laser
   * trails are advanced each frame. Without it the renderer shows the
   * document only.
   */
  board?: Pick<
    HeadlessBoard,
    "getOverlay" | "addOnOverlayChangedListener" | "expireOverlay" | "getEditorState" | "addOnEditorStateChangedListener"
  >;
  /**
   * The ink outline for a `draw` record, `getInkOutline` from
   * `@viro-external/ui`. It calls QuickDraw's own `strokeOutline`, so the
   * native board fills exactly the outline the web board fills.
   */
  getInkOutline: (shape: ShapeRecord) => number[] | undefined;
  /**
   * Schedules one callback before the next frame, like `requestAnimationFrame`.
   * The timestamp must share a clock with the board's pointer sample
   * timestamps, which laser fading compares against.
   */
  requestFrame: (callback: (timestampMs: number) => void) => number;
  /** Cancels a callback from {@linkcode WhiteboardRendererBindingOptions.requestFrame}. */
  cancelFrame: (handle: number) => void;
  /**
   * Called when the renderer rejects a call (stale revision, malformed
   * payload) or a resync fails. The binding answers a rejection by sending a
   * full snapshot on the next frame.
   */
  onError?: (error: Error) => void;
}
