/**
 * Placement UX state machine (viro `docs/ux/handoff/placement.md`): reticle on
 * the WorldQuery hit, surface tint by classification, pinch to confirm, look
 * away for 1.5 s to cancel.
 *
 * Portable: the Lens side feeds it hits (from a WorldQuery `HitTestSession`,
 * about 5 Hz) and pinches, and renders the {@linkcode ViroSpecsReticleView} it
 * returns. Units are meters (the Lens adapter converts from centimeters) and
 * milliseconds from the caller's clock.
 *
 * Dependency-free and free of Lens globals.
 */
import { formatViroSpecsCopy, type ViroSpecsCopyKey } from "./ViroSpecsExperienceCopy";
import { viroSpecsAngleToMeters, type ViroSpecsSpatialTokens } from "./ViroSpecsExperienceTokens";

type Vec3 = [number, number, number];

/** Surface classes the reticle tints. `unknown` disables placement. */
export type ViroSpecsSurfaceClass = "floor" | "table" | "wall" | "seat" | "ceiling" | "unknown";

/** One hit from WorldQuery, in meters, relative to the wearer at the origin. */
export type ViroSpecsPlacementHit = {
  readonly position: Vec3;
  /** Unit surface normal. */
  readonly normal: Vec3;
  /**
   * WorldQuery's own classification. On SPECS it only reports `ground` (with
   * the experimental classification option) or nothing; the other classes are
   * derived from the normal and height by {@linkcode classifyViroSpecsSurface}.
   */
  readonly classification?: "ground" | "none";
};

/**
 * What the session knows about the room. `floorY` comes from an earlier
 * `ground` hit; without it, table and seat cannot be told apart and both read
 * as `table`.
 */
export type ViroSpecsSurfaceContext = {
  readonly floorY?: number;
};

/**
 * Classifies a hit. Ground from WorldQuery is `floor`. Otherwise by normal:
 * pointing sideways is `wall`, pointing down is `ceiling`, pointing up is a
 * horizontal surface whose class depends on its height above a known floor:
 * under 0.2 m `floor`, 0.3-0.6 m `seat`, 0.6-1.2 m `table`. Anything else,
 * including a sloped surface, is `unknown`. Thresholds are starting values,
 * not measured.
 */
export function classifyViroSpecsSurface(hit: ViroSpecsPlacementHit, context: ViroSpecsSurfaceContext = {}): ViroSpecsSurfaceClass {
  if (hit.classification === "ground") return "floor";
  const up = hit.normal[1];
  if (up < -0.8) return "ceiling";
  if (Math.abs(up) < 0.3) return "wall";
  if (up < 0.85) return "unknown";
  if (context.floorY === undefined) return "table";
  const height = hit.position[1] - context.floorY;
  if (height < 0.2) return "floor";
  if (height >= 0.3 && height < 0.6) return "seat";
  if (height >= 0.6 && height <= 1.2) return "table";
  return "unknown";
}

/** Session phases, as in the handoff's states table. */
export type ViroSpecsPlacementPhase = "searching" | "aiming" | "countdown" | "confirmed" | "cancelled";

/** What the Lens adapter draws this frame. */
export type ViroSpecsReticleView = {
  readonly phase: ViroSpecsPlacementPhase;
  /** False while searching and after confirm/cancel settle. */
  readonly visible: boolean;
  readonly position?: Vec3;
  readonly normal?: Vec3;
  /** Ring diameter in meters: `input.reticleDeg` at the hit distance. */
  readonly diameterMeters: number;
  /** Ring color: `color.focus`, or `color.textMuted` on an invalid surface, `color.success` once placed. */
  readonly ringColor: string;
  /** Tint disc color, or undefined for unknown surfaces (reticle only). */
  readonly tintColor?: string;
  readonly tintOpacity: number;
  readonly surface: ViroSpecsSurfaceClass;
  /** True when a pinch now would place. */
  readonly canPlace: boolean;
  /** Label above the reticle, from the copy table. */
  readonly label: string;
  /** Second line, "Look away to cancel", shown once per session. */
  readonly hint?: string;
  /** 0..1 of the look-away countdown drained; 0 when not counting. */
  readonly countdown: number;
  readonly accessibilityLabel: string;
};

