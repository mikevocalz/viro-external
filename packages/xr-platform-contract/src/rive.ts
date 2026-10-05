/** Native Rive spatial rendering contract. */

export type RiveSource =
  | { kind: "url"; uri: string }
  | { kind: "asset"; asset: number | string };

export type RiveFit = "contain" | "cover" | "fill" | "fitWidth" | "fitHeight";
export type RiveSpatialDepthMode = "surface" | "extruded" | "occluding" | "embedded";

export type RiveDragAxis = "free" | "horizontal" | "vertical";

export type RiveDragConfig = {
  enabled: boolean;
  axis?: RiveDragAxis;
  /** Maximum displacement from the panel anchor, in Viro world units. */
  maxDistance?: number;
  /** Minimum movement before drag starts, in Viro world units. */
  activationDistance?: number;
  /** If true, the panel follows the active ESIK pointer while pressed. */
  followPointer?: boolean;
};
export type RiveInputKind = "pointer" | "gaze" | "pinch" | "touch" | "controller" | "dpad" | "voice";
export type RivePointerPhase = "enter" | "move" | "down" | "up" | "cancel" | "exit";

export type RiveSpatialPointer = {
  phase: RivePointerPhase;
  source: RiveInputKind;
  /** Normalized artboard coordinates, 0..1. */
  uv: readonly [number, number];
  worldPosition?: readonly [number, number, number];
  timestamp: number;
};

export type RiveSpatialSurfaceConfig = {
  source: RiveSource;
  artboard?: string;
  stateMachine?: string;
  fit?: RiveFit;
  depthMode?: RiveSpatialDepthMode;
  width: number;
  height: number;
  depth?: number;
  interactive?: boolean;
  /** Rive panels are draggable by default when interactive. */
  drag?: RiveDragConfig;
};

export type RiveSpatialSurfaceCapabilities = {
  nativeRenderer: true;
  stateMachines: boolean;
  dataBinding: boolean;
  pointerInput: boolean;
  externalRenderTarget: boolean;
  depthComposition: boolean;
};

export const DEFAULT_RIVE_DRAG: RiveDragConfig = {
  enabled: true,
  axis: "free",
  activationDistance: 0.01,
  followPointer: true,
};

export type RiveSpatialSurfaceHandle = {
  play(): void;
  pause(): void;
  reset(): void;
  setStateMachineInput(name: string, value: boolean | number | string): void;
  dispatchPointer(event: RiveSpatialPointer): void;
  beginDrag(pointer: RiveSpatialPointer): void;
  updateDrag(pointer: RiveSpatialPointer): void;
  endDrag(pointer: RiveSpatialPointer): void;
  cancelDrag(): void;
  getCapabilities(): RiveSpatialSurfaceCapabilities;
};

/** Native adapter between Viro scene/input and the Rive runtime. */
export type NativeRiveSpatialAdapter = {
  mount(config: RiveSpatialSurfaceConfig): RiveSpatialSurfaceHandle;
  unmount(handle: RiveSpatialSurfaceHandle): void;
};
