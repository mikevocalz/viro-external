import type { Store } from "@quickdrawjs/core";
import type { HeadlessBoard } from "../quickdraw-headless/HeadlessBoard";
import type { HeadlessBoardOptions } from "../quickdraw-headless/HeadlessBoardOptions";
import type { BoardInputRouter, BoardInputRouterOptions } from "./BoardInputRouter";

/**
 * Options for `createQuickDrawBoardSession`.
 */
export interface QuickDrawBoardSessionOptions extends Omit<HeadlessBoardOptions, "store"> {
  /** The document. A new empty `Store` when omitted. */
  store?: Store;
  /** Board width in board units. @default 1008 */
  boardWidth?: number;
  /** Board height in board units. @default 630 (16:10, ADR 0001 "Board aspect") */
  boardHeight?: number;
  /** Options for the session's input router. */
  input?: BoardInputRouterOptions;
}

/**
 * A board's document, editor and input path, owned outside React.
 *
 * Components mount and unmount around a session; surfaces are created,
 * resized and lost; the session's `store`, `board` and history survive all of
 * it. Only {@linkcode QuickDrawBoardSession.dispose} ends them.
 */
export interface QuickDrawBoardSession {
  /** Unique per session in this JS runtime. */
  readonly id: string;
  readonly store: Store;
  readonly board: HeadlessBoard;
  /** Router whose pointer events drive `board`. */
  readonly input: BoardInputRouter;
  readonly boardWidth: number;
  readonly boardHeight: number;
  readonly isDisposed: boolean;
  /** Cancels input, disposes the board and the router. The store is left as is. Idempotent. */
  dispose(): void;
}
