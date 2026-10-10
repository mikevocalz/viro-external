import { createStore } from "zustand/vanilla";
import type { WorldSlotPlacement } from "./world-slot";

type Placement = Pick<WorldSlotPlacement, "position" | "rotation">;
type PanelState = {
  releasedPlacement: Placement | null;
  pinned: boolean;
  closed: boolean;
  setReleasedPlacement: (placement: Placement | null) => void;
};

// Each mounted panel owns a separate store; no native handles are serialized.
export function createPanelStore(defaultPinned: boolean) {
  return createStore<PanelState>()((set) => ({
    releasedPlacement: null,
    pinned: defaultPinned,
    closed: false,
    setReleasedPlacement: (placement) => set({ releasedPlacement: placement }),
  }));
}
