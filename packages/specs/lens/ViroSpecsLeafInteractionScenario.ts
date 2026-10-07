import { ViroSpecsInteractionHost } from "./ViroSpecsInteractionHost";
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

    let hovered = false;
    const host = findSceneObjectByName("InteractionHost").getComponent(ViroSpecsInteractionHost.getTypeName()) as ViroSpecsInteractionHost;
    const unsubscribe = host.subscribe((event) => {
      if (event.targetId === "platform-lab-button" && event.phase === "hover-enter") hovered = true;
    });
    await interactor.hover(button, 100);
    unsubscribe();
    expect(hovered).toBe(true);
    print("VIRO_VALIDATION interaction:hover PASS portable-hover-enter=true");
    await interactor.trigger(button);
    await sleep(50);

    const statusObject = findSceneObjectByName("viro:platform-lab-status");
    const statusText = statusObject.getComponent(
      "Component.Text"
    ) as Text | null;

    expect(statusText).toBeTruthy();
    expect(statusText?.text).toBe("button:selected");
    print("VIRO_VALIDATION interaction:select PASS status=button:selected");

    const model = findInteractableByName(
      "viro-interactable:platform-lab-model"
    );
    expect(model).toBeTruthy();

    const modelObject = findSceneObjectByName("viro:platform-lab-model");
    const before = modelObject.getTransform().getWorldPosition();

    // LEAF's vector is added every drag-update frame, not a total displacement.
    await interactor.drag(model, new vec3(1, 0, 0), 400);
    await sleep(50);

    const after = modelObject.getTransform().getWorldPosition();
    expect(after.x - before.x).toBeGreaterThan(3);
    expect(after.x - before.x).toBeLessThan(35);
    expect(Math.abs(after.y - before.y)).toBeLessThan(1);
    expect(Math.abs(after.z - before.z)).toBeLessThan(2);

    expect(statusText?.text).toBe("model:drag");
    print("VIRO_VALIDATION interaction:drag PASS " + JSON.stringify({inputCmPerFrame:1,durationMs:400,beforeCm:[before.x,before.y,before.z],afterCm:[after.x,after.y,after.z],distanceCm:after.distance(before),status:statusText.text}));
  }
}
