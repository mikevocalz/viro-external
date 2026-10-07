import type { SpecsUpstreamPackageName } from "./upstream.js";

export type SpecsAnimationEasing =
  | "linear"
  | "ease-in"
  | "ease-out"
  | "ease-in-out"
  | {
      cubicBezier: [number, number, number, number];
    };

export type SpecsViroAnimationProperty =
  | "positionX"
  | "positionY"
  | "positionZ"
  | "scaleX"
  | "scaleY"
  | "scaleZ"
  | "rotateX"
  | "rotateY"
  | "rotateZ"
  | "opacity";

export type SpecsViroAnimationProperties = Partial<
  Record<SpecsViroAnimationProperty, number>
>;

export type SpecsViroAnimationDefinition = {
  properties: SpecsViroAnimationProperties;
  durationMs: number;
  delayMs?: number;
  easing?: SpecsAnimationEasing;
  loop?: boolean;
  completionEvent?: string;
};

export type SpecsAnimationTrackTarget =
  | "transform.position.x"
  | "transform.position.y"
  | "transform.position.z"
  | "transform.scale.x"
  | "transform.scale.y"
  | "transform.scale.z"
  | "transform.rotation.x"
  | "transform.rotation.y"
  | "transform.rotation.z"
  | "material.opacity";

export type SpecsAnimationTrackPlan = {
  target: SpecsAnimationTrackTarget;
  from: "current";
  to: number;
};

export type SpecsNativeAnimationPlan = {
  engine: "AnimationPlayer";
  backendPackage: Extract<SpecsUpstreamPackageName, "AnimationExamples">;
  durationSeconds: number;
  delaySeconds: number;
  easing: SpecsAnimationEasing;
  playbackMode: "single" | "loop";
  completionEvent: string;
  tracks: SpecsAnimationTrackPlan[];
};

const PROPERTY_TARGETS: Record<
  SpecsViroAnimationProperty,
  SpecsAnimationTrackTarget
> = {
  positionX: "transform.position.x",
  positionY: "transform.position.y",
  positionZ: "transform.position.z",
  scaleX: "transform.scale.x",
  scaleY: "transform.scale.y",
  scaleZ: "transform.scale.z",
  rotateX: "transform.rotation.x",
  rotateY: "transform.rotation.y",
  rotateZ: "transform.rotation.z",
  opacity: "material.opacity",
};

/**
 * Compiles the Viro-style target-property animation model into a plan for
 * Lens Studio AnimationCurve/AnimationPropertyTrack/AnimationPlayer.
 *
 * The Lens runtime resolves each track's current value at playback time,
 * preserving Viro's "animate from current state to target state" semantics.
 */
export function compileViroAnimationForSpecs(
  definition: SpecsViroAnimationDefinition
): SpecsNativeAnimationPlan {
  if (!Number.isFinite(definition.durationMs) || definition.durationMs < 0) {
    throw new Error("Specs animation durationMs must be a finite non-negative number.");
  }

  const delayMs = definition.delayMs ?? 0;
  if (!Number.isFinite(delayMs) || delayMs < 0) {
    throw new Error("Specs animation delayMs must be a finite non-negative number.");
  }

  const tracks: SpecsAnimationTrackPlan[] = [];

  for (const [property, value] of Object.entries(definition.properties) as [
    SpecsViroAnimationProperty,
    number,
  ][]) {
    if (!Number.isFinite(value)) {
      throw new Error(`Specs animation property ${property} must be finite.`);
    }

    tracks.push({
      target: PROPERTY_TARGETS[property],
      from: "current",
      to: value,
    });
  }

  if (tracks.length === 0) {
    throw new Error("Specs animation requires at least one target property.");
  }

  return {
    engine: "AnimationPlayer",
    backendPackage: "AnimationExamples",
    durationSeconds: definition.durationMs / 1000,
    delaySeconds: delayMs / 1000,
    easing: definition.easing ?? "linear",
    playbackMode: definition.loop ? "loop" : "single",
    completionEvent: definition.completionEvent ?? "viro-animation-complete",
    tracks,
  };
}

export interface SpecsAnimationRuntime {
  play(
    nodeId: string,
    plan: SpecsNativeAnimationPlan
  ): Promise<void> | void;
  stop?(nodeId: string): Promise<void> | void;
}
