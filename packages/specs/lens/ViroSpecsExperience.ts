/**
 * Experience layer for the Specs scene host (WS4): what the wearer sees around
 * a scene while it loads, when a capability is missing, and when something
 * fails, plus PanelButton states, gaze dwell and the runtime comfort clamps.
 *
 * {@linkcode ViroSpecsExperienceController} turns host facts (the scene
 * controller's lifecycle and asset progress, host diagnostics, the capability
 * report, wearer preferences) into a {@linkcode ViroSpecsExperienceView} that
 * the Lens adapter (`ViroSpecsExperienceLensView.ts`) draws. Nothing here
 * touches Lens APIs, so Node tests drive it with the mock scene host.
 *
 * Two words collide with the scene controller: its `degraded` lifecycle means
 * "an asset is missing and shows a placeholder", which this layer presents as
 * a node error (`error.asset`). This layer's degraded state means "a
 * capability is missing".
 *
 * Dependency-free and free of Lens globals.
 */
import { formatViroSpecsCopy, type ViroSpecsCopyKey } from "./ViroSpecsExperienceCopy";
import {
  resolveViroSpecsTokens,
  viroSpecsAngleToMeters,
  viroSpecsMetersToAngle,
  VIRO_SPECS_LENS_DEFAULT_THEME,
  VIRO_SPECS_LENS_TEXT_EM_METERS_PER_SIZE,
  type ViroSpecsButtonAuthoredState,
  type ViroSpecsButtonVisualState,
  type ViroSpecsComponentSpec,
  type ViroSpecsExperiencePreferences,
  type ViroSpecsSpatialTokens,
  type ViroSpecsTheme,
} from "./ViroSpecsExperienceTokens";
import {
  createViroSpecsHostDiagnostic,
  type ViroSpecsHostDiagnostic,
  type ViroSpecsHostDiagnosticCode,
  type ViroSpecsHostDiagnostics,
  type ViroSpecsSubscription,
} from "./ViroSpecsHostDiagnostics";
import type { ViroSpecsCapabilityState, ViroSpecsHostInteraction } from "./ViroSpecsProtocol";
import type { ViroSpecsSceneLifecycle } from "./ViroSpecsSceneController";

type Vec3 = [number, number, number];

/**
 * Time in loading after which `loading.slow` replaces the progress line.
 * The pack targets a first frame under 2 s; WS3 has not measured it on device
 * yet, so this is the target itself, not a measurement.
 */
export const VIRO_SPECS_SLOW_LOADING_MS = 2000;

/** What a scene needs, so the layer knows what to hide and when gaze-only is enough. */
export type ViroSpecsSceneRequirements = {
  /** The scene places content on surfaces (world-query, surface-placement). */
  readonly placement: boolean;
  /** Every function has a gaze path (dwell, step buttons). False shows the permission panel instead. */
  readonly gazeOnly: boolean;
};

/** How the wearer selects. */
export type ViroSpecsInputMode = "hands" | "gaze";

/** Loading indicator style. Reduced motion never rotates. */
export type ViroSpecsLoadingIndicator = "ring-arc" | "ring-spin" | "arc-static" | "dots";

/** Central loading panel, or nothing. */
export type ViroSpecsLoadingView =
  | { readonly visible: false }
  | {
      readonly visible: true;
      readonly title: string;
      readonly line: string;
      /** 0..1, or undefined when the asset count is unknown. */
      readonly progress?: number;
      readonly indicator: ViroSpecsLoadingIndicator;
      readonly accessibilityLabel: string;
    };

/** One-line degraded notice. */
export type ViroSpecsNoticeView = {
  readonly capability: string;
  readonly state: ViroSpecsCapabilityState;
  readonly message: string;
  readonly dismissLabel: string;
  /** Builder mode only: `hand-tracking: permission-required`. */
  readonly builderLine?: string;
};

/** Error panel kinds from viro `docs/ux/copy.md#error`. */
export type ViroSpecsErrorKind = "asset" | "scene" | "scene-no-fallback" | "transport";

/** Action the wearer can take on a panel. Exactly one per panel. */
export type ViroSpecsPanelAction = "retry" | "close" | "dismiss";

/** Error panel. Never zero actions; never a dead lens. */
export type ViroSpecsErrorPanelView = {
  readonly kind: ViroSpecsErrorKind;
  readonly title: string;
  readonly message: string;
  readonly actionLabel: string;
  readonly action: ViroSpecsPanelAction;
  /** `{code} ({nodeId})` lines, de-duplicated. Never translated. */
  readonly diagnosticLines: readonly string[];
  /** Nodes a Retry reloads. */
  readonly nodeIds: readonly string[];
};

/** Hand tracking permission panel for scenes without a gaze path. */
export type ViroSpecsPermissionPanelView = {
  readonly title: string;
  readonly body: string;
  readonly actionLabel: string;
};

/** UI the experience layer hides, never shows disabled (A-check D2). */
export type ViroSpecsHiddenUi = {
  readonly placement: boolean;
  readonly drag: boolean;
  readonly pinchHints: boolean;
};

