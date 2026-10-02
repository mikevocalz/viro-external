import type { ViroViroSpecsSceneSnapshot } from "./ViroSpecsProtocol";
import { ViroSpecsInteractionHost } from "./ViroSpecsInteractionHost";
import { ViroSpecsRuntimeHost } from "./ViroSpecsRuntimeHost";

/**
 * Canonical Lens-side Platform Lab scene.
 *
 * Keep IDs synchronized with SPECS_PLATFORM_LAB_PLAN in src/testing.ts.
 */
@component
export class ViroSpecsPlatformLab extends BaseScriptComponent {
  @input
  runtimeHostObject: SceneObject;

  @input
  interactionHostObject: SceneObject;

  @input
  modelSourceId: string = "platform-lab-model";

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => this.startLab());
  }

  private startLab(): void {
    const runtimeHost = this.runtimeHostObject.getComponent(
      ViroSpecsRuntimeHost.getTypeName()
    ) as ViroSpecsRuntimeHost | null;

    const interactionHost = this.interactionHostObject.getComponent(
      ViroSpecsInteractionHost.getTypeName()
    ) as ViroSpecsInteractionHost | null;

    if (!runtimeHost || !interactionHost) {
      throw new Error(
        "Platform Lab requires both ViroSpecsRuntimeHost and ViroSpecsInteractionHost."
      );
    }

    const scene: ViroSpecsSceneSnapshot = {
      version: 1,
      nodes: [
        {
          id: "platform-lab-root",
          kind: "group",
          position: [0, 0, -1.5],
        },
        {
          id: "platform-lab-panel",
          parentId: "platform-lab-root",
          kind: "panel",
          position: [0, 0, 0],
        },
        {
          id: "platform-lab-title",
          parentId: "platform-lab-root",
          kind: "text",
          text: "Viro Specs Platform Lab",
          position: [0, 0.22, 0.01],
        },
        {
          id: "platform-lab-model",
          parentId: "platform-lab-root",
          kind: "model",
          source: this.modelSourceId,
          position: [-0.22, -0.04, 0],
          scale: [0.18, 0.18, 0.18],
        },
        {
          id: "platform-lab-button",
          parentId: "platform-lab-root",
          kind: "panel",
          position: [0.24, -0.14, 0.01],
        },
      ],
    };

    runtimeHost.applySceneSnapshot(scene);
    interactionHost.setInteractable("platform-lab-button", true);
    interactionHost.setInteractable("platform-lab-model", true);
    interactionHost.setManipulationEnabled("platform-lab-model", true);
  }
}
