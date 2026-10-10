import { createStore } from "zustand/vanilla";
import type { Vec3 } from "@viro-external/core";
import type { WorldSlotPlacement } from "./world-slot";

type Placement = Pick<WorldSlotPlacement, "position" | "rotation">;
type AuthoredPose = { position?: Vec3; rotation?: Vec3 };
type PanelState = {
  releasedPlacement: Placement | null;
  lastReleasedPosition: Vec3 | null;
  authoredPose: AuthoredPose;
  pinned: boolean;
  closed: boolean;
  setReleasedPlacement: (placement: Placement | null, releasedPosition?: Vec3) => void;
  syncAuthoredPose: (pose: AuthoredPose & { initialPlacement?: Placement | null }) => void;
};

const copy = (value?: Vec3): Vec3 | undefined => value && [...value] as Vec3;
const same = (a?: Vec3 | null, b?: Vec3 | null): boolean =>
  a === b || (!!a && !!b && a.every((value, index) => value === b[index]));

// Each mounted panel owns a separate store; no native handles are serialized.
export function createPanelStore(options: AuthoredPose & { defaultPinned: boolean }) {
  return createStore<PanelState>()((set, get) => ({
    releasedPlacement: null,
    lastReleasedPosition: null,
    authoredPose: { position: copy(options.position), rotation: copy(options.rotation) },
    pinned: options.defaultPinned,
    closed: false,
    setReleasedPlacement: (placement, releasedPosition) => set({
      releasedPlacement: placement,
      lastReleasedPosition: placement ? copy(releasedPosition) ?? null : null,
    }),
    syncAuthoredPose: ({ position, rotation, initialPlacement }) => {
      const state = get();
      const positionChanged = !same(position, state.authoredPose.position);
      const rotationChanged = !same(rotation, state.authoredPose.rotation);
      if (!positionChanged && !rotationChanged) return;
      const mirrorsRelease = positionChanged && !rotationChanged &&
        same(position, state.lastReleasedPosition);
      const current = state.releasedPlacement ?? initialPlacement;
      set({
        authoredPose: { position: copy(position), rotation: copy(rotation) },
        // A callback mirrored into props acknowledges the release; it must not
        // discard the snapped result. Deliberate edits override the initial slot.
        releasedPlacement: mirrorsRelease ? state.releasedPlacement : {
          position: copy(positionChanged ? position : current?.position ?? position)
            ?? initialPlacement?.position ?? [0, 0, 0],
          rotation: copy(rotationChanged ? rotation : current?.rotation ?? rotation)
            ?? initialPlacement?.rotation ?? [0, 0, 0],
        },
        lastReleasedPosition: mirrorsRelease ? state.lastReleasedPosition : null,
      });
    },
  }));
}
