import type {
  NativeRiveSpatialAdapter,
  RiveSpatialPointer,
  RiveSpatialSurfaceCapabilities,
  RiveSpatialSurfaceConfig,
} from "@viro-external/xr-contract";

/**
 * Native seam required to put a Rive artboard in the Viro scene graph.
 * The implementation belongs to Viro/ViroCore + the native Rive runtime,
 * not to React Native's 2D view hierarchy.
 */
export type ViroCoreRiveNativeHost = {
  mount(config: RiveSpatialSurfaceConfig): {
    surfaceId: string;
    capabilities: RiveSpatialSurfaceCapabilities;
  };
  unmount(surfaceId: string): void;
  play(surfaceId: string): void;
  pause(surfaceId: string): void;
  reset(surfaceId: string): void;
  setStateMachineInput(
    surfaceId: string,
    name: string,
    value: boolean | number | string,
  ): void;
  dispatchPointer(surfaceId: string, event: RiveSpatialPointer): void;
  setSurfaceTranslation(
    surfaceId: string,
    translation: readonly [number, number, number],
  ): void;
};

export class ViroCoreRiveSpatialAdapter implements NativeRiveSpatialAdapter {
  private readonly handles = new WeakMap<object, string>();

  constructor(private readonly host: ViroCoreRiveNativeHost) {}

  mount(config: RiveSpatialSurfaceConfig) {
    const native = this.host.mount(config);
    let translation: readonly [number, number, number] = [0, 0, 0];
    let dragStart: readonly [number, number, number] | null = null;
    let dragging = false;

    const drag = {
      enabled: config.interactive === true && (config.drag?.enabled ?? true),
      activationDistance: config.drag?.activationDistance ?? 0.01,
      axis: config.drag?.axis ?? "free",
      followPointer: config.drag?.followPointer ?? true,
      maxDistance: config.drag?.maxDistance,
    };

    const distance = (a: readonly number[], b: readonly number[]) =>
      Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

    const project = (origin: readonly number[], point: readonly number[]) => {
      let x = point[0] - origin[0];
      let y = point[1] - origin[1];
      let z = point[2] - origin[2];

      if (drag.axis === "horizontal") {
        y = 0;
        z = 0;
      } else if (drag.axis === "vertical") {
        x = 0;
        z = 0;
      }

      if (drag.maxDistance !== undefined) {
        const length = Math.hypot(x, y, z);
        if (length > drag.maxDistance && length > 0) {
          const scale = drag.maxDistance / length;
          x *= scale;
          y *= scale;
          z *= scale;
        }
      }

      return [x, y, z] as const;
    };

    const update = (pointer: RiveSpatialPointer) => {
      if (!drag.enabled || !pointer.worldPosition || !dragStart) return;

      const delta = project(dragStart, pointer.worldPosition);
      if (!dragging && distance([0, 0, 0], delta) < drag.activationDistance) {
        return;
      }

      dragging = true;
      if (!drag.followPointer) return;

      translation = [
        translation[0] + delta[0],
        translation[1] + delta[1],
        translation[2] + delta[2],
      ];
      dragStart = pointer.worldPosition;
      this.host.setSurfaceTranslation(native.surfaceId, translation);
    };

    const handle = {
      play: () => this.host.play(native.surfaceId),
      pause: () => this.host.pause(native.surfaceId),
      reset: () => this.host.reset(native.surfaceId),
      setStateMachineInput: (name, value) =>
        this.host.setStateMachineInput(native.surfaceId, name, value),
      dispatchPointer: (event) => {
        this.host.dispatchPointer(native.surfaceId, event);
        if (!drag.enabled || !event.worldPosition) return;

        if (event.phase === "down") {
          dragStart = event.worldPosition;
          dragging = false;
        } else if (event.phase === "move") {
          update(event);
        } else if (
          event.phase === "up" ||
          event.phase === "cancel" ||
          event.phase === "exit"
        ) {
          dragStart = null;
          dragging = false;
        }
      },
      beginDrag: (pointer) => {
        if (!drag.enabled || !pointer.worldPosition) return;
        dragStart = pointer.worldPosition;
        dragging = false;
      },
      updateDrag: update,
      endDrag: (pointer) => {
        update(pointer);
        dragStart = null;
        dragging = false;
      },
      cancelDrag: () => {
        dragStart = null;
        dragging = false;
      },
      getCapabilities: () => native.capabilities,
    };

    this.handles.set(handle, native.surfaceId);
    return handle;
  }

  unmount(handle: ReturnType<ViroCoreRiveSpatialAdapter["mount"]>): void {
    const surfaceId = this.handles.get(handle);
    if (!surfaceId) return;
    this.host.unmount(surfaceId);
    this.handles.delete(handle);
  }
}
