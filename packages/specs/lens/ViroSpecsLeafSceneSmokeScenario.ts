import { validateNativeAnimation, validatePolyline, validateWorldPlacement } from "./ViroSpecsRuntimeValidation";
import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario";
import { findSceneObjectByName } from "Leaf.lspkg/Utils/common/Utils";
import { expect } from "Leaf.lspkg/Utils/common/Expect";

/**
 * Verifies that the portable Viro scene actually materialized in SPECS Preview
 * with the expected hierarchy and meter -> centimeter conversion.
 */
@component
export class ViroSpecsLeafSceneSmokeScenario extends Scenario {
  async run(): Promise<void> {
    const root = findSceneObjectByName("viro:platform-lab-root");
    const panel = findSceneObjectByName("viro:platform-lab-panel");
    const title = findSceneObjectByName("viro:platform-lab-title");
    const model = findSceneObjectByName("viro:platform-lab-model");
    const button = findSceneObjectByName("viro:platform-lab-button");
    const status = findSceneObjectByName("viro:platform-lab-status");

    expect(root).toBeTruthy();
    expect(panel).toBeTruthy();
    expect(title).toBeTruthy();
    expect(model).toBeTruthy();
    expect(status).toBeTruthy();
    expect(button).toBeTruthy();

    const rootPosition = root.getTransform().getLocalPosition();
    expect(Math.abs(rootPosition.z + 150)).toBeLessThan(0.5);

    const titleText = title.getComponent("Component.Text") as Text | null;
    const statusText = status.getComponent("Component.Text") as Text | null;

    expect(titleText).toBeTruthy();
    expect(statusText).toBeTruthy();
    expect(titleText?.text).toBe("Viro Specs Platform Lab");
    expect(statusText?.text).toBe("ready");
    await validateNativeAnimation();
    await validatePolyline();
    await validateWorldPlacement();
  }
}
