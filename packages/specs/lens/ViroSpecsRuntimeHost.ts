import {
  compileLensRenderPlan,
  type ViroSpecsRenderPlan,
  type ViroSpecsSceneSnapshot,
  type ViroSpecsSceneNode,
} from "./ViroSpecsProtocol";
import { ViroSpecsAssetRegistry } from "./ViroSpecsAssetRegistry";
import { ViroSpecsSceneRuntime } from "./ViroSpecsSceneRuntime";
import { formatViroSpecsHostDiagnostic } from "./ViroSpecsHostDiagnostics";
import { readViroSpecsSceneInput } from "./ViroSpecsSceneDocument";

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
  private registry: ViroSpecsAssetRegistry | null = null;

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

    this.registry = registry;
    this.runtime = new ViroSpecsSceneRuntime(
      this.root ?? this.getSceneObject(),
      registry
    );
  }

  /**
   * Applies a protocol 1 snapshot. Validates version, kinds, fields, IDs and
   * parents first (the checks ViroSpecsSceneController uses), so a bad raw
   * payload throws before any SceneObject changes. For transactional
   * replacement and protocol 2, use ViroSpecsSceneControllerHost.
   */
  applySceneSnapshot(scene: ViroSpecsSceneSnapshot): void {
    const read = readViroSpecsSceneInput(scene, 0);
    if (read.ok === false || read.scene.protocol !== 1) {
      const reasons = read.ok === false ? read.diagnostics.map(formatViroSpecsHostDiagnostic) : ["expected scene protocol 1"];
      throw new Error("Invalid Specs scene snapshot: " + reasons.join("; "));
    }
    this.applyRenderPlan(compileLensRenderPlan(scene));
  }

  applyRenderPlan(plan: ViroSpecsRenderPlan): void {
    this.requireRuntime().apply(plan);
  }

  /**
   * Check assets and required Lens materials before retiring the active page.
   * This complements (rather than replaces) source/permission validation in
   * the portable compiler and content access layer.
   */
  validateSources(nodes: readonly ViroSpecsSceneNode[]): void {
    if (!this.registry) throw new Error("Specs asset registry is not ready.");
    for (const node of nodes) {
      if (node.kind === "panel" && !this.registry.defaultPanelPrefab) {
        throw new Error("Specs UI Kit panel prefab is not registered: " + node.id);
      }
      if (node.kind === "image") {
        if (node.source !== undefined && !this.registry.resolveImage(node.source)) {
          throw new Error("Specs image asset is not registered: " + node.source);
        }
        if (node.source !== undefined && !this.registry.defaultImageMaterial) {
          throw new Error("Specs image material is not registered: " + node.id);
        }
      }
      if (node.kind === "model" && (!node.source || !this.registry.resolveModel(node.source))) {
        throw new Error("Specs model asset is not registered: " + node.id);
      }
    }
  }

  clear(): void {
    this.requireRuntime().clear();
  }

  refreshScrollColliders(): void {
    this.requireRuntime().refreshScrollColliders();
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
