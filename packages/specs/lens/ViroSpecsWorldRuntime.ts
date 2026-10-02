import {
  PlacementMode,
  PlacementSettings,
} from "SurfacePlacement.lspkg/Scripts/PlacementSettings";
import { SurfacePlacementController } from "SurfacePlacement.lspkg/Scripts/SurfacePlacementController";
import type {
  ViroViroSpecsARHitTestResult,
  ViroViroSpecsPlacementPose,
  ViroViroSpecsSurfaceClassification,
  ViroViroSpecsSurfacePlacementMode,
  ViroViroSpecsWorldQueryRequest,
} from "./ViroSpecsProtocol";

const WorldQueryModule =
  require("LensStudio:WorldQueryModule") as WorldQueryModule;

const METERS_TO_CENTIMETERS = 100;

export class ViroSpecsWorldRuntime {
  async hitTest(
    request: ViroSpecsWorldQueryRequest
  ): Promise<readonly ViroSpecsARHitTestResult[]> {
    const options = HitTestSessionOptions.create();
    options.filter = Boolean(request.classifications?.length);

    const session =
      WorldQueryModule.createHitTestSessionWithOptions(options);

    const origin = this.metersToLens(request.origin);
    const direction = new vec3(
      request.direction[0],
      request.direction[1],
      request.direction[2]
    ).normalize();

    const maxDistanceCm =
      (request.maxDistance ?? 10) * METERS_TO_CENTIMETERS;
    const end = origin.add(direction.uniformScale(maxDistanceCm));

    return new Promise((resolve) => {
      session.hitTest(origin, end, (result) => {
        session.stop();

        if (result === null) {
          resolve([]);
          return;
        }

        const position = result.position as vec3;
        const normal = result.normal as vec3 | undefined;

        resolve([
          {
            position: [
              position.x / METERS_TO_CENTIMETERS,
              position.y / METERS_TO_CENTIMETERS,
              position.z / METERS_TO_CENTIMETERS,
            ],
            ...(normal
              ? { normal: [normal.x, normal.y, normal.z] as [number, number, number] }
              : {}),
            distance:
              origin.distance(position) / METERS_TO_CENTIMETERS,
            surface: this.readClassification(result),
          },
        ]);
      });
    });
  }

  startPlacement(
    mode: ViroSpecsSurfacePlacementMode,
    onPose: (pose: ViroSpecsPlacementPose) => void
  ): () => void {
    const controller = SurfacePlacementController.getInstance();
    const placementMode = this.toPlacementMode(mode);
    const settings = new PlacementSettings(
      placementMode,
      true,
      new vec3(2, 2, 0)
    );

    controller.startSurfacePlacement(settings, (position, rotation) => {
      onPose({
        position: [
          position.x / METERS_TO_CENTIMETERS,
          position.y / METERS_TO_CENTIMETERS,
          position.z / METERS_TO_CENTIMETERS,
        ],
        rotation: [
          rotation.x,
          rotation.y,
          rotation.z,
          rotation.w,
        ],
        surface: this.surfaceForPlacementMode(mode),
      });
    });

    return () => controller.stopSurfacePlacement();
  }

  private metersToLens(
    value: [number, number, number]
  ): vec3 {
    return new vec3(
      value[0] * METERS_TO_CENTIMETERS,
      value[1] * METERS_TO_CENTIMETERS,
      value[2] * METERS_TO_CENTIMETERS
    );
  }

  private toPlacementMode(
    mode: ViroSpecsSurfacePlacementMode
  ): PlacementMode {
    switch (mode) {
      case "horizontal":
        return PlacementMode.HORIZONTAL;
      case "vertical":
        return PlacementMode.VERTICAL;
      case "near-surface":
      default:
        return PlacementMode.NEAR_SURFACE;
    }
  }

  private surfaceForPlacementMode(
    mode: ViroSpecsSurfacePlacementMode
  ): ViroSpecsSurfaceClassification {
    switch (mode) {
      case "horizontal":
        return "floor";
      case "vertical":
        return "wall";
      case "near-surface":
      default:
        return "table";
    }
  }

  private readClassification(
    result: unknown
  ): ViroSpecsSurfaceClassification {
    const raw = String(
      (result as { classification?: unknown }).classification ?? ""
    ).toLowerCase();

    if (raw.includes("floor")) return "floor";
    if (raw.includes("wall")) return "wall";
    if (raw.includes("ceiling")) return "ceiling";
    if (raw.includes("table")) return "table";
    if (raw.includes("seat")) return "seat";
    return "unknown";
  }
}
