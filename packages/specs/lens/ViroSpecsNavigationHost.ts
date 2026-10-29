import { NavigationDataComponent } from "./ViroSpecsNavigationKit";
import type {
  ViroSpecsNavigationPlan,
  ViroSpecsVolumetricLinePlan,
} from "./ViroSpecsProtocol";
import { ViroSpecsAssetRegistry } from "./ViroSpecsAssetRegistry";
import { ViroSpecsNavigationRuntime } from "./ViroSpecsNavigationRuntime";

@component
export class ViroSpecsNavigationHost extends BaseScriptComponent {
  @input
  navigationObject: SceneObject;

  @input
  assetRegistryObject: SceneObject;

  @input
  defaultLineMaterial: Material;

  @input
  routeIcon: Texture;

  @input
  @allowUndefined
  generatedContentRoot: SceneObject | null = null;

  private runtime: ViroSpecsNavigationRuntime | null = null;

  onAwake(): void {
    const navigation = this.navigationObject.getComponent(
      NavigationDataComponent.getTypeName()
    ) as NavigationDataComponent | null;

    const assets = this.assetRegistryObject.getComponent(
      ViroSpecsAssetRegistry.getTypeName()
    ) as ViroSpecsAssetRegistry | null;

    if (!navigation) {
      throw new Error(
        "ViroSpecsNavigationHost requires NavigationDataComponent."
      );
    }

    if (!assets) {
      throw new Error(
        "ViroSpecsNavigationHost requires ViroSpecsAssetRegistry."
      );
    }

    this.runtime = new ViroSpecsNavigationRuntime(
      this.generatedContentRoot ?? this.getSceneObject(),
      navigation,
      assets,
      this.defaultLineMaterial,
      this.routeIcon
    );
  }

  presentRoute(plan: ViroSpecsNavigationPlan): boolean {
    return this.requireRuntime().presentRoute(plan);
  }

  presentPolyline(plan: ViroSpecsVolumetricLinePlan): void {
    this.requireRuntime().presentPolyline(plan);
  }

  clearRoute(): void {
    this.requireRuntime().clearRoute();
  }

  private requireRuntime(): ViroSpecsNavigationRuntime {
    if (!this.runtime) {
      throw new Error("Viro Specs navigation runtime has not initialized.");
    }
    return this.runtime;
  }
}
