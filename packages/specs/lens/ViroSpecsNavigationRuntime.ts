import { setTimeout } from "SpectaclesInteractionKit.lspkg/Utils/FunctionTimingUtils";
import { VolumetricLine } from "VolumetricLine.lspkg/Scripts/VolumetricLine";
import { GeoLocationPlace } from "SpecsNavigationKit.lspkg/NavigationDataComponent/GeoLocationPlace";
import { NavigationDataComponent } from "SpecsNavigationKit.lspkg/NavigationDataComponent/NavigationDataComponent";
import type {
  ViroSpecsGeoCoordinate,
  ViroSpecsNavigationPlan,
  ViroSpecsVolumetricLinePlan,
} from "./ViroSpecsProtocol";
import { ViroSpecsAssetRegistry } from "./ViroSpecsAssetRegistry";

const METERS_TO_CENTIMETERS = 100;

type LiveLine = {
  root: SceneObject;
  points: SceneObject[];
  line: VolumetricLine;
};

export class ViroSpecsNavigationRuntime {
  private liveLine: LiveLine | null = null;
  private routePlaces: GeoLocationPlace[] = [];
  private currentRoute: ViroSpecsNavigationPlan | null = null;

  constructor(
    private readonly root: SceneObject,
    private readonly navigation: NavigationDataComponent,
    private readonly assets: ViroSpecsAssetRegistry,
    private readonly defaultLineMaterial: Material,
    private readonly routeIcon: Texture
  ) {
    this.navigation
      .getUserPosition()
      .onUserPositionUpdated.add(() => this.refreshRouteGeometry());
  }

  presentRoute(plan: ViroSpecsNavigationPlan): boolean {
    this.clearRoute();

    const userPosition = this.navigation.getUserPosition();
    if (!userPosition.getGeoPosition()) {
      print("Viro Specs navigation unavailable: no geo position. Route cleared.");
      return false;
    }

    this.currentRoute = plan;
    this.routePlaces = plan.route.points.map((coordinate, index) => {
      return new GeoLocationPlace(
        this.toGeoPosition(coordinate),
        2,
        plan.route.destination?.name ?? "Route " + index,
        this.routeIcon,
        "",
        userPosition
      );
    });

    const worldPoints = this.routePlaces.map((place, index) => {
      const position = place.getRelativePosition();
      if (!position) {
        throw new Error(
          "Specs Navigation Kit could not resolve route point " + index +
            " into world space. Check location permission/GPS state."
        );
      }
      const verticalOffset =
        (plan.line.verticalOffsetMeters ?? 0) * METERS_TO_CENTIMETERS;
      return position.add(new vec3(0, verticalOffset, 0));
    });

    this.liveLine = this.createVolumetricLine(
      worldPoints,
      (plan.line.widthMeters * METERS_TO_CENTIMETERS) / 2,
      this.resolveMaterial(plan.line.materialId)
    );

    if (plan.route.destination) {
      const destination = new GeoLocationPlace(
        this.toGeoPosition(plan.route.destination.coordinate),
        2,
        plan.route.destination.name ?? "Destination",
        this.routeIcon,
        "",
        userPosition
      );
      this.routePlaces.push(destination);
      this.navigation.navigateToPlace(destination);
    }
    return true;
  }

  presentPolyline(plan: ViroSpecsVolumetricLinePlan): void {
    this.clearRoute();

    const positions = plan.points.map(
      (point) =>
        new vec3(
          point[0] * METERS_TO_CENTIMETERS,
          point[1] * METERS_TO_CENTIMETERS,
          point[2] * METERS_TO_CENTIMETERS
        )
    );

    this.liveLine = this.createVolumetricLine(
      positions,
      plan.radiusMeters * METERS_TO_CENTIMETERS,
      this.resolveMaterial(plan.materialId)
    );
  }

  clearRoute(): void {
    this.navigation.stopNavigation();
    this.currentRoute = null;
    for (const place of this.routePlaces) {
      this.navigation.removePlace(place);
    }
    this.routePlaces = [];

    if (this.liveLine) {
      if (!isNull(this.liveLine.root)) this.liveLine.root.destroy();
      this.liveLine = null;
    }
  }

  private refreshRouteGeometry(): void {
    if (!this.currentRoute || !this.liveLine) {
      return;
    }

    for (let i = 0; i < this.routePlaces.length; i++) {
      const position = this.routePlaces[i].getRelativePosition();
      if (position && this.liveLine.points[i]) {
        const verticalOffset =
          (this.currentRoute.line.verticalOffsetMeters ?? 0) *
          METERS_TO_CENTIMETERS;
        this.liveLine.points[i]
          .getTransform()
          .setWorldPosition(position.add(new vec3(0, verticalOffset, 0)));
      }
    }

    this.liveLine.line.updateMesh();
  }

  private createVolumetricLine(
    positions: readonly vec3[],
    radiusCentimeters: number,
    material: Material
  ): LiveLine {
    const root = global.scene.createSceneObject("viro:volumetric-line");
    root.setParent(this.root);

    const points = positions.map((position, index) => {
      const point = global.scene.createSceneObject(
        "viro:line-point:" + index
      );
      point.setParent(root);
      point.getTransform().setWorldPosition(position);
      return point;
    });

    const line = root.createComponent(
      VolumetricLine.getTypeName()
    ) as VolumetricLine;

    line.pathPoints = points;
    line.material = material;
    line.radius = radiusCentimeters;
    line.useWorldPosition = true;
    line.useRelativeToComponent = true;
    line.autoCorrectOffset = false;
    line.continuousUpdate = false;
    line.smoothUpdate = false;

    // Runtime-created script components may receive lifecycle callbacks before
    // all public properties have been assigned. Defer one turn, then either
    // update the initialized component or invoke its public startup path once.
    setTimeout(() => {
      if (isNull(root)) return;
      const visual = root.getComponent(
        "Component.RenderMeshVisual"
      ) as RenderMeshVisual | null;

      if (visual) {
        line.updateMesh();
      } else {
        line.onStart();
      }
    }, 0);

    return { root, points, line };
  }

  private resolveMaterial(materialId?: string): Material {
    if (!materialId) {
      return this.defaultLineMaterial;
    }

    return (
      this.assets.resolveMaterial(materialId) ??
      this.defaultLineMaterial
    );
  }

  private toGeoPosition(coordinate: ViroSpecsGeoCoordinate): GeoPosition {
    const position = GeoPosition.create();
    position.latitude = coordinate.latitude;
    position.longitude = coordinate.longitude;
    position.altitude = coordinate.altitudeMeters ?? 0;
    return position;
  }
}
