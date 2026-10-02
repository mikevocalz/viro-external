import { scenariosIndex } from "Leaf.lspkg/Scenarios/decorator/ScenarioIndexDecorator";
import { ScenarioMetadata } from "Leaf.lspkg/Scenarios/scenario/ScenarioMetadata";
import { ViroSpecsLeafInteractionScenario } from "./ViroSpecsLeafInteractionScenario";
import { ViroSpecsLeafSceneSmokeScenario } from "./ViroSpecsLeafSceneSmokeScenario";

@component
export class ViroSpecsLeafIndex extends BaseScriptComponent {
  @scenariosIndex
  static scenariosIndex: ScenarioMetadata[] = [
    {
      id: "viro_specs_scene_smoke",
      typename: ViroSpecsLeafSceneSmokeScenario.getTypeName(),
    },
    {
      id: "viro_specs_interaction",
      typename: ViroSpecsLeafInteractionScenario.getTypeName(),
    },
  ];
}
