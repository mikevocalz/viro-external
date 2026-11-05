import type { ReactNode } from "react";
import { create } from "zustand";

import type { SpatialWindowPlacement, SpatialWindowSpec } from "../geometry/SpatialWindowSpec";

/** One window the root host renders: its spec and content. */
export interface HostedSpatialWindow {
  readonly window: SpatialWindowSpec;
  readonly content: ReactNode;
}

/**
 * Windows the root host renders at the main surface's origin (Harlem Might
 * ADR 0005). Surfaces add themselves through `useHostedSpatialWindow` instead
 * of rendering a window where they are declared.
 */
export interface SpatialWindowHostState {
  /** Requested windows by label, in mount order. */
  readonly windows: Readonly<Record<string, HostedSpatialWindow>>;
  /** Adds or replaces the window with this label. */
  mount(entry: HostedSpatialWindow): void;
  /** Removes the window with this label; an unknown label is ignored. */
  unmount(label: string): void;
}

/** @see {@linkcode SpatialWindowHostState} */
export const useSpatialWindowHostStore = create<SpatialWindowHostState>((set) => ({
  windows: {},
  mount: (entry) => set((state) => ({ windows: { ...state.windows, [entry.window.label]: entry } })),
  unmount: (label) =>
    set((state) => {
      if (!(label in state.windows)) return state;
      const rest = { ...state.windows };
      delete rest[label];
      return { windows: rest };
    }),
}));

/**
 * Placement of windows a PICO build draws in its main window's strip, in the
 * same vocabulary as Meta's `useSpatialWindowState`, so a surface cannot tell
 * the backends apart.
 */
export interface StripPlacementState {
  readonly placements: Readonly<Record<string, SpatialWindowPlacement>>;
  setPlacement(label: string, placement: SpatialWindowPlacement): void;
}

/** @see {@linkcode StripPlacementState} */
export const useStripPlacementStore = create<StripPlacementState>((set) => ({
  placements: {},
  setPlacement: (label, placement) =>
    set((state) => ({ placements: { ...state.placements, [label]: placement } })),
}));
