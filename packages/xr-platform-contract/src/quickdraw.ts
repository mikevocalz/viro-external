/** Native QuickDraw spatial rendering contract. */
export type QuickDrawPointerSource =
  | "pointer" | "gaze" | "pinch" | "touch" | "controller" | "hand" | "dpad" | "keyboard";

export type QuickDrawPointerPhase = "enter" | "move" | "down" | "up" | "cancel" | "exit";

export type QuickDrawSpatialPointer = {
  phase: QuickDrawPointerPhase;
  source: QuickDrawPointerSource;
  /** Normalized board coordinates, 0..1 from top-left. */
  uv: readonly [number, number];
  timestamp: number;
  pressure?: number;
};

export type QuickDrawSpatialDrag = {
  enabled: boolean;
  activationDistance?: number;
  maxDistance?: number;
};

export type QuickDrawSpatialSurfaceConfig = {
  width: number;
  height: number;
  pageWidth: number;
  pageHeight: number;
  interactive?: boolean;
  drag?: QuickDrawSpatialDrag;
};

/**
 * Native adapter boundary for the QuickDraw runtime.
 *
 * The production implementation is ESIKU-backed: ESIKU owns the external
 * render target and spatial input translation while QuickDraw owns the
 * document/editor semantics.
 */
export type NativeQuickDrawSpatialAdapter = {
  /** This surface is specifically backed by the ESIKU external-rendering path. */
  readonly renderer: "esiku";
  mount(config: QuickDrawSpatialSurfaceConfig): QuickDrawSpatialSurfaceHandle;
  unmount(handle: QuickDrawSpatialSurfaceHandle): void;
};

export type QuickDrawSpatialSurfaceHandle = {
  /** Viro material name bound to the live external render target. */
  materialName: string;
  dispatchPointer(event: QuickDrawSpatialPointer): void;
  setTool(tool: string): void;
  setStyle(key: string, value: string | number | boolean): void;
  undo(): void;
  redo(): void;
  clear(): void;
  getSnapshot(): unknown;
  loadSnapshot(snapshot: unknown): void;
  exportPng(): Promise<string | null>;
  dispose(): void;
};
