import { setTimeout } from "./ViroSpecsInteractionKit";
import type { ViroSpecsSceneSnapshot } from "./ViroSpecsProtocol";
import { ViroSpecsInteractionHost } from "./ViroSpecsInteractionHost";
import { ViroSpecsRuntimeHost } from "./ViroSpecsRuntimeHost";

/**
 * Canonical Lens-side Platform Lab scene.
 *
 * Keep IDs synchronized with SPECS_PLATFORM_LAB_PLAN in src/testing.ts.
 */
@component
export class ViroSpecsPlatformLab extends BaseScriptComponent {
  private unsubscribeInteraction: (() => void) | null = null;
  @input
  runtimeHostObject: SceneObject;

  @input
  interactionHostObject: SceneObject;

  @input
  modelSourceId: string = "platform-lab-model";

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => this.startLab());
    this.createEvent("OnDestroyEvent").bind(() => {
      this.unsubscribeInteraction?.();
      this.unsubscribeInteraction = null;
    });
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
          position: [0, 0, -0.04],
          scale: [3, 5, 1],
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
        {
          id: "platform-lab-button-label",
          parentId: "platform-lab-button",
          kind: "text",
          text: "Select",
          position: [0, 0, 0.02],
        },
        {
          id: "platform-lab-status",
          parentId: "platform-lab-root",
          kind: "text",
          text: "ready",
          position: [0, -0.28, 0.01],
        },
      ],
    };

    runtimeHost.applySceneSnapshot(scene);
    // Keep UIKit backing surfaces behind subsequent text/model children.
    runtimeHost.getNode("platform-lab-root")?.createComponent("Component.Canvas");
    const title = runtimeHost.getNode("platform-lab-title")?.getComponent("Component.Text") as Text;
    title.size = 130;
    const status = runtimeHost.getNode("platform-lab-status")?.getComponent("Component.Text") as Text;
    status.size = 90;
    const buttonLabel = runtimeHost.getNode("platform-lab-button-label")?.getComponent("Component.Text") as Text;
    buttonLabel.size = 90;
    // Prefab/UIKit OnStart initializes visuals and colliders before SIK wiring.
    setTimeout(() => {
      interactionHost.setInteractable("platform-lab-button", true);
      interactionHost.setInteractable("platform-lab-model", true);
      interactionHost.setManipulationEnabled("platform-lab-model", true);
    }, 0);

    const statusObject = runtimeHost.getNode("platform-lab-status");
    const statusText = statusObject?.getComponent(
      "Component.Text"
    ) as Text | null;

    this.unsubscribeInteraction = interactionHost.subscribe((event) => {
      if (!statusText) {
        return;
      }

      if (
        event.targetId === "platform-lab-button" &&
        event.phase === "select-end"
      ) {
        statusText.text = "button:selected";
      }

      if (
        event.targetId === "platform-lab-model" &&
        event.phase === "drag"
      ) {
        statusText.text = "model:drag";
      }
    });
  }
}
