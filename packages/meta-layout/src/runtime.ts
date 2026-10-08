import type { XRCapabilityReport } from "@viro-external/xr-contract";

/**
 * What the app knows about the Meta Layout runtime right now.
 *
 * - `isSpatialAvailable`: `useSpatialScene().isSpatialAvailable` from
 *   `@metavr/layout-compat`. False off Horizon OS, below OS 207, and until
 *   the provider finishes initialising.
 * - `maxPromotedWindows`: extra windows the platform grants beside the main
 *   window. Defaults to {@linkcode META_HORIZON_RN_DEFAULT_SLOT_BUDGET}.
 * - `capabilities`: evidence for surface `requires` checks. Absent means no
 *   capability is known to be supported.
 */
export type MetaHorizonLayoutRuntime = {
  isSpatialAvailable: boolean;
  maxPromotedWindows?: number;
  capabilities?: XRCapabilityReport;
};

/** Minimum Meta VR OS SDK for spatial windows (`HorizonSpatialCapability.MIN_SUPPORTED_METAVR_OS_SDK_VERSION`). */
export const META_HORIZON_LAYOUT_MIN_OS = 207;

/**
 * Extra windows assumed beside the main window. Matches the legacy
 * child-window cap in `SpatialWindowCapacityTracker` (`LEGACY_CHILD_WINDOW_CAP = 2`).
 */
export const META_HORIZON_RN_DEFAULT_SLOT_BUDGET = 2;