/** Result of a pinch. */
export type ViroSpecsPlacementResult =
  | { readonly placed: true; readonly position: Vec3; readonly normal: Vec3; readonly surface: ViroSpecsSurfaceClass }
  | { readonly placed: false };

/** Options for {@linkcode ViroSpecsPlacementSession}. */
export type ViroSpecsPlacementOptions = {
  readonly tokens: ViroSpecsSpatialTokens;
  /** Reduced motion: the countdown is shown as the word "Cancelling" instead of a draining ring. */
  readonly reducedMotion?: boolean;
  /** Called with the label key each time the session places or cancels. */
  readonly onSettled?: (result: "confirmed" | "cancelled") => void;
};

function length(v: Vec3): number {
  return Math.sqrt(v[0] * v[0] + v[1] * v[1] + v[2] * v[2]);
}

const SURFACE_COPY: Record<Exclude<ViroSpecsSurfaceClass, "unknown">, ViroSpecsCopyKey> = {
  floor: "surface.floor",
  table: "surface.table",
  wall: "surface.wall",
  seat: "surface.seat",
  ceiling: "surface.ceiling",
};

/**
 * One placement attempt. Feed it every WorldQuery result with
 * {@linkcode update}, call {@linkcode pinch} on pinch release, and render
 * {@linkcode view}. Look-away: no valid hit (no surface, unknown surface, or
 * outside the 0.6-3.0 m band) for `input.lookAwayCancelMs` without a break.
 * Any valid hit resets the timer.
 */
export class ViroSpecsPlacementSession {
  private phase: ViroSpecsPlacementPhase = "searching";
  private lastHit: ViroSpecsPlacementHit | undefined;
  private lastValid = false;
  private surface: ViroSpecsSurfaceClass = "unknown";
  private labelSurface: ViroSpecsSurfaceClass = "unknown";
  private labelChangedAtMs = -Infinity;
  private invalidSinceMs: number | undefined;
  private nowMs = 0;
  private floorY: number | undefined;
  private hintShown = false;
  private hintConsumed = false;
  private placed: { position: Vec3; normal: Vec3 } | undefined;

  constructor(private readonly options: ViroSpecsPlacementOptions) {}

  /** Current phase. */
  get currentPhase(): ViroSpecsPlacementPhase {
    return this.phase;
  }

  /** Pose of the confirmed placement, or undefined. */
  get placedPose(): { readonly position: Vec3; readonly normal: Vec3 } | undefined {
    return this.placed;
  }

  /** Starts a new attempt (Place again). The first-time hint does not return after a cancel. */
  restart(): void {
    this.phase = "searching";
    this.lastHit = undefined;
    this.lastValid = false;
    this.invalidSinceMs = undefined;
    this.placed = undefined;
  }

  /**
   * Feeds one hit-test result (or `null` for no hit) at `nowMs`. Returns the
   * phase after the update.
   */
  update(hit: ViroSpecsPlacementHit | null, nowMs: number): ViroSpecsPlacementPhase {
    this.nowMs = nowMs;
    if (this.phase === "confirmed" || this.phase === "cancelled") return this.phase;
    if (hit && hit.classification === "ground") this.floorY = hit.position[1];
    const band = this.options.tokens.distance;
    const surface = hit ? classifyViroSpecsSurface(hit, this.floorY !== undefined ? { floorY: this.floorY } : {}) : "unknown";
    const distance = hit ? length(hit.position) : 0;
    const valid = hit !== null && surface !== "unknown" && distance >= band.minMeters && distance <= band.maxMeters;

    if (hit) this.lastHit = hit;
    this.surface = hit ? (valid ? surface : "unknown") : "unknown";
    // The label changes no faster than every motion.base to avoid flicker at
    // a table edge; the tint crossfades on its own.
    if (this.surface !== this.labelSurface && nowMs - this.labelChangedAtMs >= this.options.tokens.motion.baseMs) {
      this.labelSurface = this.surface;
      this.labelChangedAtMs = nowMs;
    }
    this.lastValid = valid;

    if (valid) {
      this.invalidSinceMs = undefined;
      this.phase = "aiming";
      if (!this.hintConsumed) this.hintShown = true;
      return this.phase;
    }
    if (this.phase === "searching") return this.phase;
    if (this.invalidSinceMs === undefined) this.invalidSinceMs = nowMs;
    if (nowMs - this.invalidSinceMs >= this.options.tokens.input.lookAwayCancelMs) {
      this.phase = "cancelled";
      this.hintConsumed = true;
      this.hintShown = false;
      this.options.onSettled?.("cancelled");
    } else {
      this.phase = "countdown";
    }
    return this.phase;
  }

