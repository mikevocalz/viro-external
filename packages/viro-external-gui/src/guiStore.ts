import { create } from "zustand";

/**
 * Shared GUI state: focus, modal stacks, currently-grabbed slate id, etc.
 *
 * Per CLAUDE.md: shared state lives here, never in useState. Visual transient
 * state (hover/pressed scale) lives in component-local useState — that's not
 * "app state" per the rule, it's render-derived visual effect.
 */
export interface GuiState {
  /** Id of the control that currently owns input focus. */
  focusedControlId: string | null;
  setFocusedControlId: (id: string | null) => void;

  /** Id of any slate currently being grabbed by the title bar. Null when idle. */
  grabbedSlateId: string | null;
  setGrabbedSlateId: (id: string | null) => void;
}

export const useGuiStore = create<GuiState>((set) => ({
  focusedControlId: null,
  setFocusedControlId: (id) => set({ focusedControlId: id }),
  grabbedSlateId: null,
  setGrabbedSlateId: (id) => set({ grabbedSlateId: id }),
}));
