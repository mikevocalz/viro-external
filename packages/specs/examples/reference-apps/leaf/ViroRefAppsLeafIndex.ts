import { scenariosIndex } from "Leaf.lspkg/Scenarios/decorator/ScenarioIndexDecorator";
import { ScenarioMetadata } from "Leaf.lspkg/Scenarios/scenario/ScenarioMetadata";
import { ViroRefDashboardReadyScenario } from "./ViroRefDashboardReadyScenario";
import { ViroRefDashboardRangeScenario } from "./ViroRefDashboardRangeScenario";
import { ViroRefDashboardIKScenario } from "./ViroRefDashboardIKScenario";
import { ViroRefModelReadyScenario } from "./ViroRefModelReadyScenario";
import { ViroRefModelTransformScenario } from "./ViroRefModelTransformScenario";
import { ViroRefModelMissingAssetScenario } from "./ViroRefModelMissingAssetScenario";
import { ViroRefPlacementReadyScenario } from "./ViroRefPlacementReadyScenario";
import { ViroRefPlacementConfirmScenario } from "./ViroRefPlacementConfirmScenario";
import { ViroRefPlacementCancelScenario } from "./ViroRefPlacementCancelScenario";
import { ViroRefExpectedFailureScenario } from "./ViroRefExpectedFailureScenario";
import { REF_PARAMETERS } from "./ViroRefAppsLeafSupport";

/**
 * LEAF scenarios for the three reference apps. Attach to its own SceneObject
 * ("RefAppsLeafIndex"); it sits next to the Platform Lab's LeafIndex and
 * does not replace it. viro_ref_expected_failure must fail.
 */
@component
export class ViroRefAppsLeafIndex extends BaseScriptComponent {
  @scenariosIndex
  static scenariosIndex: ScenarioMetadata[] = [
    { id: "viro_ref_dashboard_ready", typename: ViroRefDashboardReadyScenario.getTypeName(), parameters: REF_PARAMETERS },
    { id: "viro_ref_dashboard_range", typename: ViroRefDashboardRangeScenario.getTypeName(), parameters: REF_PARAMETERS },
    { id: "viro_ref_dashboard_ik", typename: ViroRefDashboardIKScenario.getTypeName() },
    { id: "viro_ref_model_ready", typename: ViroRefModelReadyScenario.getTypeName(), parameters: REF_PARAMETERS },
    { id: "viro_ref_model_transform", typename: ViroRefModelTransformScenario.getTypeName(), parameters: REF_PARAMETERS },
    { id: "viro_ref_model_missing_asset", typename: ViroRefModelMissingAssetScenario.getTypeName(), parameters: REF_PARAMETERS },
    { id: "viro_ref_placement_ready", typename: ViroRefPlacementReadyScenario.getTypeName(), parameters: REF_PARAMETERS },
    { id: "viro_ref_placement_confirm", typename: ViroRefPlacementConfirmScenario.getTypeName(), parameters: REF_PARAMETERS },
    { id: "viro_ref_placement_cancel", typename: ViroRefPlacementCancelScenario.getTypeName(), parameters: REF_PARAMETERS },
    { id: "viro_ref_expected_failure", typename: ViroRefExpectedFailureScenario.getTypeName() },
  ];
}