  /**
   * Pinch release. Places when the latest hit is valid (also during the
   * countdown, when the hit became valid again); otherwise does nothing.
   */
  pinch(): ViroSpecsPlacementResult {
    if (this.phase === "confirmed" || this.phase === "cancelled") return { placed: false };
    const hit = this.lastHit;
    if (!this.lastValid || !hit) return { placed: false };
    this.phase = "confirmed";
    this.placed = { position: hit.position, normal: hit.normal };
    if (this.hintShown) this.hintConsumed = true;
    this.hintShown = false;
    this.options.onSettled?.("confirmed");
    return { placed: true, position: hit.position, normal: hit.normal, surface: this.surface };
  }

  /** Cancels without waiting (for example when world-query degrades mid-countdown). */
  cancel(): void {
    if (this.phase === "confirmed" || this.phase === "cancelled") return;
    this.phase = "cancelled";
    this.options.onSettled?.("cancelled");
  }

  /** The reticle to draw now. */
  view(): ViroSpecsReticleView {
    const t = this.options.tokens;
    const hit = this.lastHit;
    const distance = hit ? Math.max(length(hit.position), 1e-6) : t.distance.defaultMeters;
    const diameterMeters = viroSpecsAngleToMeters(t.input.reticleDeg, distance);
    const countdown =
      this.phase === "countdown" && this.invalidSinceMs !== undefined
        ? Math.min(1, (this.nowMs - this.invalidSinceMs) / t.input.lookAwayCancelMs)
        : 0;
    const labelSurface = this.labelSurface;
    let label: string;
    switch (this.phase) {
      case "searching":
        label = formatViroSpecsCopy("placement.searching");
        break;
      case "confirmed":
        label = formatViroSpecsCopy("placement.confirmed");
        break;
      case "cancelled":
        label = formatViroSpecsCopy("placement.cancelled");
        break;
      case "countdown":
        label = this.options.reducedMotion === true ? formatViroSpecsCopy("placement.cancelling") : formatViroSpecsCopy("placement.surfaceUnknown");
        break;
      case "aiming":
        label =
          labelSurface === "unknown"
            ? formatViroSpecsCopy("placement.surfaceUnknown")
            : formatViroSpecsCopy("placement.surface", { surface: formatViroSpecsCopy(SURFACE_COPY[labelSurface]) });
        break;
    }
    const surfaceName = labelSurface === "unknown" ? "unknown surface" : formatViroSpecsCopy(SURFACE_COPY[labelSurface]);
    const visible = this.phase === "aiming" || this.phase === "countdown" || this.phase === "confirmed";
    const tintColor = this.surface === "unknown" || this.phase === "countdown" ? undefined : t.tint[this.surface];
    return {
      phase: this.phase,
      visible,
      ...(hit ? { position: hit.position, normal: hit.normal } : {}),
      diameterMeters,
      ringColor: this.phase === "confirmed" ? t.color.success : this.lastValid ? t.color.focus : t.color.textMuted,
      ...(tintColor !== undefined ? { tintColor } : {}),
      tintOpacity: t.tint.opacity,
      surface: this.surface,
      canPlace: (this.phase === "aiming" || this.phase === "countdown") && this.lastValid,
      label,
      ...(this.hintShown && (this.phase === "aiming" || this.phase === "countdown") ? { hint: formatViroSpecsCopy("placement.cancelHint") } : {}),
      countdown: this.options.reducedMotion === true ? 0 : countdown,
      accessibilityLabel: formatViroSpecsCopy("placement.a11yLabel", { surface: surfaceName }),
    };
  }
}
