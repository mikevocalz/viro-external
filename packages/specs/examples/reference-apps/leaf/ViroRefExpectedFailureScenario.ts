import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario";
import { expect } from "Leaf.lspkg/Utils/common/Expect";
import { VIRO_REF_NODE_IDS, type ViroRefDashboardState } from "./ViroRefAppsLogic";
import { startRefApp, textOf } from "./ViroRefAppsLeafSupport";

/** The title this scenario asserts. The dashboard's real title is "Workshop sensors". */
export const VIRO_REF_EXPECTED_FAILURE_TITLE = "REF_EXPECTED_FAILURE: this title does not exist";

/**
 * viro_ref_expected_failure: MUST FAIL. It asserts a dashboard title the
 * scene does not have, which proves the suite reports a failed assertion
 * instead of passing everything. The failure reads: expected
 * "REF_EXPECTED_FAILURE: this title does not exist", received
 * "Workshop sensors". A run where this scenario passes means the harness is
 * broken.
 */
@component
export class ViroRefExpectedFailureScenario extends Scenario {
  async run(): Promise<void> {
    const app = await startRefApp<ViroRefDashboardState>("dashboard");
    try {
      print("VIRO_REF expected_failure asserting a missing title");
      expect(textOf(VIRO_REF_NODE_IDS.dashboard.title)).toBe(VIRO_REF_EXPECTED_FAILURE_TITLE);
    } finally {
      await app.stop();
    }
  }
}
