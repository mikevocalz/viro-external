import { setTimeout } from "SpectaclesInteractionKit.lspkg/Utils/FunctionTimingUtils";
import type {
  ViroSpecsAnimationEasing,
  ViroSpecsAnimationTrackPlan,
  ViroSpecsNativeAnimationPlan,
} from "./ViroSpecsProtocol";
import { ViroSpecsRuntimeHost } from "./ViroSpecsRuntimeHost";

type EasingControlPoints = [number, number, number, number];

const DEG_TO_RAD = Math.PI / 180;

export class ViroSpecsAnimationRuntime {
  private clipCounter = 0;

  constructor(private readonly host: ViroSpecsRuntimeHost) {}

  play(
    nodeId: string,
    plan: ViroSpecsNativeAnimationPlan,
    onComplete?: () => void
  ): void {
    const object = this.host.getNode(nodeId);
    if (!object) {
      throw new Error("Cannot animate missing Specs node: " + nodeId);
    }

    if (plan.durationSeconds === 0) {
      this.applyImmediate(object, plan.tracks);
      onComplete?.();
      return;
    }

    const start = () => {
      const clipName = "viro-" + nodeId + "-" + ++this.clipCounter;
      const transform = object.getTransform();
      const layer = AnimationPropertyLayer.create();
      const easing = this.resolveEasing(plan.easing);

      this.addPositionTrack(layer, transform, plan.tracks, easing);
      this.addScaleTrack(layer, transform, plan.tracks, easing);
      this.addRotationTrack(layer, transform, plan.tracks, easing);
      this.addOpacityTrack(layer, object, plan.tracks, easing);

      const asset = AnimationAsset.create();
      asset.addLayer(object.name, layer);
      const completionEvent = plan.completionEvent + ":" + clipName;
      asset.createEvent(completionEvent, 1.0);

      const clip = AnimationClip.createFromAnimation(clipName, asset);
      clip.playbackMode =
        plan.playbackMode === "loop" ? PlaybackMode.Loop : PlaybackMode.Single;
      clip.playbackSpeed = 1 / plan.durationSeconds;

      let player = object.getComponent(
        "Component.AnimationPlayer"
      ) as AnimationPlayer | null;

      if (!player) {
        player = object.createComponent(
          "Component.AnimationPlayer"
        ) as AnimationPlayer;
      }

      if (onComplete && plan.playbackMode === "single") {
        const completionPlayer = player;
        const registration = player.onEvent.add((args: AnimationPlayerOnEventArgs) => {
          if (args.eventName === completionEvent) {
            completionPlayer.onEvent.remove(registration);
            onComplete();
          }
        });
      }

      player.addClip(clip);
      player.playClip(clipName);
    };

    if (plan.delaySeconds > 0) {
      setTimeout(start, plan.delaySeconds * 1000);
    } else {
      start();
    }
  }

  private addPositionTrack(
    layer: AnimationPropertyLayer,
    transform: Transform,
    tracks: readonly ViroSpecsAnimationTrackPlan[],
    easing: EasingControlPoints
  ): void {
    const current = transform.getLocalPosition();
    const x = this.positionTargetFor(tracks, "transform.position.x", current.x);
    const y = this.positionTargetFor(tracks, "transform.position.y", current.y);
    const z = this.positionTargetFor(tracks, "transform.position.z", current.z);

    if (x === current.x && y === current.y && z === current.z) {
      return;
    }

    layer.setProperty(
      AnimationPropertyLayer.TransformPosition,
      AnimationPropertyTrack.createVec3FromCurves(
        this.curve(current.x, x, easing),
        this.curve(current.y, y, easing),
        this.curve(current.z, z, easing)
      )
    );
  }

  private addScaleTrack(
    layer: AnimationPropertyLayer,
    transform: Transform,
    tracks: readonly ViroSpecsAnimationTrackPlan[],
    easing: EasingControlPoints
  ): void {
    const current = transform.getLocalScale();
    const x = this.targetFor(tracks, "transform.scale.x", current.x);
    const y = this.targetFor(tracks, "transform.scale.y", current.y);
    const z = this.targetFor(tracks, "transform.scale.z", current.z);

    if (x === current.x && y === current.y && z === current.z) {
      return;
    }

    layer.setProperty(
      AnimationPropertyLayer.TransformScale,
      AnimationPropertyTrack.createVec3FromCurves(
        this.curve(current.x, x, easing),
        this.curve(current.y, y, easing),
        this.curve(current.z, z, easing)
      )
    );
  }

  private addRotationTrack(
    layer: AnimationPropertyLayer,
    transform: Transform,
    tracks: readonly ViroSpecsAnimationTrackPlan[],
    easing: EasingControlPoints
  ): void {
    const current = transform.getLocalRotation().toEulerAngles();

    const x = this.targetFor(
      tracks,
      "transform.rotation.x",
      current.x / DEG_TO_RAD
    ) * DEG_TO_RAD;
    const y = this.targetFor(
      tracks,
      "transform.rotation.y",
      current.y / DEG_TO_RAD
    ) * DEG_TO_RAD;
    const z = this.targetFor(
      tracks,
      "transform.rotation.z",
      current.z / DEG_TO_RAD
    ) * DEG_TO_RAD;

    if (x === current.x && y === current.y && z === current.z) {
      return;
    }

    const track = AnimationPropertyTrack.createVec3FromCurves(
      this.curve(current.x, x, easing),
      this.curve(current.y, y, easing),
      this.curve(current.z, z, easing)
    );

    layer.setCustomProperty("viroRotation", track, (_name, value) => {
      transform.setLocalRotation(quat.fromEulerVec(value as vec3));
    });
  }

