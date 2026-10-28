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

function reticleLabel(): string {
  const text = findSceneObjectByName("ViroSpecsReticleLabel")?.getComponent("Component.Text") as Text | null;
  return text ? text.text : "";
}

/**
 * viro_ref_placement_cancel: after "Place card" and a valid table hit, the
 * hit goes away; after 1.5 s of looking away the reticle reads "Placement
 * cancelled" and a confirm places nothing, so the card stays hidden. Then
 * Cancel fires placement.cancel and the app returns to the idle prompt with
 * Cancel hidden again.
 */
@component
export class ViroRefPlacementCancelScenario extends Scenario {
  async run(config?: ScenarioConfig): Promise<void> {
    const ids = VIRO_REF_NODE_IDS.placement;
    const host = await startExperience();
    const app = await startRefApp<ViroRefPlacementState>("world-placed-info");
    const wiring = wirePlacement(host, app);
    try {
      const interactor = new DefaultLeafInteractor();
      await pinch(interactor, interactableOf(ids.place));
      expect(await waitFor(() => app.runtime.state.phase === "placing")).toBe(true);
      await settle();

      injectWorldQuery(host, { position: cameraPosition().add(new vec3(0, -45, -110)), normal: vec3.up() });
      expect(await waitFor(() => reticleLabel().startsWith("Table"), 3000)).toBe(true);
      injectWorldQuery(host, null);
      // A cancelled attempt hides the reticle, so its Text keeps the last
      // label; the placement session's view carries the cancelled state.
      const session = (): string => {
        const placement = (host as unknown as { placement: { view(): { label: string } } | null }).placement;
        return placement ? placement.view().label : "";
      };
      expect(await waitFor(() => session().startsWith("Placement cancelled") && !(findSceneObjectByName("ViroSpecsReticle")?.enabled ?? false), 4000)).toBe(true);
      await hold(config, "placement_cancelled");
      expect(host.confirmPlacement()).toBe(false);
      expect(nodeObject(ids.card)?.enabled ?? true).toBe(false);
      expect(app.runtime.state.phase).toBe("placing");

      await pinch(interactor, interactableOf(ids.cancel));
      expect(await waitFor(() => app.runtime.state.phase === "idle")).toBe(true);
      await settle();
      expect(textOf(ids.prompt)).toBe(VIRO_REF_PLACEMENT_PROMPTS.idle);
      expect(nodeObject(ids.cancel)?.enabled ?? true).toBe(false);
      expect(nodeObject(ids.card)?.enabled ?? true).toBe(false);
      print("VIRO_REF placement_cancel PASS actions=" + JSON.stringify(app.actions));
    } finally {
      wiring.remove();
      stopExperience();
      await app.stop();
    }
  }
}
