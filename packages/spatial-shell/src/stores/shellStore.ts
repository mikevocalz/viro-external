import { create } from "zustand";

import type { DetailPanelHost } from "../detail/DetailPanelHost";
import type { DetailPanelStatus } from "../detail/detailPanelRules";
import type { SpatialWindowPlacement } from "../geometry/SpatialWindowSpec";

/**
 * The shell's state.
 *
 * - `selectedDetailId`: the detail the user opened, or undefined. The detail
 *   panel is a second surface on the same JS runtime and reads it too.
 * - `detailStatus`: where the detail panel is. Stays `closed` on builds
 *   without panels.
 * - `panelHost`: the native panel host once the shell has one.
 * - `railPlacement`: the rail window's placement.
 *
 * @see {@linkcode useSpatialShellStore}
 */
export interface SpatialShellState {
  readonly selectedDetailId: string | undefined;
  readonly detailStatus: DetailPanelStatus;
  readonly panelHost: DetailPanelHost | undefined;
  readonly railPlacement: SpatialWindowPlacement;
  selectDetail(id: string): void;
  clearDetail(): void;
  /**
   * The pushed detail screen for `id` went away (Close, hardware Back, a
   * gesture). Clears the selection if it is still `id`, and turns a `failed`
   * status back to `closed` so the next detail tries the panel again.
   */
  leaveDetailScreen(id: string): void;
  setDetailStatus(status: DetailPanelStatus): void;
  setPanelHost(host: DetailPanelHost): void;
  setRailPlacement(placement: SpatialWindowPlacement): void;
}

/**
 * The shell's store, in memory only: a panel never outlives the process that
 * opened it.
 */
export const useSpatialShellStore = create<SpatialShellState>((set) => ({
  selectedDetailId: undefined,
  detailStatus: "closed",
  panelHost: undefined,
  railPlacement: "inline",
  selectDetail: (id) => set({ selectedDetailId: id }),
  clearDetail: () => set({ selectedDetailId: undefined }),
  leaveDetailScreen: (id) =>
    set((state) =>
      state.selectedDetailId === id
        ? {
            selectedDetailId: undefined,
            detailStatus: state.detailStatus === "failed" ? "closed" : state.detailStatus,
          }
        : {}
    ),
  setDetailStatus: (detailStatus) => set({ detailStatus }),
  setPanelHost: (panelHost) => set({ panelHost }),
  setRailPlacement: (railPlacement) => set({ railPlacement }),
}));