/** Gaze-only replacements the host adds. */
export type ViroSpecsGazeControls = {
  /** Move left/right/closer/away under manipulable models. */
  readonly moveButtons: boolean;
  /** Scroll up/down at list edges. */
  readonly scrollButtons: boolean;
  /** "Place here" under the reticle label. */
  readonly placeHere: boolean;
};

/** Everything the Lens adapter draws around the scene. */
export type ViroSpecsExperienceView = {
  readonly loading: ViroSpecsLoadingView;
  /** Scene content and interactables appear only when true (A-check L4). */
  readonly sceneVisible: boolean;
  readonly notice?: ViroSpecsNoticeView;
  readonly errorPanel?: ViroSpecsErrorPanelView;
  readonly permissionPanel?: ViroSpecsPermissionPanelView;
  readonly inputMode: ViroSpecsInputMode;
  readonly hidden: ViroSpecsHiddenUi;
  readonly gazeControls: ViroSpecsGazeControls;
  /** Placement is unsupported: put the model 1.5 m in front of the wearer. */
  readonly placeInFront: boolean;
  readonly preferences: ViroSpecsExperiencePreferences;
  /** Tokens with the preferences applied. */
  readonly tokens: ViroSpecsSpatialTokens;
};

/** Options for {@linkcode ViroSpecsExperienceController}. */
export type ViroSpecsExperienceOptions = {
  readonly requirements: ViroSpecsSceneRequirements;
  /** Diagnostics channel, usually the scene controller's. */
  readonly diagnostics: ViroSpecsHostDiagnostics;
  readonly nowMs: () => number;
  /** Shows unverified notices and diagnostic lines under notices. Debug builds only. */
  readonly builderMode?: boolean;
  /** @default {@linkcode VIRO_SPECS_SLOW_LOADING_MS} */
  readonly slowLoadingMs?: number;
  /** App preferences; Snap OS exposes no system setting for either (unverified). */
  readonly preferences?: ViroSpecsExperiencePreferences;
};

/** What {@linkcode ViroSpecsExperienceController.attach} reads from a scene controller or its Lens host. */
export type ExperienceSource = {
  readonly lifecycle: ViroSpecsSceneLifecycle;
  readonly assetProgress: { readonly pending: number; readonly total: number };
  readonly committedScene: { readonly theme?: ViroSpecsTheme } | null;
  addOnLifecycleListener(listener: (state: ViroSpecsSceneLifecycle) => void): ViroSpecsSubscription;
};

const PLACEMENT_CAPABILITIES = ["world-query", "surface-placement"];
const HAND_CAPABILITIES = ["hand-tracking", "pinch"];

function isDegraded(state: ViroSpecsCapabilityState | undefined): state is Exclude<ViroSpecsCapabilityState, "supported"> {
  return state !== undefined && state !== "supported";
}

/**
 * Drives the experience view from host facts. Call {@linkcode tick} once per
 * frame (or from a timer) so time-based rules (loading flash, slow loading)
 * advance.
 *
 * @example
 * const experience = new ViroSpecsExperienceController({ requirements: { placement: false, gazeOnly: true }, diagnostics: controller.diagnostics, nowMs: () => getTime() * 1000 });
 * experience.attach(controller);                    // lifecycle, assets, diagnostics
 * experience.setCapabilities(createSpecsLensCapabilityReport());
 * experience.addOnViewListener((view) => lensView.render(view));
 */
export class ViroSpecsExperienceController {
  private theme: ViroSpecsTheme = VIRO_SPECS_LENS_DEFAULT_THEME;
  private preferences: ViroSpecsExperiencePreferences;
  private capabilities: Record<string, ViroSpecsCapabilityState> = {};
  private lifecycle: ViroSpecsSceneLifecycle = "empty";
  private progress = { pending: 0, total: 0 };
  private loadingSinceMs: number | undefined;
  private hadReadyScene = false;
  private nodeErrors = new Map<string, string>();
  private sceneError: { kind: "scene" | "scene-no-fallback"; line: string } | undefined;
  private transportLost = false;
  private dismissedErrorKey: string | undefined;
  private dismissedNotices = new Set<string>();
  private reportedDegraded = new Map<string, ViroSpecsCapabilityState>();
  private permissionClosed = false;
  private lastInputMode: ViroSpecsInputMode = "hands";
  private readonly listeners = new Set<(view: ViroSpecsExperienceView) => void>();
  private readonly subscriptions: ViroSpecsSubscription[] = [];
  private cached: ViroSpecsExperienceView | undefined;
  private source: ExperienceSource | undefined;
  private clamped = new Set<string>();

  constructor(private readonly options: ViroSpecsExperienceOptions) {
    this.preferences = options.preferences ?? VIRO_SPECS_LENS_DEFAULT_THEME.preferences;
  }

