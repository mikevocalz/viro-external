export {
  SpatialPanel,
  type SpatialPanelProps,
  type SpatialPanelShape,
  type SpatialPanelVariant,
} from "./SpatialPanel";

export {
  PanelHeader,
  type PanelHeaderAction,
  type PanelHeaderProps,
} from "./PanelHeader";

export {
  PanelButton,
  type PanelButtonProps,
} from "./PanelButton";

export {
  SpatialHitTarget,
  type SpatialHitTargetProps,
} from "./SpatialHitTarget";

export {
  SpatialMediaSurface,
  type SpatialMediaPresentation,
  type SpatialMediaSurfaceProps,
} from "./SpatialMediaSurface";

export {
  SpatialScrollView,
  type SpatialScrollViewProps,
} from "./SpatialScrollView";

export {
  PanelImage,
  PanelText,
  type PanelImageProps,
  type PanelTextProps,
} from "./PanelContent";

export {
  SpatialVideoPlayerPanel,
  VideoPlayerPanel,
  type SpatialVideoPlayerPanelProps,
  type VideoPlayerPanelProps,
} from "./VideoPlayerPanel";

export {
  buildCurvedPanelGeometry,
  buildRoundedPanelGeometry,
  type PanelGeometry,
} from "./geometry";

export {
  MuxSpatialPlayerPanel,
  type MuxSpatialPlayerPanelProps,
} from "./MuxSpatialPlayerPanel";

export {
  SpatialWorkspaceFrame,
  SpatialWorkspaceSlotNode,
  worldSlot,
  nearestWorldSlot,
  type SpatialWorkspaceOrigin,
  type NearestWorldSlot,
  type SpatialWorkspaceSlot,
  type SpatialWorkspaceSlotNodeProps,
  type WorldSlotOptions,
  type WorldSlotPlacement,
} from "./SpatialWorkspace";

export {
  createRiveSpatialSurface,
  disposeRiveSpatialSurface,
} from "./RiveSpatialSurface";

export {
  ViroCoreRiveSpatialAdapter,
  type ViroCoreRiveNativeHost,
} from "./RiveNativeHost";

export * from "./WearableUIKit";

export { QuickDrawSpatialSurface, type QuickDrawSpatialSurfaceProps } from "./QuickDrawSpatialSurface";

export { MusePenInput } from "./MusePenInput";
export type { MusePenInputProps } from "@viro-external/xr-contract";

export { QuickdrawSpatialPanel } from "./QuickdrawSpatialPanel";
export type { QuickdrawSpatialPanelProps, QuickdrawSpatialPointer } from "./QuickdrawSpatialPanel.types";

export { MetaWorkspaceHost, type MetaWorkspaceHostProps } from "./MetaWorkspaceHost";

export { createHeadlessBoard } from "./quickdraw-headless/createHeadlessBoard";
export { getInkOutline } from "./quickdraw-headless/ink-outline";
export { laserOpacity } from "./quickdraw-headless/laser-layer";
export type { HeadlessBoard, BoardListenerSubscription } from "./quickdraw-headless/HeadlessBoard";
export type { HeadlessBoardOptions, MeasureTextWidth } from "./quickdraw-headless/HeadlessBoardOptions";
export type { BoardPointerSample, BoardPointerSource } from "./quickdraw-headless/BoardPointerSample";
export type { BoardEditorState, BoardTextEdit } from "./quickdraw-headless/BoardEditorState";
export type {
  BoardBoxSelection,
  BoardEraserTrail,
  BoardLaserStroke,
  BoardLineSelection,
  BoardOverlay,
  BoardPoint,
  BoardSelectionOverlay,
} from "./quickdraw-headless/BoardOverlay";

export { createBoardInputRouter } from "./quickdraw-input/createBoardInputRouter";
export { createQuickDrawBoardSession } from "./quickdraw-input/createQuickDrawBoardSession";
export {
  createAdapterHandleSink,
  createHeadlessBoardSink,
  toLegacyQuickdrawSpatialPointer,
} from "./quickdraw-input/pointer-sinks";
export {
  assertFlatBoard,
  boardDragPlane,
  boardToPage,
  composeNodeWorld,
  IDENTITY_MAT4,
  invertAffine,
  mapWorldPointToBoard,
  multiplyMat4,
  paperRectInQuad,
  paperUvToBoard,
  planeHitFromDrag,
  transformPoint,
} from "./quickdraw-input/board-geometry";
export type { BoardHit, BoardSurfaceGeometry, Mat4, NodePose } from "./quickdraw-input/board-geometry";
export { isInsideRoundedPanel, panelCornerRadiiPx, panelCoverage } from "./quickdraw-input/panel-coverage";
export type { PanelCornerRadiiPx } from "./quickdraw-input/panel-coverage";
export type {
  BoardInputCancelReason,
  BoardInputRouter,
  BoardInputRouterOptions,
  BoardInputSubscription,
} from "./quickdraw-input/BoardInputRouter";
export type { QuickDrawBoardSession, QuickDrawBoardSessionOptions } from "./quickdraw-input/QuickDrawBoardSession";
