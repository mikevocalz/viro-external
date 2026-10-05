import type {
  NativeRiveSpatialAdapter,
  RiveDragAxis,
  RiveSpatialPointer,
  RiveSpatialSurfaceCapabilities,
  RiveSpatialSurfaceConfig,
  RiveSpatialSurfaceHandle,
} from "@viro-external/xr-contract";

type Vec3 = readonly [number, number, number];

const ZERO: Vec3 = [0, 0, 0];

function subtract(a: Vec3, b: Vec3): Vec3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function length(v: Vec3): number {
  return Math.hypot(v[0], v[1], v[2]);
}

function axisFilter(delta: Vec3, axis: RiveDragAxis): Vec3 {
  if (axis === "horizontal") return [delta[0], 0, 0];
  if (axis === "vertical") return [0, delta[1], 0];
  return delta;
}

function clampLength(delta: Vec3, max: number | undefined): Vec3 {
  if (max === undefined) return delta;
  const len = length(delta);
  if (len <= max || len === 0) return delta;
  const scale = max / len;
  return [delta[0] * scale, delta[1] * scale, delta[2] * scale];
}

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
  private readonly host: ViroCoreRiveNativeHost;

  constructor(host: ViroCoreRiveNativeHost) {
    this.host = host;
  }

  mount(config: RiveSpatialSurfaceConfig): RiveSpatialSurfaceHandle {
    const native = this.host.mount(config);
    let translation: Vec3 = ZERO;
    // Absolute-drag anchors: the pointer world position and the surface
    // translation captured when the gesture began. Total displacement is
    // recomputed per move so clamping and axis filtering cannot drift.
    let gestureOrigin: Vec3 | null = null;
    let anchorTranslation: Vec3 = ZERO;
    let dragging = false;

    const drag = {
      enabled: config.interactive === true && (config.drag?.enabled ?? true),
      activationDistance: config.drag?.activationDistance ?? 0.01,
      axis: config.drag?.axis ?? ("free" as const),
      followPointer: config.drag?.followPointer ?? true,
      maxDistance: config.drag?.maxDistance,
    };

    const update = (pointer: RiveSpatialPointer) => {
      if (!drag.enabled || !pointer.worldPosition || !gestureOrigin) return;

      const displacement = clampLength(
        axisFilter(subtract(pointer.worldPosition, gestureOrigin), drag.axis),
        drag.maxDistance,
      );
      if (!dragging && length(displacement) < drag.activationDistance) {
        return;
      }

      dragging = true;
      if (!drag.followPointer) return;

      translation = [
        anchorTranslation[0] + displacement[0],
        anchorTranslation[1] + displacement[1],
        anchorTranslation[2] + displacement[2],
      ];
      this.host.setSurfaceTranslation(native.surfaceId, translation);
    };

    const begin = (pointer: RiveSpatialPointer) => {
      if (!drag.enabled || !pointer.worldPosition) return;
      gestureOrigin = pointer.worldPosition;
      anchorTranslation = translation;
      dragging = false;
    };

    const release = () => {
      gestureOrigin = null;
      dragging = false;
    };

    const handle: RiveSpatialSurfaceHandle = {
      play: () => this.host.play(native.surfaceId),
      pause: () => this.host.pause(native.surfaceId),
      reset: () => this.host.reset(native.surfaceId),
      setStateMachineInput: (name, value) =>
        this.host.setStateMachineInput(native.surfaceId, name, value),
      dispatchPointer: (event) => {
        this.host.dispatchPointer(native.surfaceId, event);
        if (!drag.enabled) return;

        if (
          event.phase === "up" ||
          event.phase === "cancel" ||
          event.phase === "exit"
        ) {
          release();
        } else if (event.phase === "down") {
          begin(event);
        } else if (event.phase === "move") {
          update(event);
        }
      },
      beginDrag: begin,
      updateDrag: update,
      endDrag: (pointer) => {
        update(pointer);
        release();
      },
      cancelDrag: release,
      getCapabilities: () => native.capabilities,
    };

    this.handles.set(handle, native.surfaceId);
    return handle;
  }

  unmount(handle: RiveSpatialSurfaceHandle): void {
    const surfaceId = this.handles.get(handle);
    if (!surfaceId) return;
    this.host.unmount(surfaceId);
    this.handles.delete(handle);
  }
}
