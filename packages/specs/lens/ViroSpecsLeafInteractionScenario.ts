import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario";
import { DefaultLeafInteractor } from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor";
import { findInteractableByName } from "Leaf.lspkg/Interactors/InteractableUtils";
import { findSceneObjectByName, sleep } from "Leaf.lspkg/Utils/common/Utils";
import { expect } from "Leaf.lspkg/Utils/common/Expect";

/**
 * Drives the same SIK interaction path used on device, but entirely inside the
 * SPECS 27 Preview panel.
 */
@component
export class ViroSpecsLeafInteractionScenario extends Scenario {
  async run(): Promise<void> {
    const interactor = new DefaultLeafInteractor();

    const button = findInteractableByName(
      "viro-interactable:platform-lab-button"
    );
    expect(button).toBeTruthy();

    await interactor.hover(button, 100);
    await interactor.trigger(button);
    await sleep(50);

    const statusObject = findSceneObjectByName("viro:platform-lab-status");
    const statusText = statusObject.getComponent(
      "Component.Text"
    ) as Text | null;

    expect(statusText).toBeTruthy();
    expect(statusText?.text).toBe("button:selected");

    const model = findInteractableByName(
      "viro-interactable:platform-lab-model"
    );
    expect(model).toBeTruthy();

    const modelObject = model.getSceneObject();
    const before = modelObject.getTransform().getWorldPosition();

    await interactor.drag(model, new vec3(20, 0, 0), 400);
    await sleep(50);

    const after = modelObject.getTransform().getWorldPosition();
    expect(after.distance(before)).toBeGreaterThan(1);

    expect(statusText?.text).toBe("model:drag");
  }
}
