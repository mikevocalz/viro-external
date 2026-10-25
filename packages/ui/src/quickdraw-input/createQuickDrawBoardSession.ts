import { Store } from "@quickdrawjs/core";
import { createHeadlessBoard } from "../quickdraw-headless/createHeadlessBoard";
import { createBoardInputRouter } from "./createBoardInputRouter";
import { createHeadlessBoardSink } from "./pointer-sinks";
import type { QuickDrawBoardSession, QuickDrawBoardSessionOptions } from "./QuickDrawBoardSession";

let sessionCounter = 0;

/**
 * Creates a {@linkcode QuickDrawBoardSession}: Store, headless board and the
 * input router wired to it. Create it once per document, outside any
 * component, and pass it to `QuickDrawNativeBoard`.
 *
 * @throws RangeError when `boardWidth` or `boardHeight` is not finite and > 0.
 */
export function createQuickDrawBoardSession(options: QuickDrawBoardSessionOptions): QuickDrawBoardSession {
  const { store = new Store(), boardWidth = 1008, boardHeight = 630, input, ...boardOptions } = options;
  if (!Number.isFinite(boardWidth) || boardWidth <= 0) throw new RangeError(`boardWidth must be > 0, got ${boardWidth}`);
  if (!Number.isFinite(boardHeight) || boardHeight <= 0) throw new RangeError(`boardHeight must be > 0, got ${boardHeight}`);
  const board = createHeadlessBoard({ ...boardOptions, store });
  const router = createBoardInputRouter(input);
  const subscription = router.addOnPointerEventListener(createHeadlessBoardSink(board, { boardWidth, boardHeight }));
  sessionCounter += 1;
  const id = `quickdraw-session-${sessionCounter}`;
  let isDisposed = false;

  return {
    id,
    store,
    board,
    input: router,
    boardWidth,
    boardHeight,
    get isDisposed() {
      return isDisposed;
    },
    dispose() {
      if (isDisposed) return;
      isDisposed = true;
      // Cancel first so the board sees each gesture end before it goes away.
      router.dispose();
      subscription.remove();
      board.dispose();
    },
  };
}