  /**
   * Subscribes to a scene controller: lifecycle, asset progress and host
   * diagnostics. Returns the subscription; {@linkcode dispose} also removes it.
   */
  attach(controller: ExperienceSource): ViroSpecsSubscription {
    this.source = controller;
    const sync = (state: ViroSpecsSceneLifecycle) => {
      const theme = controller.committedScene?.theme;
      if (theme !== undefined && theme !== this.theme) this.setTheme(theme);
      this.onSceneLifecycle(state, controller.assetProgress);
    };
    const lifecycle = controller.addOnLifecycleListener(sync);
    const diagnostics = this.options.diagnostics.addOnDiagnosticListener((d) => {
      this.onHostDiagnostic(d);
      this.onSceneLifecycle(controller.lifecycle, controller.assetProgress);
    });
    sync(controller.lifecycle);
    const subscription = {
      remove: () => {
        lifecycle.remove();
        diagnostics.remove();
        if (this.source === controller) this.source = undefined;
      },
    };
    this.subscriptions.push(subscription);
    return subscription;
  }

  /** Theme from the scene document. The authored preferences apply unless the app set its own. */
  setTheme(theme: ViroSpecsTheme): void {
    this.theme = theme;
    if (this.options.preferences === undefined) this.preferences = theme.preferences;
    this.emit();
  }

  /** High contrast and reduced motion. Applies on the next view; no restart. */
  setPreferences(preferences: ViroSpecsExperiencePreferences): void {
    this.preferences = preferences;
    this.emit();
  }

  /** Current capability report. Changes switch input mode and hidden UI without a restart (A-check D3). */
  setCapabilities(report: Readonly<Record<string, ViroSpecsCapabilityState>>): void {
    this.capabilities = { ...report };
    for (const [capability, state] of Object.entries(this.capabilities)) {
      if (!isDegraded(state)) {
        this.reportedDegraded.delete(capability);
        continue;
      }
      if (this.reportedDegraded.get(capability) === state) continue;
      this.reportedDegraded.set(capability, state);
      this.report("VS5021", capability + " is " + state + "; hidden: " + this.hiddenFor(capability, state).join(", ") + ".");
    }
    const mode = this.inputMode();
    if (mode !== this.lastInputMode) {
      this.lastInputMode = mode;
      if (mode === "gaze") this.report("VS5024", "Hand tracking is " + (this.handState() ?? "unavailable") + "; gaze dwell selects after " + this.theme.tokens.input.gazeDwellMs + " ms.");
    }
    this.emit();
  }

  /** Scene controller lifecycle and asset counts. {@linkcode attach} calls this for you. */
  onSceneLifecycle(lifecycle: ViroSpecsSceneLifecycle, progress: { readonly pending: number; readonly total: number }): void {
    const now = this.options.nowMs();
    if (lifecycle === "loading" && this.lifecycle !== "loading") this.loadingSinceMs = now;
    if (lifecycle !== "loading") this.loadingSinceMs = undefined;
    // A scene committed after a rejected first scene: the rejection no longer
    // applies. (A rejected update on a live scene keeps its panel until Close.)
    if (this.lifecycle === "error" && lifecycle !== "error" && lifecycle !== "empty") this.sceneError = undefined;
    if (lifecycle === "ready" || lifecycle === "degraded") {
      this.hadReadyScene = true;
      if (lifecycle === "ready") this.nodeErrors.clear();
    }
    if (lifecycle === "error") this.sceneError = { kind: this.hadReadyScene ? "scene" : "scene-no-fallback", line: this.sceneError?.line ?? "" };
    this.lifecycle = lifecycle;
    this.progress = { pending: progress.pending, total: progress.total };
    this.emit();
  }

  /**
   * Host diagnostics: `VS5003` marks a node error (placeholder shown),
   * `VS5002`/`VS5005` a rejected scene. Others are ignored here.
   */
  onHostDiagnostic(diagnostic: ViroSpecsHostDiagnostic): void {
    const line = diagnostic.code + (diagnostic.nodeId !== undefined ? " (" + diagnostic.nodeId + ")" : "");
    if (diagnostic.code === "VS5003" && diagnostic.nodeId !== undefined) {
      this.nodeErrors.set(diagnostic.nodeId, line);
      this.dismissedErrorKey = undefined;
    } else if (diagnostic.code === "VS5002" || diagnostic.code === "VS5005" || diagnostic.code === "VS5001") {
      this.sceneError = { kind: this.hadReadyScene || this.lifecycle === "ready" || this.lifecycle === "degraded" ? "scene" : "scene-no-fallback", line };
      this.dismissedErrorKey = undefined;
    } else {
      return;
    }
    this.emit();
  }

  /** The app transport dropped (`false`) or came back (`true`). The scene keeps its last state. */
  setTransportConnected(connected: boolean): void {
    this.transportLost = !connected;
    if (!connected) this.dismissedErrorKey = undefined;
    this.emit();
  }

  /** Got it on the degraded notice. That capability's notice does not return this session. */
  dismissNotice(): void {
    const notice = this.view().notice;
    if (notice) this.dismissedNotices.add(notice.capability);
    this.emit();
  }

