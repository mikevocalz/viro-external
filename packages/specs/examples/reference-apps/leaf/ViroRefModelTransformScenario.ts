import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario";
import type { ScenarioConfig } from "Leaf.lspkg/Scenarios/scenario/ScenarioConfig";
import { DefaultLeafInteractor } from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor";
import { expect } from "Leaf.lspkg/Utils/common/Expect";
import { sleep } from "Leaf.lspkg/Utils/common/Utils";
import { VIRO_REF_NODE_IDS, type ViroRefModelState } from "./ViroRefAppsLogic";
import { controllerHost, hold, interactableOf, nodeObject, pinch, settle, startRefApp, textOf, waitFor } from "./ViroRefAppsLeafSupport";

/** Angle between two rotations, degrees. */
function angleBetween(a: quat, b: quat): number {
  const dot = Math.min(1, Math.abs(a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w));
  return (2 * Math.acos(dot) * 180) / Math.PI;
}

/**
 * viro_ref_model_transform: "Turn right" turns the model 45 degrees,
 * "Larger" scales it by 1.2, "Reset" returns both to what they were before,
 * all through typed actions. Then an SIK drag on the model moves it and
 * reaches the app as drag phases. Every check is relative to the transform
 * read before the step.
 */
@component
export class ViroRefModelTransformScenario extends Scenario {
  async run(config?: ScenarioConfig): Promise<void> {
    const ids = VIRO_REF_NODE_IDS.model;
    const app = await startRefApp<ViroRefModelState>("model-viewer");
    try {
      expect(await waitFor(() => controllerHost().lifecycle === "ready", 5000)).toBe(true);
      const interactor = new DefaultLeafInteractor();
      const model = nodeObject(ids.model);
      expect(model).toBeTruthy();
      const t = (model as SceneObject).getTransform();
      const rotation0 = t.getLocalRotation();
      const scale0 = t.getLocalScale();

      await pinch(interactor, interactableOf(ids.turnRight));
      expect(await waitFor(() => app.runtime.state.yawDegrees === 45)).toBe(true);
      await settle();
      const turned = angleBetween(rotation0, t.getLocalRotation());
      print("VIRO_REF model_transform turned=" + turned.toFixed(2));
      expect(Math.abs(turned - 45)).toBeLessThan(0.5);

      await pinch(interactor, interactableOf(ids.larger));
      expect(await waitFor(() => app.runtime.state.sizeStep === 1)).toBe(true);
      await settle();
      expect(Math.abs(t.getLocalScale().x / scale0.x - 1.2)).toBeLessThan(0.001);
      expect(textOf(ids.status)).toBe("Turned 45°, size 120 %");
      await hold(config, "model_turned_larger");

      await pinch(interactor, interactableOf(ids.reset));
      expect(await waitFor(() => app.runtime.state.yawDegrees === 0 && app.runtime.state.sizeStep === 0)).toBe(true);
      await settle();
      expect(angleBetween(rotation0, t.getLocalRotation())).toBeLessThan(0.5);
      expect(Math.abs(t.getLocalScale().x - scale0.x)).toBeLessThan(0.001);

      // Drag: LEAF adds the vector on every drag-update frame; it is not a total.
      const phases: string[] = [];
      const subscription = controllerHost().addOnInteractionListener((event) => {
        if (event.nodeId === ids.model) phases.push(event.phase);
      });
      const before = t.getWorldPosition();
      try {
        await interactor.drag(interactableOf(ids.model), new vec3(1, 0, 0), 400);
        await sleep(100);
      } finally {
        subscription.remove();
      }
      const moved = t.getWorldPosition().x - before.x;
      print("VIRO_REF model_transform dragCm=" + moved.toFixed(2) + " phases=" + phases.join(","));
      expect(moved).toBeGreaterThan(3);
      expect(phases.includes("drag")).toBe(true);
      print("VIRO_REF model_transform PASS");
    } finally {
      await app.stop();
    }
  }
}
