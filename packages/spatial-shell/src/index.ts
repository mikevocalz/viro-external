export type { SpatialShellTokens } from "./geometry/SpatialShellTokens";
export { DEFAULT_SPATIAL_SHELL_TOKENS } from "./geometry/SpatialShellTokens";
export type { SpatialWindowPlacement, SpatialWindowSpec } from "./geometry/SpatialWindowSpec";
export type { MainContentRect } from "./geometry/fitMainContent";
export { fitMainContent } from "./geometry/fitMainContent";
export type { SpatialShellGeometry } from "./geometry/createSpatialShellGeometry";
export {
  ATTACHED_WINDOW_GAP_DP,
  PANEL_WIDTH_RANGE_DP,
  RAIL_WINDOW_LABEL,
  RAIL_WINDOW_PRIORITY,
  createSpatialShellGeometry,
} from "./geometry/createSpatialShellGeometry";
export type { AttachedWindowFrame } from "./geometry/attachedWindowFrame";
export { attachedWindowFrame } from "./geometry/attachedWindowFrame";

export type { ShellNavigationInput, ShellNavigationPlacement } from "./layout/resolveShellNavigation";
export { RAIL_MIN_WIDTH_DP, resolveShellNavigation } from "./layout/resolveShellNavigation";
export type {
  DeviceConstants,
  ShellPlatform,
  ShellPlatformInput,
  ShellWindowBackend,
} from "./layout/resolveShellPlatform";
export { isHeadsetDevice, resolveShellPlatform } from "./layout/resolveShellPlatform";

export type { DetailPanelHost } from "./detail/DetailPanelHost";
export type { DetailPanelCommandInput, DetailPanelEvent, DetailPanelStatus } from "./detail/detailPanelRules";
export { detailPanelCommand, detailPanelStatusAfter } from "./detail/detailPanelRules";
export type { SpatialShellDetailConfig } from "./detail/SpatialShellDetailConfig";

export type { SpatialShellTheme } from "./theme/SpatialShellTheme";

export type { SpatialShellState } from "./stores/shellStore";
export { useSpatialShellStore } from "./stores/shellStore";
export type {
  HostedSpatialWindow,
  SpatialWindowHostState,
  StripPlacementState,
} from "./stores/spatialWindowHostStore";
export { useSpatialWindowHostStore, useStripPlacementStore } from "./stores/spatialWindowHostStore";
export type { MainContentFrameState } from "./stores/mainContentFrameStore";
export { useMainContentFrameStore } from "./stores/mainContentFrameStore";

export type { MetaLayoutModules, MetaWindows } from "./meta/createMetaWindows";
export { UNLINKED_META_WINDOWS, createMetaWindows } from "./meta/createMetaWindows";

export type { SpatialShellRuntime, SpatialShellRuntimeInput } from "./runtime/createSpatialShellRuntime";
export { createSpatialShellRuntime } from "./runtime/createSpatialShellRuntime";

export type { ShellDestination } from "./components/ShellDestination";
export type { SpatialShellProps } from "./components/SpatialShell";
export { SpatialShell } from "./components/SpatialShell";
export { NavRail } from "./components/NavRail";
export { TabBar } from "./components/TabBar";
export { MainContentFrame } from "./components/MainContentFrame";
export { useHostedSpatialWindow } from "./components/useHostedSpatialWindow";
export { useOpenDetail } from "./components/useOpenDetail";
export type { DetailSurfaceProps } from "./components/DetailSurface";
export { DetailSurface } from "./components/DetailSurface";
export type { SpatialShellDetailPanelProps } from "./components/SpatialShellDetailPanel";
export { SpatialShellDetailPanel } from "./components/SpatialShellDetailPanel";