  /**
   * The error panel's one action. Retry clears the node errors and returns
   * their IDs for the host to reload; Close and Got it dismiss the panel.
   * Closing a no-fallback scene error keeps the panel (never a blank view);
   * the wearer exits with the system gesture.
   */
  activateErrorAction(): { readonly action: ViroSpecsPanelAction; readonly nodeIds: readonly string[] } | undefined {
    const panel = this.view().errorPanel;
    if (!panel) return undefined;
    if (panel.action === "retry") {
      const ids = [...panel.nodeIds];
      this.nodeErrors.clear();
      this.emit();
      return { action: "retry", nodeIds: ids };
    }
    if (panel.kind === "scene-no-fallback") return { action: panel.action, nodeIds: [] };
    if (panel.kind === "transport") this.transportLost = false;
    else this.sceneError = undefined;
    this.dismissedErrorKey = panel.kind;
    this.emit();
    return { action: panel.action, nodeIds: [] };
  }

  /** Close on the permission panel. The scene stays on screen without input. */
  closePermissionPanel(): void {
    this.permissionClosed = true;
    this.emit();
  }

  /**
   * Advances time-based rules and re-reads the attached controller's asset
   * progress and theme, which change without a lifecycle event while assets
   * load and when a scene replaces another in the same state. Call every frame.
   */
  tick(): void {
    const source = this.source;
    if (source) {
      const theme = source.committedScene?.theme;
      if (theme !== undefined && theme !== this.theme) this.setTheme(theme);
      this.progress = { pending: source.assetProgress.pending, total: source.assetProgress.total };
    }
    this.emit();
  }

  /**
   * Keeps a placement or drag position inside the comfort band (distance from
   * the wearer at the origin). Reports `VS5023` when it clamps.
   */
  clampToComfortBand(nodeId: string, position: Vec3): Vec3 {
    const band = this.theme.tokens.distance;
    const d = Math.sqrt(position[0] * position[0] + position[1] * position[1] + position[2] * position[2]);
    if (d >= band.minMeters && d <= band.maxMeters) {
      this.clamped.delete(nodeId);
      return position;
    }
    // Reported once per excursion, not on every drag frame.
    const first = !this.clamped.has(nodeId);
    this.clamped.add(nodeId);
    if (d < 1e-9) {
      if (first) this.report("VS5023", nodeId + " was at the wearer; placed " + band.minMeters + " m ahead.", nodeId);
      return [0, 0, -band.minMeters];
    }
    const target = d < band.minMeters ? band.minMeters : band.maxMeters;
    const k = target / d;
    if (first) this.report("VS5023", nodeId + " would be " + d.toFixed(2) + " m away; stopped at " + target + " m.", nodeId);
    return [position[0] * k, position[1] * k, position[2] * k];
  }

  /**
   * Lens Text size for a text node at `distanceMeters`: `size` unchanged when it
   * is at least 1.2 degrees there, otherwise raised to the minimum with a
   * `VS5022` warning.
   */
  minimumTextSize(nodeId: string, size: number, distanceMeters: number): number {
    const t = resolveViroSpecsTokens(this.theme, this.preferences);
    const angle = viroSpecsMetersToAngle(size * VIRO_SPECS_LENS_TEXT_EM_METERS_PER_SIZE, distanceMeters);
    if (angle >= t.type.minAngleDeg) return size;
    const raised = Math.ceil((viroSpecsAngleToMeters(t.type.minAngleDeg, distanceMeters) / VIRO_SPECS_LENS_TEXT_EM_METERS_PER_SIZE) * 10) / 10;
    this.report("VS5022", nodeId + " was " + angle.toFixed(2) + " degrees at " + distanceMeters.toFixed(2) + " m; size " + size + " raised to " + raised + ".", nodeId);
    return raised;
  }

  /** Listens for view changes. The listener gets the current view immediately. */
  addOnViewListener(listener: (view: ViroSpecsExperienceView) => void): ViroSpecsSubscription {
    this.listeners.add(listener);
    listener(this.view());
    return { remove: () => this.listeners.delete(listener) };
  }

  /** Removes every subscription. Idempotent. */
  dispose(): void {
    for (const subscription of this.subscriptions.splice(0)) subscription.remove();
    this.listeners.clear();
  }

