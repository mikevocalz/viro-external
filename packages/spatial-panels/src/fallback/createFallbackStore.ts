import { createStore, type StoreApi } from "zustand/vanilla";

import type { PresentationChange } from "../PresentationChange";
import type { PanelPose } from "../PanelPose";
import type { FallbackState } from "./FallbackState";

/** Fields of {@link FallbackState} that are not derived. */
type FallbackInputs = Omit<FallbackState, "isFallbackVisible">;

function derive(inputs: FallbackInputs): FallbackState {
  return {
    ...inputs,
    isFallbackVisible:
      inputs.presentation === "evicted" &&
      inputs.hasFallback &&
      inputs.isPanelVisible &&
      inputs.isSceneAllowed &&
      !inputs.isDisposed,
  };
}

/** The store and the transitions the handle applies to it. */
export interface FallbackStore {
  readonly store: StoreApi<FallbackState>;
  applyPresentation(change: PresentationChange): void;
  setPose(pose: PanelPose): void;
  setPanelVisible(isVisible: boolean): void;
  markDisposed(): void;
}

/** One store per panel. Every write recomputes isFallbackVisible. */
export function createFallbackStore(initial: FallbackInputs): FallbackStore {
  const store = createStore<FallbackState>(() => derive(initial));
  const update = (patch: Partial<FallbackInputs>) => {
    const current = store.getState();
    store.setState(derive({ ...current, ...patch }), true);
  };
  return {
    store,
    applyPresentation: (change) =>
      update({ presentation: change.presentation, reason: change.reason, hasFallback: change.hasFallback }),
    setPose: (pose) => update({ pose }),
    setPanelVisible: (isPanelVisible) => update({ isPanelVisible }),
    markDisposed: () => update({ isDisposed: true }),
  };
}
