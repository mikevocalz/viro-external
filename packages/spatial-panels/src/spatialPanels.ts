import { ViroMaterials } from "@reactvision/react-viro";

import { createSpatialPanelsHost } from "./createSpatialPanelsHost";
import { requireSpatialPanelsModule } from "./native/requireSpatialPanelsModule";
import type { SpatialPanelsHost } from "./SpatialPanelsHost";

/** The app's compositor panel host. */
export const spatialPanels: SpatialPanelsHost = createSpatialPanelsHost(requireSpatialPanelsModule(), ViroMaterials);