  /** The view for the current facts. */
  view(): ViroSpecsExperienceView {
    const tokens = resolveViroSpecsTokens(this.theme, this.preferences);
    const loading = this.loadingView(tokens);
    const sceneVisible = this.lifecycle === "ready" || this.lifecycle === "degraded" || (this.lifecycle === "error" && this.hadReadyScene);
    const placementState = this.worstState(PLACEMENT_CAPABILITIES);
    const handState = this.handState();
    const inputMode = this.inputMode();
    const dragUnsupported = isDegraded(this.capabilities["drag-manipulation"]);
    const hidden: ViroSpecsHiddenUi = {
      placement: this.options.requirements.placement && placementState === "unsupported",
      drag: inputMode === "gaze" || dragUnsupported,
      pinchHints: inputMode === "gaze",
    };
    const gaze = inputMode === "gaze";
    const permissionPanel =
      handState === "permission-required" && !this.options.requirements.gazeOnly && !this.permissionClosed
        ? {
            title: formatViroSpecsCopy("permission.handTracking.title"),
            body: formatViroSpecsCopy("permission.handTracking.body.noGaze"),
            actionLabel: formatViroSpecsCopy("permission.action.close"),
          }
        : undefined;
    const notice = this.noticeView(placementState, handState);
    const errorPanel = this.errorView(sceneVisible);
    return {
      loading,
      sceneVisible,
      ...(notice ? { notice } : {}),
      ...(errorPanel ? { errorPanel } : {}),
      ...(permissionPanel ? { permissionPanel } : {}),
      inputMode,
      hidden,
      gazeControls: {
        moveButtons: gaze || dragUnsupported,
        scrollButtons: gaze,
        placeHere: gaze && this.options.requirements.placement && !hidden.placement,
      },
      placeInFront: hidden.placement,
      preferences: this.preferences,
      tokens,
    };
  }

  private loadingView(tokens: ViroSpecsSpatialTokens): ViroSpecsLoadingView {
    if (this.lifecycle !== "loading" || this.loadingSinceMs === undefined) return { visible: false };
    const elapsed = this.options.nowMs() - this.loadingSinceMs;
    // Everything cached: skip the panel so it does not flash.
    if (elapsed < tokens.motion.fastMs) return { visible: false };
    const { pending, total } = this.progress;
    const known = total > 0;
    const done = Math.max(0, total - pending);
    const progress = known ? done / total : undefined;
    const slow = elapsed >= (this.options.slowLoadingMs ?? VIRO_SPECS_SLOW_LOADING_MS);
    const reduced = this.preferences.reducedMotion;
    const indicator: ViroSpecsLoadingIndicator = known ? (reduced ? "arc-static" : "ring-arc") : reduced ? "dots" : "ring-spin";
    const percent = progress === undefined ? 0 : Math.round(progress * 100);
    return {
      visible: true,
      title: formatViroSpecsCopy("loading.title"),
      line: slow ? formatViroSpecsCopy("loading.slow") : known ? formatViroSpecsCopy("loading.progress", { done, total }) : "",
      ...(progress !== undefined ? { progress } : {}),
      indicator,
      accessibilityLabel: formatViroSpecsCopy("loading.a11yLabel", { percent }),
    };
  }

  private noticeView(
    placementState: ViroSpecsCapabilityState | undefined,
    handState: ViroSpecsCapabilityState | undefined
  ): ViroSpecsNoticeView | undefined {
    // Placement beats hand tracking: it changes the scene layout.
    const candidates: { capability: string; state: ViroSpecsCapabilityState; key: ViroSpecsCopyKey }[] = [];
    if (this.options.requirements.placement && isDegraded(placementState)) {
      if (placementState === "unsupported") candidates.push({ capability: "world-query", state: placementState, key: "degraded.worldQuery.unsupported" });
      else if (placementState === "temporarily-unavailable") candidates.push({ capability: "world-query", state: placementState, key: "degraded.worldQuery.unavailable" });
    }
    if (handState === "permission-required" && this.options.requirements.gazeOnly) {
      candidates.push({ capability: "hand-tracking", state: handState, key: "degraded.handTracking.permission" });
    } else if (handState === "temporarily-unavailable") {
      candidates.push({ capability: "hand-tracking", state: handState, key: "degraded.handTracking.unavailable" });
    }
    if (this.options.builderMode === true) {
      for (const [capability, state] of Object.entries(this.capabilities)) {
        if (state === "unverified") candidates.push({ capability, state, key: "degraded.unverified" });
      }
    }
    const chosen = candidates.find((c) => !this.dismissedNotices.has(c.capability));
    if (!chosen) return undefined;
    return {
      capability: chosen.capability,
      state: chosen.state,
      message: formatViroSpecsCopy(chosen.key),
      dismissLabel: formatViroSpecsCopy("degraded.dismiss"),
      ...(this.options.builderMode === true ? { builderLine: chosen.capability + ": " + chosen.state } : {}),
    };
  }

