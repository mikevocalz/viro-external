import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario";
import type { ScenarioConfig } from "Leaf.lspkg/Scenarios/scenario/ScenarioConfig";
import { DefaultLeafInteractor } from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor";
import { expect } from "Leaf.lspkg/Utils/common/Expect";
import { VIRO_REF_DASHBOARD_METRICS, VIRO_REF_NODE_IDS, type ViroRefDashboardState } from "./ViroRefAppsLogic";
import { hold, interactableOf, pinch, settle, startRefApp, textOf, waitFor } from "./ViroRefAppsLeafSupport";

/**
 * viro_ref_dashboard_range: pinching "7 d" fires the typed action
 * dashboard.set-range, the registry reduces it, and the readings and status
 * line patch to the 7 day values. Pinching Refresh raises the refresh count
 * by one and marks the status line. Every check compares against the values
 * read before the pinch.
 */
@component
export class ViroRefDashboardRangeScenario extends Scenario {
  async run(config?: ScenarioConfig): Promise<void> {
    const ids = VIRO_REF_NODE_IDS.dashboard;
    const app = await startRefApp<ViroRefDashboardState>("dashboard");
    try {
      const interactor = new DefaultLeafInteractor();
      const before = ids.values.map((id) => textOf(id));
      const statusBefore = textOf(ids.status);

      await pinch(interactor, interactableOf("dash-range-7d"));
      expect(await waitFor(() => app.runtime.state.range === "7d")).toBe(true);
      await settle();
      const after = ids.values.map((id) => textOf(id));
      print("VIRO_REF dashboard_range before=" + JSON.stringify(before) + " after=" + JSON.stringify(after) + " actions=" + JSON.stringify(app.actions));
      expect(app.actions.includes("dashboard.set-range dash-range-7d")).toBe(true);
      expect(JSON.stringify(after) === JSON.stringify(before)).toBe(false);
      after.forEach((text, index) => {
        expect(text).toBe(VIRO_REF_DASHBOARD_METRICS[index]?.values["7d"]);
      });
      expect(textOf(ids.status) === statusBefore).toBe(false);
      await hold(config, "dashboard_7d");

      const refreshes = app.runtime.state.refreshes;
      await pinch(interactor, interactableOf(ids.refresh));
      expect(await waitFor(() => app.runtime.state.refreshes === refreshes + 1)).toBe(true);
      await settle();
      expect((textOf(ids.status) ?? "").endsWith(", refreshed")).toBe(true);
      print("VIRO_REF dashboard_range PASS status=" + JSON.stringify(textOf(ids.status)));
    } finally {
      await app.stop();
    }
  }
}
