import type {
  ViroSpecsCapabilityReport,
  ViroSpecsPortableInteraction,
  ViroSpecsSceneSnapshot,
} from "./ViroSpecsProtocol";
import { createSpecsLensCapabilityReport } from "./ViroSpecsCapabilities";
import { ViroSpecsInteractionHost } from "./ViroSpecsInteractionHost";
import { ViroSpecsRuntimeHost } from "./ViroSpecsRuntimeHost";

/**
 * Concrete Lens Studio transport for SpecsAdapter.
 *
 * This closes the original adapter loop:
 * PortableXRNode[] -> SpecsAdapter -> ViroSpecsSceneSnapshot ->
 * ViroSpecsLensTransport -> live Lens runtime.
 */
export class ViroSpecsLensTransport {
  constructor(
    private readonly sceneHost: ViroSpecsRuntimeHost,
    private readonly interactionHost: ViroSpecsInteractionHost
  ) {}

  getCapabilities(): ViroSpecsCapabilityReport {
    return createSpecsLensCapabilityReport();
  }

  applyScene(scene: ViroSpecsSceneSnapshot): void {
    this.sceneHost.applySceneSnapshot(scene);
  }

  onInteraction(
    listener: (event: ViroSpecsPortableInteraction) => void
  ): () => void {
    return this.interactionHost.subscribe(listener);
  }

  dispose(): void {
    this.sceneHost.clear();
  }
}
