// What a tool gesture may touch. One context per board; tools never hold
// state outside their own session object.
import type { Bounds, Camera, GeoId, ShapeRecord, Store, Styles, ToolId } from "@quickdrawjs/core";
import type { BoardPointerSample } from "./BoardPointerSample";
import type { Point } from "./geometry";
import type { HistoryGroup } from "./history-group";
import type { LaserLayer } from "./laser-layer";
import type { ShapeGeometry } from "./shape-geometry";

export type BoardContext = {
  store: Store;
  history: HistoryGroup;
  geometry: ShapeGeometry;
  laser: LaserLayer;
  camera(): Camera;
  setCamera(camera: Camera): void;
  styles(): Styles;
  geoKind(): GeoId;
  tool(): ToolId;
  setTool(tool: ToolId): void;
  selection(): readonly string[];
  setSelection(ids: readonly string[]): void;
  selectionBounds(): Bounds | undefined;
  shapesSorted(): ShapeRecord[];
  hitTest(page: Point): ShapeRecord | undefined;
  startTextEdit(id: string): void;
  overlayChanged(): void;
  toPage(view: Point): Point;
  toView(page: Point): Point;
};

/** Overlay pieces a live session contributes. */
export type OverlayContribution = {
  marquees: Bounds[];
  eraserTrails: Array<{ pointerId: number; points: number[] }>;
  pendingEraseIds: Set<string>;
};

/** One captured pointer's gesture. */
export type ToolSession = {
  /** True while the session holds the Store's history batch open. */
  readonly holdsHistory: boolean;
  move(sample: BoardPointerSample, view: Point, page: Point): void;
  /** Pointer lifted: complete the gesture. */
  end(sample: BoardPointerSample, view: Point, page: Point): void;
  /** Gesture abandoned: discard what QuickDraw's abort discards. */
  cancel(): void;
  /** Gesture dropped without writing (undo mid-gesture, record removed remotely). */
  drop(): void;
  contribute?(acc: OverlayContribution): void;
};

export type BeginTool = (
  ctx: BoardContext,
  sample: BoardPointerSample,
  view: Point,
  page: Point,
  release: () => void,
) => ToolSession;
