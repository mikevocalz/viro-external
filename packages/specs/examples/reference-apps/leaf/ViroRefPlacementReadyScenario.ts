import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario";
import type { ScenarioConfig } from "Leaf.lspkg/Scenarios/scenario/ScenarioConfig";
import { expect } from "Leaf.lspkg/Utils/common/Expect";
import { VIRO_REF_NODE_IDS, VIRO_REF_PLACEMENT_PROMPTS, type ViroRefPlacementState } from "./ViroRefAppsLogic";
import {
  controllerHost,
  diagnosticsDuring,
  findings,
  hold,
  interactableOf,
  nodeObject,
  startRefApp,
  textOf,
  waitFor,
  type RefApp,
} from "./ViroRefAppsLeafSupport";

/**
 * viro_ref_placement_ready: World-placed info commits and reaches "ready"
 * with no host findings. The info card is committed but hidden, the control
 * panel shows the idle prompt and "Place card", and Cancel is hidden until a
 * placement starts.
 */
@component
export class ViroRefPlacementReadyScenario extends Scenario {
  async run(config?: ScenarioConfig): Promise<void> {
    const ids = VIRO_REF_NODE_IDS.placement;
    let app: RefApp<ViroRefPlacementState> | null = null;
    try {
      const diagnostics = await diagnosticsDuring(async () => {
        app = await startRefApp<ViroRefPlacementState>("world-placed-info");
        expect(await waitFor(() => controllerHost().lifecycle === "ready")).toBe(true);
      });
      print("VIRO_REF placement_ready findings=" + JSON.stringify(findings(diagnostics)));
      expect(findings(diagnostics).length).toBe(0);
      expect(nodeObject(ids.card)).toBeTruthy();
      expect(nodeObject(ids.card)?.enabled ?? true).toBe(false);
      expect(nodeObject(ids.controls)?.enabled ?? false).toBe(true);
      expect(textOf(ids.prompt)).toBe(VIRO_REF_PLACEMENT_PROMPTS.idle);
      expect(textOf(ids.place)).toBe("Place card");
      expect(interactableOf(ids.place)).toBeTruthy();
      expect(nodeObject(ids.cancel)?.enabled ?? true).toBe(false);
      await hold(config, "placement_ready");
      print("VIRO_REF placement_ready PASS");
    } finally {
      const started = app as RefApp<ViroRefPlacementState> | null;
      if (started) await started.stop();
    }
  }
}
