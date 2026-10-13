import type { ViroSpecsPortableInteraction } from "./ViroSpecsProtocol";
import { ViroSpecsInteractionRuntime } from "./ViroSpecsInteractionRuntime";
import { ViroSpecsRuntimeHost } from "./ViroSpecsRuntimeHost";

@component
export class ViroSpecsInteractionHost extends BaseScriptComponent {
  @input
  runtimeHostObject: SceneObject;

  private runtime: ViroSpecsInteractionRuntime | null = null;

  onAwake(): void {
    const host = this.runtimeHostObject.getComponent(
      ViroSpecsRuntimeHost.getTypeName()
    ) as ViroSpecsRuntimeHost | null;

    if (!host) {
      throw new Error(
        "ViroSpecsInteractionHost requires ViroSpecsRuntimeHost on runtimeHostObject."
      );
    }

    this.runtime = new ViroSpecsInteractionRuntime(host);

    this.createEvent("UpdateEvent").bind(() => {
      this.runtime?.update();
    });

    this.createEvent("OnDestroyEvent").bind(() => {
      this.runtime?.dispose();
    });
  }

  subscribe(
    listener: (event: ViroSpecsPortableInteraction) => void
  ): () => void {
    return this.requireRuntime().subscribe(listener);
  }

  /** Retire stale targets before the render host destroys or replaces nodes. */
  resetTargets(): void {
    this.requireRuntime().resetTargets();
  }

  setInteractable(nodeId: string, enabled: boolean): void {
    this.requireRuntime().setInteractable(nodeId, enabled);
  }

  setManipulationEnabled(nodeId: string, enabled: boolean): void {
    this.requireRuntime().setManipulationEnabled(nodeId, enabled);
  }

  private requireRuntime(): ViroSpecsInteractionRuntime {
    if (!this.runtime) {
      throw new Error("Viro Specs interaction runtime has not initialized.");
    }
    return this.runtime;
  }
}
