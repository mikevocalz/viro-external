// QuickDraw's Store keeps one open history batch. A gesture brackets its
// writes with beginBatch/endBatch so it undoes as one step. When pointers
// overlap, the batch stays open until the last history-writing gesture ends,
// so overlapping gestures form one undo step; a gesture that never overlaps
// another is exactly one step, as in QuickDraw's Editor.
import type { Store } from "@quickdrawjs/core";

export type HistoryGroup = {
  /** A gesture starts writing history. */
  open(): void;
  /**
   * Called before each write of an open gesture. `beginBatch` is a no-op while
   * a batch exists; this reopens one if the host closed it underneath us
   * (`store.undo()`, `store.loadSnapshot()`), so later writes still batch.
   */
  ensure(): void;
  /** A gesture stops writing history; the last one closes the batch. */
  close(): void;
  /** Forget open gestures after the Store's batch was closed by `undo`. */
  reset(): void;
  readonly openCount: number;
};

export function createHistoryGroup(store: Store): HistoryGroup {
  let count = 0;
  return {
    open() {
      count++;
      store.beginBatch();
    },
    ensure() {
      if (count > 0) store.beginBatch();
    },
    close() {
      if (count === 0) return;
      count--;
      if (count === 0) store.endBatch();
    },
    reset() {
      count = 0;
    },
    get openCount() {
      return count;
    },
  };
}