  private addOpacityTrack(
    layer: AnimationPropertyLayer,
    object: SceneObject,
    tracks: readonly ViroSpecsAnimationTrackPlan[],
    easing: EasingControlPoints
  ): void {
    const opacityTrack = tracks.find(
      (track) => track.target === "material.opacity"
    );
    if (!opacityTrack) {
      return;
    }

    const from = this.readOpacity(object);
    const track = AnimationPropertyTrack.createFloatFromCurves(
      this.curve(from, opacityTrack.to, easing)
    );

    layer.setCustomProperty("viroOpacity", track, (_name, value) => {
      this.setOpacityRecursive(object, value as number);
    });
  }

  private applyImmediate(
    object: SceneObject,
    tracks: readonly ViroSpecsAnimationTrackPlan[]
  ): void {
    const transform = object.getTransform();
    const position = transform.getLocalPosition();
    const scale = transform.getLocalScale();
    const rotation = transform.getLocalRotation().toEulerAngles();

    const px = this.positionTargetFor(tracks, "transform.position.x", position.x);
    const py = this.positionTargetFor(tracks, "transform.position.y", position.y);
    const pz = this.positionTargetFor(tracks, "transform.position.z", position.z);
    transform.setLocalPosition(new vec3(px, py, pz));

    const sx = this.targetFor(tracks, "transform.scale.x", scale.x);
    const sy = this.targetFor(tracks, "transform.scale.y", scale.y);
    const sz = this.targetFor(tracks, "transform.scale.z", scale.z);
    transform.setLocalScale(new vec3(sx, sy, sz));

    const rx =
      this.targetFor(
        tracks,
        "transform.rotation.x",
        rotation.x / DEG_TO_RAD
      ) * DEG_TO_RAD;
    const ry =
      this.targetFor(
        tracks,
        "transform.rotation.y",
        rotation.y / DEG_TO_RAD
      ) * DEG_TO_RAD;
    const rz =
      this.targetFor(
        tracks,
        "transform.rotation.z",
        rotation.z / DEG_TO_RAD
      ) * DEG_TO_RAD;
    transform.setLocalRotation(quat.fromEulerAngles(rx, ry, rz));

    const opacity = tracks.find(
      (track) => track.target === "material.opacity"
    );
    if (opacity) {
      this.setOpacityRecursive(object, opacity.to);
    }
  }

  private targetFor(
    tracks: readonly ViroSpecsAnimationTrackPlan[],
    target: ViroSpecsAnimationTrackPlan["target"],
    fallback: number
  ): number {
    return tracks.find((track) => track.target === target)?.to ?? fallback;
  }

  private positionTargetFor(
    tracks: readonly ViroSpecsAnimationTrackPlan[],
    target: ViroSpecsAnimationTrackPlan["target"],
    fallbackCentimeters: number
  ): number {
    const valueMeters = tracks.find((track) => track.target === target)?.to;
    return valueMeters === undefined
      ? fallbackCentimeters
      : valueMeters * 100;
  }

  private curve(
    from: number,
    to: number,
    easing: EasingControlPoints
  ): AnimationCurve {
    return AnimationCurve.createEasingCurve(
      from,
      to,
      easing[0],
      easing[1],
      easing[2],
      easing[3]
    );
  }

  private resolveEasing(easing: ViroSpecsAnimationEasing): EasingControlPoints {
    if (typeof easing === "object") {
      return easing.cubicBezier;
    }

    switch (easing) {
      case "ease-in":
        return [0.42, 0, 1, 1];
      case "ease-out":
        return [0, 0, 0.58, 1];
      case "ease-in-out":
        return [0.42, 0, 0.58, 1];
      case "linear":
      default:
        return [0, 0, 1, 1];
    }
  }

  private readOpacity(object: SceneObject): number {
    const image = object.getComponent("Component.Image") as Image | null;
    if (image?.mainMaterial?.mainPass?.baseColor) {
      return image.mainMaterial.mainPass.baseColor.w;
    }

    const text = object.getComponent("Component.Text") as Text | null;
    if (text) {
      return text.textFill.color.w;
    }

    const mesh = object.getComponent(
      "Component.RenderMeshVisual"
    ) as RenderMeshVisual | null;
    if (mesh?.mainMaterial?.mainPass?.baseColor) {
      return mesh.mainMaterial.mainPass.baseColor.w;
    }

    for (const child of object.children) {
      const childOpacity = this.readOpacity(child);
      if (childOpacity !== 1) {
        return childOpacity;
      }
    }

    return 1;
  }

  private setOpacityRecursive(object: SceneObject, alpha: number): void {
    const clamped = Math.max(0, Math.min(1, alpha));

    const image = object.getComponent("Component.Image") as Image | null;
    if (image?.mainMaterial?.mainPass?.baseColor) {
      const color = image.mainMaterial.mainPass.baseColor as vec4;
      image.mainMaterial.mainPass.baseColor = new vec4(
        color.x,
        color.y,
        color.z,
        clamped
      );
    }

    const text = object.getComponent("Component.Text") as Text | null;
    if (text) {
      const color = text.textFill.color;
      text.textFill.color = new vec4(color.x, color.y, color.z, clamped);
    }

    const mesh = object.getComponent(
      "Component.RenderMeshVisual"
    ) as RenderMeshVisual | null;
    if (mesh?.mainMaterial?.mainPass?.baseColor) {
      const color = mesh.mainMaterial.mainPass.baseColor as vec4;
      mesh.mainMaterial.mainPass.baseColor = new vec4(
        color.x,
        color.y,
        color.z,
        clamped
      );
    }

    for (const child of object.children) {
      this.setOpacityRecursive(child, clamped);
    }
  }
}
