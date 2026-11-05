import type { DetailPanelHost } from "./DetailPanelHost";

/**
 * How the shell shows detail content.
 *
 * - `componentName`: the `AppRegistry` name the app registered
 *   {@linkcode SpatialShellDetailPanel} under. The native panel activity
 *   mounts it.
 * - `createPanelHost`: resolves the native panel host, for example
 *   `() => new PicoWindows().createPanelHost()` from `@expo-pico/core`. Omit
 *   it on builds that do not declare the panel activity (phones, iOS, web);
 *   detail then always opens as a screen.
 * - `showAsScreen`: pushes the detail as a screen. Used on phones, while the
 *   panel host resolves, and after a panel launch failed. The screen calls
 *   `leaveDetailScreen(id)` from {@linkcode useSpatialShellStore} on unmount.
 *
 * @see {@linkcode SpatialShellProps.detail}
 */
export interface SpatialShellDetailConfig {
  readonly componentName: string;
  readonly createPanelHost?: () => Promise<DetailPanelHost>;
  showAsScreen(id: string): void;
}
