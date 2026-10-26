import { requireOptionalNativeModule } from "expo-modules-core";

import type { NativeSpatialPanelsModule } from "./NativeSpatialPanelsModule";

/** The `ViroSpatialPanels` module, or null where it is not linked (iOS, visionOS, web). */
export function requireSpatialPanelsModule(): NativeSpatialPanelsModule | null {
  return requireOptionalNativeModule<NativeSpatialPanelsModule>("ViroSpatialPanels");
}