  private errorView(sceneVisible: boolean): ViroSpecsErrorPanelView | undefined {
    if (this.sceneError && (this.sceneError.kind === "scene-no-fallback" || this.dismissedErrorKey !== "scene")) {
      const kind = this.sceneError.kind;
      const base = kind === "scene" ? "error.scene" : "error.sceneNoFallback";
      return {
        kind,
        title: formatViroSpecsCopy((base + ".title") as ViroSpecsCopyKey),
        message: formatViroSpecsCopy((base + ".message") as ViroSpecsCopyKey),
        actionLabel: formatViroSpecsCopy((base + ".action") as ViroSpecsCopyKey),
        action: "close",
        diagnosticLines: this.sceneError.line !== "" ? [this.sceneError.line] : [],
        nodeIds: [],
      };
    }
    // Node errors wait until the scene is visible, so the panel is not covered by the scene coming in.
    if (this.nodeErrors.size > 0 && sceneVisible) {
      const n = this.nodeErrors.size;
      return {
        kind: "asset",
        title: n === 1 ? formatViroSpecsCopy("error.asset.title") : formatViroSpecsCopy("error.assetMany.title", { n }),
        message: formatViroSpecsCopy("error.asset.message"),
        actionLabel: formatViroSpecsCopy("error.asset.action"),
        action: "retry",
        diagnosticLines: Array.from(new Set(this.nodeErrors.values())),
        nodeIds: Array.from(this.nodeErrors.keys()),
      };
    }
    if (this.transportLost && this.dismissedErrorKey !== "transport") {
      return {
        kind: "transport",
        title: formatViroSpecsCopy("error.transport.title"),
        message: formatViroSpecsCopy("error.transport.message"),
        actionLabel: formatViroSpecsCopy("error.transport.action"),
        action: "dismiss",
        diagnosticLines: [],
        nodeIds: [],
      };
    }
    return undefined;
  }

  private worstState(capabilities: readonly string[]): ViroSpecsCapabilityState | undefined {
    const order: ViroSpecsCapabilityState[] = ["unsupported", "permission-required", "temporarily-unavailable", "unverified", "supported"];
    let worst: ViroSpecsCapabilityState | undefined;
    for (const name of capabilities) {
      const state = this.capabilities[name];
      if (state === undefined) continue;
      if (worst === undefined || order.indexOf(state) < order.indexOf(worst)) worst = state;
    }
    return worst;
  }

  private handState(): ViroSpecsCapabilityState | undefined {
    return this.worstState(HAND_CAPABILITIES);
  }

  private inputMode(): ViroSpecsInputMode {
    const state = this.handState();
    return state === "permission-required" || state === "temporarily-unavailable" || state === "unsupported" ? "gaze" : "hands";
  }

  private hiddenFor(capability: string, state: ViroSpecsCapabilityState): string[] {
    if (PLACEMENT_CAPABILITIES.includes(capability)) return state === "unsupported" ? ["reticle", "surface tint", "placement label"] : ["nothing; searching continues"];
    if (HAND_CAPABILITIES.includes(capability)) return ["pinch hints", "drag"];
    if (capability === "drag-manipulation") return ["drag"];
    return ["nothing"];
  }

  private report(code: ViroSpecsHostDiagnosticCode, message: string, nodeId?: string): void {
    this.options.diagnostics.report(
      createViroSpecsHostDiagnostic(code, "experience", message, nodeId !== undefined ? { nodeId } : {})
    );
  }

  private emit(): void {
    const view = this.view();
    const previous = this.cached;
    this.cached = view;
    if (previous !== undefined && JSON.stringify(previous) === JSON.stringify(view)) return;
    for (const listener of Array.from(this.listeners)) listener(view);
  }
}

/** Visual properties of one PanelButton state, resolved from tokens. */
export type ViroSpecsButtonVisual = {
  readonly state: ViroSpecsButtonVisualState;
  readonly fill: string;
  readonly fillOpacity: number;
  readonly border: string;
  readonly borderOpacity: number;
  readonly borderWidthDeg: number;
  /** Focus ring around the button. */
  readonly ring: boolean;
  readonly labelColor: string;
  /** Visible text: the label, or "Working" while loading. */
  readonly labelText: string;
  /** Shape cue so color is never the only signal (WCAG 1.4.1). */
  readonly glyph: "check" | "error" | "none";
  /** Offset toward the wearer, meters. */
  readonly depthMeters: number;
  readonly scale: number;
  /** Transition duration for this state change. */
  readonly transitionMs: number;
  /** Accessible name: label plus ", selected" or ", unavailable". */
  readonly accessibleName: string;
  /** False for disabled and loading: no hover, no haptic, pinches ignored. */
  readonly accepts: boolean;
};

/**
 * Resolves the token table in viro `docs/ux/spatial-tokens.md#panelbutton`
 * for an authored state plus host hover/pressed.
 */
