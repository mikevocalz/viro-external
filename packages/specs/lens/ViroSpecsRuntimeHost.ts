import { compileSpecsRenderPlan, type SpecsRenderPlan } from "../src/render";
import type { SpecsSceneSnapshot } from "../src/index";
import { ViroSpecsAssetRegistry } from "./ViroSpecsAssetRegistry";
import { ViroSpecsSceneRuntime } from "./ViroSpecsSceneRuntime";

/**
 * Lens Studio component that owns the live Viro Specs scene executor.
 *
 * Other Lens scripts can hold a reference to this component and call
 * applyRenderPlan() whenever the shared Viro bridge delivers a new plan.
 */
@component
export class ViroSpecsRuntimeHost extends BaseScriptComponent {
  @input
  @allowUndefined
  root: SceneObject | null = null;

  @input
  assetRegistryObject: SceneObject;

  private runtime: ViroSpecsSceneRuntime | null = null;

  onAwake(): void {
    (globalThis as unknown as { __VIRO_SPECS_BUILD__?: boolean })
      .__VIRO_SPECS_BUILD__ = true;

    const registry = this.assetRegistryObject.getComponent(
      ViroSpecsAssetRegistry.getTypeName()
    ) as ViroSpecsAssetRegistry | null;

    if (!registry) {
      throw new Error(
        "ViroSpecsRuntimeHost requires ViroSpecsAssetRegistry on assetRegistryObject."
      );
    }

    this.runtime = new ViroSpecsSceneRuntime(
      this.root ?? this.getSceneObject(),
      registry
    );
  }

  applySceneSnapshot(scene: SpecsSceneSnapshot): void {
    this.applyRenderPlan(compileSpecsRenderPlan(scene.nodes));
  }

  applyRenderPlan(plan: SpecsRenderPlan): void {
    this.requireRuntime().apply(plan);
  }

  clear(): void {
    this.requireRuntime().clear();
  }

  getNode(id: string): SceneObject | null {
    return this.requireRuntime().getSceneObject(id);
  }

  private requireRuntime(): ViroSpecsSceneRuntime {
    if (!this.runtime) {
      throw new Error("Viro Specs runtime has not initialized.");
    }
    return this.runtime;
  }
}
