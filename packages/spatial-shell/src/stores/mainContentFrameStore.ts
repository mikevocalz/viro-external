import { create } from "zustand";

/**
 * The main panel's measured size in dp, 0 x 0 until its first layout. In
 * memory only: the next process measures again.
 */
export interface MainContentFrameState {
  readonly hostWidth: number;
  readonly hostHeight: number;
  /** Records a layout pass; an unchanged size is ignored. */
  setHostSize(width: number, height: number): void;
}

/** @see {@linkcode MainContentFrameState} */
export const useMainContentFrameStore = create<MainContentFrameState>((set) => ({
  hostWidth: 0,
  hostHeight: 0,
  setHostSize: (width, height) =>
    set((state) =>
      state.hostWidth === width && state.hostHeight === height
        ? state
        : { hostWidth: width, hostHeight: height }
    ),
}));
