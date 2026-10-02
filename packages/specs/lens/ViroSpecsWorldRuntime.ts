import { setTimeout, clearTimeout } from "SpectaclesInteractionKit.lspkg/Utils/FunctionTimingUtils";
import {
  PlacementMode,
  PlacementSettings,
} from "SurfacePlacement.lspkg/Scripts/PlacementSettings";
import { SurfacePlacementController } from "SurfacePlacement.lspkg/Scripts/SurfacePlacementController";
import type {
  ViroSpecsARHitTestResult,
  ViroSpecsPlacementPose,
  ViroSpecsSurfaceClassification,
  ViroSpecsSurfacePlacementMode,
  ViroSpecsWorldQueryRequest,
} from "./ViroSpecsProtocol";

const WorldQueryModule =
  require("LensStudio:WorldQueryModule") as WorldQueryModule;

const METERS_TO_CENTIMETERS = 100;

/** Native boundaries can be injected for deterministic capability-failure tests. */
export interface ViroSpecsWorldDependencies {
  createHitTestSession?: (options: HitTestSessionOptions) => Pick<HitTestSession, "start" | "stop" | "hitTest">;
  getPlacementController?: () => Pick<SurfacePlacementController, "startSurfacePlacement" | "stopSurfacePlacement">;
}

export class ViroSpecsWorldRuntime {
  private activePlacement: (() => void) | null = null;
  private unavailableReason: string | null = null;

  constructor(private readonly dependencies: ViroSpecsWorldDependencies = {}) {}

  get isPlacementActive(): boolean { return this.activePlacement !== null; }
  get lastUnavailableReason(): string | null { return this.unavailableReason; }

  async hitTest(
    request: ViroSpecsWorldQueryRequest
  ): Promise<readonly ViroSpecsARHitTestResult[]> {
    this.unavailableReason = null;
    const direction = new vec3(request.direction[0], request.direction[1], request.direction[2]);
    if (![...request.origin, ...request.direction, request.maxDistance ?? 10].every(Number.isFinite) || direction.length < 0.000001 || (request.maxDistance ?? 10) <= 0) {
      throw new Error("WorldQuery requires a nonzero direction and positive maxDistance.");
    }
    let session: Pick<HitTestSession, "start" | "stop" | "hitTest"> | null = null;
    try {
      const options = HitTestSessionOptions.create();
      // filter smooths repeated results; classification is an independent flag.
      options.filter = false;
      options.classification = Boolean(request.classifications?.length);
      session = this.dependencies.createHitTestSession?.(options) ?? WorldQueryModule.createHitTestSessionWithOptions(options);
      session.start();
    } catch (error) {
      this.unavailableReason = String(error);
      try { session?.stop(); } catch (_) { /* unavailable native capability */ }
      return [];
    }
    const origin = this.metersToLens(request.origin);
    const end = origin.add(direction.normalize().uniformScale(
      (request.maxDistance ?? 10) * METERS_TO_CENTIMETERS
    ));
    return new Promise((resolve) => {
      let settled = false;
      let receivedCallback = false;
      let retry: ReturnType<typeof setTimeout> | undefined;
      const finish = (hits: ViroSpecsARHitTestResult[]) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        clearTimeout(retry);
        try { session.stop(); } catch (error) {
          this.unavailableReason = String(error);
        }
        resolve(hits);
      };
      const timeout = setTimeout(() => {
        if (!receivedCallback) this.unavailableReason = "WorldQuery returned no callback within 1500ms.";
        finish([]);
      }, 1500);
      const query = () => {
        if (settled) return;
        try {
          session.hitTest(origin, end, (result) => {
            if (settled) return;
            receivedCallback = true;
            // A newly started session needs a depth update (~5Hz). Keep it alive
            // briefly instead of treating the first cold/null result as final.
            if (!result) { retry = setTimeout(query, 200); return; }
            const position = result.position;
            const normal = result.normal;
            const surface = this.readClassification(result);
            if (request.classifications?.length && !request.classifications.includes(surface)) {
              finish([]); return;
            }
            finish([{
              position: [position.x / 100, position.y / 100, position.z / 100],
              ...(normal ? {normal: [normal.x, normal.y, normal.z] as [number, number, number]} : {}),
              distance: origin.distance(position) / 100,
              surface,
            }]);
          });
        } catch (error) {
          this.unavailableReason = String(error);
          finish([]);
        }
      };
      query();
    });
  }

  startPlacement(
    mode: ViroSpecsSurfacePlacementMode,
    onPose: (pose: ViroSpecsPlacementPose) => void
  ): () => void {
    this.activePlacement?.();
    this.unavailableReason = null;
    let controller: Pick<SurfacePlacementController, "startSurfacePlacement" | "stopSurfacePlacement">;
    try { controller = this.dependencies.getPlacementController?.() ?? SurfacePlacementController.getInstance(); } catch (error) {
      this.unavailableReason = String(error);
      return () => {};
    }
    let active = true;
    const cancel = () => {
      if (!active) return;
      active = false;
      if (this.activePlacement === cancel) this.activePlacement = null;
      try { controller.stopSurfacePlacement(); } catch (error) {
        this.unavailableReason = String(error);
      }
    };
    this.activePlacement = cancel;
    try {
      const settings = new PlacementSettings(
        this.toPlacementMode(mode),
        true,
        new vec3(2, 2, 0)
      );
      controller.startSurfacePlacement(settings, (position, rotation) => {
        if (!active) return;
        cancel();
        onPose({
          position: [
            position.x / METERS_TO_CENTIMETERS,
            position.y / METERS_TO_CENTIMETERS,
            position.z / METERS_TO_CENTIMETERS,
          ],
          rotation: [rotation.x, rotation.y, rotation.z, rotation.w],
          surface: this.surfaceForPlacementMode(mode),
        });
      });

    } catch (error) {
      this.unavailableReason = String(error);
      cancel();
    }
    return cancel;
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
    const classification = (result as {classification?: SurfaceClassification}).classification;
    if (classification === SurfaceClassification.Ground) return "floor";
    if (classification === SurfaceClassification.Wall) return "wall";
    if (classification === SurfaceClassification.Ceiling) return "ceiling";
    if (classification === SurfaceClassification.Table) return "table";
    const raw = String(
      (result as { classification?: unknown }).classification ?? ""
    ).toLowerCase();

    if (raw.includes("floor") || raw.includes("ground")) return "floor";
    if (raw.includes("wall")) return "wall";
    if (raw.includes("ceiling")) return "ceiling";
    if (raw.includes("table")) return "table";
    if (raw.includes("seat")) return "seat";
    return "unknown";
  }
}
