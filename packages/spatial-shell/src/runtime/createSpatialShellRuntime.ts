import type { SpatialWindowPlacement } from "../geometry/SpatialWindowSpec";
import type { ShellPlatform, ShellWindowBackend } from "../layout/resolveShellPlatform";
import { UNLINKED_META_WINDOWS, type MetaWindows } from "../meta/createMetaWindows";
import { useStripPlacementStore } from "../stores/spatialWindowHostStore";

/**
 * The build's shell backend, chosen once at module load so no component
 * switches hook implementations between renders. Pass it to
 * {@linkcode SpatialShell}.
 *
 * @see {@linkcode createSpatialShellRuntime}
 */
export interface SpatialShellRuntime {
  readonly platform: ShellPlatform;
  /**
   * The backend that actually opens the rail window. `meta-horizon-layout`
   * only when the Layout SDK linked; a `quest` build whose SDK failed to load
   * falls back to `none` and draws the rail inside the main panel.
   */
  readonly windowBackend: ShellWindowBackend;
  readonly metaWindows: MetaWindows;
  usePlacement(label: string): SpatialWindowPlacement;
  useSpatialAvailable(): boolean;
}

/**
 * Input to {@linkcode createSpatialShellRuntime}. Omit `metaWindows` in apps
 * without the Meta Layout SDK; the rail then draws inside the main panel on
 * Quest.
 */
export interface SpatialShellRuntimeInput {
  readonly platform: ShellPlatform;
  readonly metaWindows?: MetaWindows;
}

const usePendingStripPlacement = (label: string): SpatialWindowPlacement =>
  useStripPlacementStore((state) => state.placements[label] ?? "pending");
const useAlwaysAvailable = (): boolean => true;

/**
 * Picks the backend:
 *
 * - `meta-horizon-layout` (`quest` flavor with the SDK linked): the rail opens
 *   as its own Layout SDK window.
 * - `pico-spatial` (`pico` flavor): the rail draws in a transparent strip of
 *   the main window at the Quest window's size (MoyoLearn's
 *   `panelWindows.tsx`).
 * - `none`: no rail window.
 *
 * @example
 * ```ts
 * export const shellRuntime = createSpatialShellRuntime({
 *   platform: resolveShellPlatform({ isHorizonBuild, isPicoBuild: isPicoBuild(), os: Platform.OS,
 *     deviceConstants: Platform.constants }),
 *   metaWindows: createMetaWindows(isHorizonBuild, loadMetaLayout),
 * });
 * ```
 */
export function createSpatialShellRuntime(input: SpatialShellRuntimeInput): SpatialShellRuntime {
  const metaWindows = input.metaWindows ?? UNLINKED_META_WINDOWS;
  if (metaWindows.isLinked) {
    return {
      platform: input.platform,
      windowBackend: "meta-horizon-layout",
      metaWindows,
      usePlacement: metaWindows.usePlacement,
      useSpatialAvailable: metaWindows.useSpatialAvailable,
    };
  }
  if (input.platform.windowBackend === "pico-spatial") {
    return {
      platform: input.platform,
      windowBackend: "pico-spatial",
      metaWindows,
      usePlacement: usePendingStripPlacement,
      useSpatialAvailable: useAlwaysAvailable,
    };
  }
  return {
    platform: input.platform,
    windowBackend: "none",
    metaWindows,
    usePlacement: metaWindows.usePlacement,
    useSpatialAvailable: metaWindows.useSpatialAvailable,
  };
}
