import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario";
import type { ScenarioConfig } from "Leaf.lspkg/Scenarios/scenario/ScenarioConfig";
import { DefaultLeafInteractor } from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor";
import { findSceneObjectByName } from "Leaf.lspkg/Utils/common/Utils";
import { expect } from "Leaf.lspkg/Utils/common/Expect";
import { VIRO_REF_NODE_IDS, VIRO_REF_PLACEMENT_PROMPTS, type ViroRefPlacementState } from "./ViroRefAppsLogic";
import {
  cameraPosition,
  hold,
  injectWorldQuery,
  interactableOf,
  nodeObject,
  pinch,
  settle,
  startExperience,
  startRefApp,
  stopExperience,
  textOf,
  waitFor,
  wirePlacement,
} from "./ViroRefAppsLeafSupport";

/**
 * viro_ref_placement_confirm: "Place card" fires placement.start, the app
 * starts a placement, and a WorldQuery hit on a table (normal up, injected
 * because Preview has no SPECS depth) shows the reticle labelled
 * "Table. Pinch to place.". Confirming sends placement.confirm with the
 * pose; the card appears within 3 cm of the hit, the prompt changes and the
 * button reads "Move card".
 */
@component
export class ViroRefPlacementConfirmScenario extends Scenario {
  async run(config?: ScenarioConfig): Promise<void> {
    const ids = VIRO_REF_NODE_IDS.placement;
    const host = await startExperience();
    const app = await startRefApp<ViroRefPlacementState>("world-placed-info");
    const wiring = wirePlacement(host, app);
    try {
      await pinch(new DefaultLeafInteractor(), interactableOf(ids.place));
      expect(await waitFor(() => app.runtime.state.phase === "placing")).toBe(true);
      await settle();
      expect(textOf(ids.prompt)).toBe(VIRO_REF_PLACEMENT_PROMPTS.placing);
      expect(nodeObject(ids.cancel)?.enabled ?? false).toBe(true);

      const hit = cameraPosition().add(new vec3(10, -45, -110));
      injectWorldQuery(host, { position: hit, normal: vec3.up() });
      expect(await waitFor(() => (findSceneObjectByName("ViroSpecsReticleLabel")?.getComponent("Component.Text") as Text | null)?.text.startsWith("Table") ?? false, 3000)).toBe(true);
      await hold(config, "placement_reticle");
      expect(host.confirmPlacement()).toBe(true);
      expect(await waitFor(() => app.runtime.state.phase === "placed")).toBe(true);
      await settle();

      const card = nodeObject(ids.card);
      expect(card?.enabled ?? false).toBe(true);
      const at = (card as SceneObject).getTransform().getWorldPosition();
      print("VIRO_REF placement_confirm hit=" + hit.toString() + " card=" + at.toString());
      expect(at.distance(hit)).toBeLessThan(3);
      expect(textOf(ids.prompt)).toBe(VIRO_REF_PLACEMENT_PROMPTS.placed);
      expect(textOf(ids.place)).toBe("Move card");
      expect(nodeObject(ids.cancel)?.enabled ?? true).toBe(false);
      await hold(config, "placement_placed");
      print("VIRO_REF placement_confirm PASS");
    } finally {
      wiring.remove();
      stopExperience();
      await app.stop();
    }
  }
}
