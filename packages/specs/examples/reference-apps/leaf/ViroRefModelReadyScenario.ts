import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario";
import type { ScenarioConfig } from "Leaf.lspkg/Scenarios/scenario/ScenarioConfig";
import { findSceneObjectByName } from "Leaf.lspkg/Utils/common/Utils";
import { expect } from "Leaf.lspkg/Utils/common/Expect";
import { VIRO_REF_MODEL_INITIAL, VIRO_REF_NODE_IDS, viroRefModelStatus, type ViroRefModelState } from "./ViroRefAppsLogic";
import {
  controllerHost,
  diagnosticsDuring,
  findings,
  hold,
  interactableOf,
  startRefApp,
  textOf,
  waitFor,
  type RefApp,
} from "./ViroRefAppsLeafSupport";

/**
 * viro_ref_model_ready: the Model viewer loads shiba.glb (registered as
 * examples/visionos-sweep/assets/shiba.glb) and reaches "ready": the model
 * instance "viro-model:mv-model" exists, no placeholder was drawn, the status
 * line reads the initial state, and the model and the five controls are
 * interactable. VS5025 (the host does not draw the ModelViewer load ring
 * yet) is expected and left out of the findings.
 */
@component
export class ViroRefModelReadyScenario extends Scenario {
  async run(config?: ScenarioConfig): Promise<void> {
    const ids = VIRO_REF_NODE_IDS.model;
    let app: RefApp<ViroRefModelState> | null = null;
    try {
      const diagnostics = await diagnosticsDuring(async () => {
        app = await startRefApp<ViroRefModelState>("model-viewer");
        expect(await waitFor(() => controllerHost().lifecycle === "ready", 5000)).toBe(true);
      });
      print("VIRO_REF model_ready findings=" + JSON.stringify(findings(diagnostics)));
      expect(findings(diagnostics).length).toBe(0);
      expect(findSceneObjectByName("viro-model:" + ids.model)).toBeTruthy();
      expect(findSceneObjectByName("viro-placeholder:" + ids.model)).toBeFalsy();
      expect(textOf(ids.status)).toBe(viroRefModelStatus(VIRO_REF_MODEL_INITIAL));
      for (const id of [ids.model, ids.turnLeft, ids.turnRight, ids.smaller, ids.larger, ids.reset]) expect(interactableOf(id)).toBeTruthy();
      await hold(config, "model_ready");
      print("VIRO_REF model_ready PASS");
    } finally {
      const started = app as RefApp<ViroRefModelState> | null;
      if (started) await started.stop();
    }
  }
}
