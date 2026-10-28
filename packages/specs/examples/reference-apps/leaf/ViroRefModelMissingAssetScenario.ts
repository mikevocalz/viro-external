import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario";
import type { ScenarioConfig } from "Leaf.lspkg/Scenarios/scenario/ScenarioConfig";
import { DefaultLeafInteractor } from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor";
import { findInteractables } from "Leaf.lspkg/Interactors/InteractableUtils";
import { findSceneObjectByName } from "Leaf.lspkg/Utils/common/Utils";
import { expect } from "Leaf.lspkg/Utils/common/Expect";
import { Interactable } from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable";
import { VIRO_REF_NODE_IDS, type ViroRefModelState } from "./ViroRefAppsLogic";
import {
  diagnosticsDuring,
  experiencePanel,
  hold,
  interactableOf,
  panelText,
  pinch,
  settle,
  startExperience,
  startRefApp,
  stopExperience,
  textOf,
  waitFor,
  type RefApp,
} from "./ViroRefAppsLeafSupport";

const MISSING = "examples/visionos-sweep/assets/missing-reference-model.glb";

/**
 * viro_ref_model_missing_asset: the Model viewer with a GLB that is not
 * registered. The host reports VS5003 for mv-model and draws
 * "viro-placeholder:mv-model"; the experience layer opens one error panel,
 * "Model didn't load", whose only action is Retry; the controls still work;
 * and pinching Retry hands mv-model to the retry listener.
 */
@component
export class ViroRefModelMissingAssetScenario extends Scenario {
  async run(config?: ScenarioConfig): Promise<void> {
    const ids = VIRO_REF_NODE_IDS.model;
    const host = await startExperience();
    let app: RefApp<ViroRefModelState> | null = null;
    try {
      const retried: string[] = [];
      const retry = host.addOnRetryListener((nodeIds) => retried.push(...nodeIds));
      const diagnostics = await diagnosticsDuring(async () => {
        app = await startRefApp<ViroRefModelState>("model-viewer", (doc) => {
          const model = doc.nodes.find((n) => n.id === ids.model);
          expect(model).toBeTruthy();
          (model as { source?: unknown }).source = MISSING;
        });
        expect(await waitFor(() => (experiencePanel("error")?.enabled ?? false), 4000)).toBe(true);
      });
      const lines = diagnostics.map((d) => d.code + " " + (d.nodeId ?? ""));
      print("VIRO_REF model_missing diagnostics=" + JSON.stringify(lines));
      expect(lines.includes("VS5003 " + ids.model)).toBe(true);
      expect(findSceneObjectByName("viro-placeholder:" + ids.model)).toBeTruthy();
      expect(panelText("error", "title")).toBe("Model didn't load");
      expect(panelText("error", "detail").includes("VS5003 (" + ids.model + ")")).toBe(true);
      expect(panelText("error", "label")).toBe("Retry");
      await hold(config, "model_missing");

      // The rest of the scene works.
      const started = app as unknown as RefApp<ViroRefModelState>;
      const interactor = new DefaultLeafInteractor();
      const yaw = started.runtime.state.yawDegrees;
      await pinch(interactor, interactableOf(ids.turnLeft));
      expect(await waitFor(() => started.runtime.state.yawDegrees === (yaw + 315) % 360)).toBe(true);
      expect((textOf(ids.status) ?? "").startsWith("Turned")).toBe(true);

      const panel = experiencePanel("error");
      // The action button is the panel's "action" child. The backing also
      // carries an Interactable, with no listeners, that stops rays.
      const actionObject = (panel as SceneObject).children.find((child) => child.name === "action") ?? null;
      expect(actionObject).toBeTruthy();
      const action = findInteractables(
        (object) => (object.getComponent(Interactable.getTypeName()) as Interactable | null) ?? undefined,
        actionObject as SceneObject,
        true
      )[0];
      expect(action).toBeTruthy();
      await pinch(interactor, action as Interactable);
      await settle(300);
      retry.remove();
      print("VIRO_REF model_missing retried=" + JSON.stringify(retried));
      expect(retried.includes(ids.model)).toBe(true);
      print("VIRO_REF model_missing PASS");
    } finally {
      stopExperience();
      const started = app as RefApp<ViroRefModelState> | null;
      if (started) await started.stop();
    }
  }
}
