import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario";
import type { ScenarioConfig } from "Leaf.lspkg/Scenarios/scenario/ScenarioConfig";
import { expect } from "Leaf.lspkg/Utils/common/Expect";
import { VIRO_REF_DASHBOARD_METRICS, VIRO_REF_DASHBOARD_STATUS, VIRO_REF_NODE_IDS, type ViroRefDashboardState } from "./ViroRefAppsLogic";
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
 * viro_ref_dashboard_ready: the compiled Spatial dashboard commits and reaches
 * "ready" with no host findings, shows its title, the 24 h readings and the
 * 24 h status line, and binds an Interactable on each range control and on
 * Refresh.
 */
@component
export class ViroRefDashboardReadyScenario extends Scenario {
  async run(config?: ScenarioConfig): Promise<void> {
    const ids = VIRO_REF_NODE_IDS.dashboard;
    let app: RefApp<ViroRefDashboardState> | null = null;
    try {
      const diagnostics = await diagnosticsDuring(async () => {
        app = await startRefApp<ViroRefDashboardState>("dashboard");
        expect(await waitFor(() => controllerHost().lifecycle === "ready")).toBe(true);
      });
      print("VIRO_REF dashboard_ready findings=" + JSON.stringify(findings(diagnostics)));
      expect(findings(diagnostics).length).toBe(0);
      expect(nodeObject(ids.panel)?.enabled ?? false).toBe(true);
      expect(textOf(ids.title)).toBe("Workshop sensors");
      ids.values.forEach((id, index) => {
        expect(textOf(id)).toBe(VIRO_REF_DASHBOARD_METRICS[index]?.values["24h"]);
      });
      expect(textOf(ids.status)).toBe(VIRO_REF_DASHBOARD_STATUS["24h"]);
      for (const id of [...ids.ranges, ids.refresh]) expect(interactableOf(id)).toBeTruthy();
      await hold(config, "dashboard_ready");
      print("VIRO_REF dashboard_ready PASS");
    } finally {
      const started = app as RefApp<ViroRefDashboardState> | null;
      if (started) await started.stop();
    }
  }
}
