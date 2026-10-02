import type { ViroSpecsNativeAnimationPlan } from "./ViroSpecsProtocol";
import { ViroSpecsAnimationRuntime } from "./ViroSpecsAnimationRuntime";
import { ViroSpecsRuntimeHost } from "./ViroSpecsRuntimeHost";

/**
 * Lens component facade for Viro animation playback.
 */
@component
export class ViroSpecsAnimationHost extends BaseScriptComponent {
  @input
  runtimeHostObject: SceneObject;

  private runtime: ViroSpecsAnimationRuntime | null = null;

  onAwake(): void {
    const host = this.runtimeHostObject.getComponent(
      ViroSpecsRuntimeHost.getTypeName()
    ) as ViroSpecsRuntimeHost | null;

    if (!host) {
      throw new Error(
        "ViroSpecsAnimationHost requires ViroSpecsRuntimeHost on runtimeHostObject."
      );
    }

    this.runtime = new ViroSpecsAnimationRuntime(host);
  }

  play(
    nodeId: string,
    plan: ViroSpecsNativeAnimationPlan,
    onComplete?: () => void
  ): void {
    this.requireRuntime().play(nodeId, plan, onComplete);
  }

  private requireRuntime(): ViroSpecsAnimationRuntime {
    if (!this.runtime) {
      throw new Error("Viro Specs animation runtime has not initialized.");
    }
    return this.runtime;
  }
}
