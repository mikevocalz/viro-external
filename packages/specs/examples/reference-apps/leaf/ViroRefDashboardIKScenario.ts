import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario";
import { createIKInteractor } from "Leaf.lspkg/Interactors/interactor/ik/visualizer/BitmojiAvatar";
import { expect } from "Leaf.lspkg/Utils/common/Expect";
import { VIRO_REF_NODE_IDS, type ViroRefDashboardState } from "./ViroRefAppsLogic";
import { interactableOf, startRefApp, waitFor } from "./ViroRefAppsLeafSupport";

/**
 * viro_ref_dashboard_ik: pinches Refresh the way a wearer would, with LEAF's
 * IK arm and head. The panel is 1.5 m away, so the expected path is the
 * far-field ray, as in viro_lab_select_ik. A reach that does not converge
 * fails this scenario; treat that as a reachability finding about the
 * layout, not a test bug.
 */
@component
export class ViroRefDashboardIKScenario extends Scenario {
  async run(): Promise<void> {
    const app = await startRefApp<ViroRefDashboardState>("dashboard");
    try {
      const ik = createIKInteractor();
      const refreshes = app.runtime.state.refreshes;
      await ik.trigger(interactableOf(VIRO_REF_NODE_IDS.dashboard.refresh));
      expect(await waitFor(() => app.runtime.state.refreshes === refreshes + 1)).toBe(true);
      print("VIRO_REF dashboard_ik PASS actions=" + JSON.stringify(app.actions));
    } finally {
      await app.stop();
    }
  }
}