export function resolveViroSpecsButtonVisual(
  label: string,
  authored: ViroSpecsButtonAuthoredState,
  interaction: { readonly hovered: boolean; readonly pressed: boolean },
  tokens: ViroSpecsSpatialTokens
): ViroSpecsButtonVisual {
  const c = tokens.color;
  const accepts = authored !== "disabled" && authored !== "loading";
  const state: ViroSpecsButtonVisualState = !accepts
    ? authored
    : interaction.pressed
      ? "pressed"
      : interaction.hovered
        ? "hover"
        : authored;
  const glyph = authored === "selected" ? "check" : authored === "error" ? "error" : "none";
  const accessibleName =
    label + (authored === "selected" ? formatViroSpecsCopy("a11y.selected") : authored === "disabled" ? formatViroSpecsCopy("a11y.unavailable") : "");
  const base = {
    state,
    fillOpacity: 1,
    borderOpacity: 1,
    labelColor: c.text,
    labelText: label,
    glyph,
    transitionMs: tokens.motion.fastMs,
    accessibleName,
    accepts,
  } as const;
  switch (state) {
    case "idle":
      return { ...base, fill: c.surfaceRaised, border: c.border, borderWidthDeg: tokens.shape.borderWidthDeg, ring: false, depthMeters: tokens.depth.raisedMeters, scale: 1 };
    case "hover":
      return {
        ...base,
        fill: authored === "selected" ? c.selectedFill : c.surfaceRaised,
        border: c.borderStrong,
        borderWidthDeg: tokens.shape.borderWidthFocusDeg,
        ring: true,
        depthMeters: tokens.depth.hoverMeters,
        scale: tokens.motion.hoverScale,
      };
    case "pressed":
      return { ...base, fill: c.surfacePressed, border: c.focus, borderWidthDeg: tokens.shape.borderWidthFocusDeg, ring: true, depthMeters: tokens.depth.raisedMeters, scale: 1 };
    case "selected":
      return { ...base, fill: c.selectedFill, border: c.focus, borderWidthDeg: tokens.shape.borderWidthFocusDeg, ring: false, depthMeters: tokens.depth.raisedMeters, scale: 1 };
    case "disabled":
      return {
        ...base,
        fill: c.surface,
        border: c.border,
        borderOpacity: tokens.opacity.disabledBorder,
        borderWidthDeg: tokens.shape.borderWidthDeg,
        ring: false,
        labelColor: c.textDisabled,
        depthMeters: tokens.depth.baseMeters,
        scale: 1,
        transitionMs: 0,
      };
    case "loading":
      return {
        ...base,
        fill: c.surfaceRaised,
        border: c.border,
        borderWidthDeg: tokens.shape.borderWidthDeg,
        ring: false,
        labelText: formatViroSpecsCopy("button.loading"),
        depthMeters: tokens.depth.raisedMeters,
        scale: 1,
      };
    case "error":
      return { ...base, fill: c.surfaceRaised, border: c.error, borderWidthDeg: tokens.shape.borderWidthFocusDeg, ring: false, depthMeters: tokens.depth.raisedMeters, scale: 1, transitionMs: 0 };
  }
}

/** A press that committed: the action fires on release inside the target. */
export type ViroSpecsButtonCommit = { readonly nodeId: string; readonly source: ViroSpecsHostInteraction["source"] };

/**
 * Hover and press tracking for PanelButtons, from host interaction events.
 *
 * - select-start on a button presses it; the last select-start wins and
 *   cancels any other press (two hands on two targets).
 * - select-end on the pressed button commits; anywhere else, or `cancel`,
 *   returns it to idle with no action (WCAG 2.5.2).
 * - the press stays on its button when the hover target moves.
 * - disabled and loading buttons ignore everything (no hover, no haptic).
 *
 * `onHoverFeedback` fires once per hover-enter for the haptic/audio hook.
 */
export class ViroSpecsButtonTracker {
  private hovered = new Set<string>();
  private pressedId: string | undefined;
  private feedbackEnabled = true;

  constructor(
    private readonly authoredState: (nodeId: string) => ViroSpecsButtonAuthoredState | undefined,
    private readonly onHoverFeedback: (nodeId: string) => void = () => undefined
  ) {}

  /** The app can turn the haptic/audio hook off. */
  setFeedbackEnabled(enabled: boolean): void {
    this.feedbackEnabled = enabled;
  }

  /** Hover and press flags for one button. */
  interactionOf(nodeId: string): { readonly hovered: boolean; readonly pressed: boolean } {
    return { hovered: this.hovered.has(nodeId), pressed: this.pressedId === nodeId };
  }

  /** Feeds one host interaction. Returns the commit when a press completes. */
  handle(event: Pick<ViroSpecsHostInteraction, "nodeId" | "phase" | "source">): ViroSpecsButtonCommit | undefined {
    const state = this.authoredState(event.nodeId);
    if (state === undefined) {
      if (event.phase === "select-end" || event.phase === "cancel") this.pressedId = undefined;
      return undefined;
    }
    const accepts = state !== "disabled" && state !== "loading";
    switch (event.phase) {
      case "hover-enter":
        if (!accepts || this.hovered.has(event.nodeId)) return undefined;
        this.hovered.add(event.nodeId);
        if (this.feedbackEnabled) this.onHoverFeedback(event.nodeId);
        return undefined;
      case "hover-move":
        return undefined;
      case "hover-exit":
        this.hovered.delete(event.nodeId);
        return undefined;
      case "select-start":
        if (!accepts) return undefined;
        this.pressedId = event.nodeId;
        return undefined;
      case "select-end": {
        const pressed = this.pressedId;
        this.pressedId = undefined;
        if (pressed === event.nodeId && accepts) return { nodeId: event.nodeId, source: event.source };
        return undefined;
      }
      case "cancel":
        if (this.pressedId === event.nodeId) this.pressedId = undefined;
        return undefined;
      case "drag":
        return undefined;
    }
  }

