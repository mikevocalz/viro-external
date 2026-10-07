import { AgentInspectScript } from "AiPreviewAgentInspect.lspkg/AgentInspectScript";
import { AgentInteractScript } from "AiPreviewAgentInteract.lspkg/AgentInteractScript";

/**
 * Installs the upstream Specs editor-agent components used by Platform Lab
 * validation. Both packages intentionally remain inert on physical devices.
 */
@component
export class ViroSpecsAgentValidation extends BaseScriptComponent {
  onAwake(): void {
    if (!global.deviceInfoSystem.isEditor()) {
      return;
    }

    let inspect = this.getSceneObject().getComponent(
      AgentInspectScript.getTypeName()
    ) as AgentInspectScript | null;

    if (!inspect) {
      inspect = this.getSceneObject().createComponent(
        AgentInspectScript.getTypeName()
      ) as AgentInspectScript;
    }

    const interact = this.getSceneObject().getComponent(
      AgentInteractScript.getTypeName()
    ) as AgentInteractScript | null;

    if (!interact) {
      this.getSceneObject().createComponent(
        AgentInteractScript.getTypeName()
      );
    }
  }
}