  /** Forgets nodes that left the scene. */
  retain(nodeIds: ReadonlySet<string>): void {
    for (const id of Array.from(this.hovered)) if (!nodeIds.has(id)) this.hovered.delete(id);
    if (this.pressedId !== undefined && !nodeIds.has(this.pressedId)) this.pressedId = undefined;
  }
}

/** Dwell progress for the gaze ring. */
export type ViroSpecsDwellView = { readonly nodeId?: string; readonly progress: number };

/**
 * Gaze-only selection: holding the gaze on a target for `input.gazeDwellMs`
 * selects it once. The gaze must leave the target before it can select
 * again. Targets `canSelect` rejects (disabled, loading) never fill.
 *
 * On dwell completion it calls `select(nodeId)`; the host turns that into a
 * `select-start`/`select-end` pair with source `gaze` through
 * `ViroSpecsSceneController.dispatchInteraction`, so buttons and app
 * callbacks see an ordinary select.
 */
export class ViroSpecsGazeDwell {
  private target: string | undefined;
  private since = 0;
  private fired = false;
  private progressValue = 0;

  constructor(
    private readonly dwellMs: () => number,
    private readonly canSelect: (nodeId: string) => boolean,
    private readonly select: (nodeId: string) => void
  ) {}

  /** Feeds the node under the gaze ray (or undefined) at `nowMs`. */
  update(nodeId: string | undefined, nowMs: number): ViroSpecsDwellView {
    if (nodeId !== this.target) {
      this.target = nodeId;
      this.since = nowMs;
      this.fired = false;
      this.progressValue = 0;
    }
    if (nodeId !== undefined && !this.fired && !this.canSelect(nodeId)) {
      // Not selectable yet: the fill starts when it becomes selectable, not
      // when the gaze arrived.
      this.since = nowMs;
      this.progressValue = 0;
      return { nodeId, progress: 0 };
    }
    if (nodeId === undefined || this.fired) {
      return nodeId === undefined ? { progress: 0 } : { nodeId, progress: 1 };
    }
    this.progressValue = Math.min(1, (nowMs - this.since) / this.dwellMs());
    if (this.progressValue >= 1) {
      this.fired = true;
      this.select(nodeId);
    }
    return { nodeId, progress: this.progressValue };
  }

  /** Clears the target, for example when input switches back to hands. */
  reset(): void {
    this.target = undefined;
    this.fired = false;
    this.progressValue = 0;
  }
}

/**
 * Normalized scroll offset after one gaze Scroll up/down press: one row
 * (`itemHeightMeters`) of the content beyond the viewport, clamped to 0..1.
 */
export function stepViroSpecsScroll(
  current: number,
  direction: "up" | "down",
  scroll: { readonly itemHeightMeters: number; readonly viewportHeightMeters: number; readonly contentHeightMeters: number }
): number {
  const range = scroll.contentHeightMeters - scroll.viewportHeightMeters;
  if (range <= 0) return 0;
  const step = scroll.itemHeightMeters / range;
  const next = current + (direction === "down" ? step : -step);
  return Math.min(1, Math.max(0, next));
}

/**
 * Position after one gaze Move press: `input.gazeStepMeters` left/right in the
 * wearer's frame, or closer/away along the line to the wearer. The caller
 * clamps the result with {@linkcode ViroSpecsExperienceController.clampToComfortBand}.
 */
export function stepViroSpecsMove(position: Vec3, direction: "left" | "right" | "closer" | "away", stepMeters: number): Vec3 {
  if (direction === "left") return [position[0] - stepMeters, position[1], position[2]];
  if (direction === "right") return [position[0] + stepMeters, position[1], position[2]];
  const d = Math.sqrt(position[0] * position[0] + position[1] * position[1] + position[2] * position[2]);
  if (d < 1e-9) return position;
  const k = Math.max(0, d + (direction === "away" ? stepMeters : -stepMeters)) / d;
  return [position[0] * k, position[1] * k, position[2] * k];
}

/**
 * Premium component features this host carries but does not draw yet, as
 * `prop` names, for one node. The Lens adapter reports each node once with
 * `VS5025` so a dropped prop is never silent.
 */
export function unrenderedViroSpecsComponentFeatures(component: ViroSpecsComponentSpec | undefined): readonly string[] {
  if (!component) return [];
  switch (component.type) {
    case "spatial-panel":
    case "panel-text":
    case "panel-button":
      return [];
    case "panel-image":
      return ["radius.card corners"];
    case "scroll-view":
      // Drawn as a scroll group: ScrollWindow scrolling, itemHeightMeters as the
      // snap step and initialIndex as the first position.
      return [];
    case "model-viewer":
      return [
        ...(component.autoRotate ? ["autoRotate"] : []),
        ...(component.resettable ? ["resettable (Reset model button)"] : []),
        "load progress ring at the model bounds",
      ];
  }
}
