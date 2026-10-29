// API snapshot for @viro-external/specs Lens core (lens/, portable subset).
// Regenerate with: node scripts/ci/api-snapshot.mjs --update

// ---- ViroSpecsActionContract.d.ts
/**
 * Portable action contract checks: action declarations and payloads.
 *
 * The scene document reader uses these to reject scenes whose triggers name
 * unknown actions or carry ill-typed payloads, and ViroSpecsActionRegistry
 * uses them at dispatch. The same rules live in viro
 * (`components/Specs/core/actions.ts`), so a manifest that passes
 * `viro-specs-compile` passes here.
 *
 * Dependency-free and free of Lens globals.
 */
import { type ViroSpecsActionDeclaration, type ViroSpecsActionPayload } from "./ViroSpecsProtocol";
/** One problem found in an action payload or declaration. */
export type ViroSpecsActionProblem = {
    /** JSON Pointer relative to the checked value, for example `/units`. */
    readonly path: string;
    readonly message: string;
};
/** Problems with one declaration's shape. Empty when it is valid. */
export declare function checkViroSpecsActionDeclaration(value: unknown): ViroSpecsActionProblem[];
/**
 * Problems with `payload` against `declaration`: missing required fields,
 * unknown fields, wrong types, non-integers for `integer`, values outside
 * `enum`. Empty when the payload matches. `declaration` must be valid.
 */
export declare function checkViroSpecsActionPayload(declaration: ViroSpecsActionDeclaration, payload: unknown): ViroSpecsActionProblem[];
/** Copy of a checked payload with only declared fields, so handlers never see extras. */
export declare function copyViroSpecsActionPayload(payload: unknown): ViroSpecsActionPayload;

// ---- ViroSpecsActionRuntime.d.ts
/**
 * Typed actions and app state inside the Lens, with no phone or server.
 *
 * - {@linkcode ViroSpecsActionRegistry} holds action declarations and one
 *   handler per action. A handler is a pure function `(state, payload) =>
 *   nextState`.
 * - {@linkcode ViroSpecsActionRuntime} owns the state, turns triggered
 *   actions into new state through the registry, and renders the result with
 *   `view(state)` on a {@linkcode ViroSpecsActionSceneHost}. A view that
 *   names another route navigates; the same route patches.
 *
 * Transport is optional: `forward` receives every accepted action, for a
 * phone app to mirror. Nothing here throws into Lens Studio.
 *
 * Dependency-free and free of Lens globals.
 */
import type { ViroSpecsActionDeclaration, ViroSpecsActionEvent, ViroSpecsActionPayload, ViroSpecsSceneDocumentV2 } from "./ViroSpecsProtocol";
import { type ViroSpecsHostDiagnostics, type ViroSpecsSubscription } from "./ViroSpecsHostDiagnostics";
import type { ViroSpecsApplyResult } from "./ViroSpecsSceneController";
/** Reducer for one action: returns the next state, or the same object for no change. */
export type ViroSpecsActionHandler<S> = (state: S, payload: ViroSpecsActionPayload, event: ViroSpecsActionEvent) => S;
/** Outcome of {@linkcode ViroSpecsActionRegistry.reduce}. */
export type ViroSpecsActionReduction<S> =
/** The handler ran. `state` may be the input object when nothing changed. */
{
    readonly status: "handled";
    readonly state: S;
}
/** Declared and well-typed, but no handler is registered. */
 | {
    readonly status: "unhandled";
}
/** Undeclared, ill-typed, or the handler threw. Already reported. */
 | {
    readonly status: "rejected";
};
/**
 * Declared actions and their handlers. Declarations are fixed at
 * construction; handlers are added with {@linkcode on}.
 *
 * @example
 * const registry = new ViroSpecsActionRegistry<AppState>(ACTIONS, diagnostics);
 * registry.on("exhibit.open", (state, payload) => ({ ...state, route: "details", exhibitId: String(payload.exhibitId) }));
 */
export declare class ViroSpecsActionRegistry<S> {
    private readonly diagnostics;
    private readonly byId;
    private readonly handlers;
    /**
     * @param declarations Invalid entries are reported (VS5017) and left out;
     *   a repeated ID is reported (VS5016) and the first declaration stays.
     */
    constructor(declarations: readonly ViroSpecsActionDeclaration[], diagnostics: ViroSpecsHostDiagnostics);
    /** Valid declarations, in declaration order. Use them as the scene's `actions`. */
    get declarations(): ViroSpecsActionDeclaration[];
    /** Whether `actionId` is declared. */
    isDeclared(actionId: string): boolean;
    /**
     * Registers the handler for a declared action. Undeclared IDs (VS5015)
     * and a second handler for one ID (VS5016) are reported and not
     * registered; the returned subscription is then inert.
     */
    on(actionId: string, handler: ViroSpecsActionHandler<S>): ViroSpecsSubscription;
    /** Checks `event` against its declaration and runs its handler. Never throws. */
    reduce(state: S, event: ViroSpecsActionEvent): ViroSpecsActionReduction<S>;
    private report;
}
/**
 * What the runtime needs from a scene host. `ViroSpecsSceneController` and
 * `ViroSpecsSceneControllerHost` both provide it.
 */
export interface ViroSpecsActionSceneHost {
    /** Moves the committed scene to `input`; a new route navigates. */
    update(input: unknown): ViroSpecsApplyResult;
    /** Triggered actions, one frame after their interaction, owned by their scene. */
    addOnActionListener(listener: (event: ViroSpecsActionEvent) => void): ViroSpecsSubscription;
}
/** Options for {@linkcode ViroSpecsActionRuntime}. */
export type ViroSpecsActionRuntimeOptions<S> = {
    readonly initialState: S;
    /** Pure function from state to the scene to show. Should set `route` and `actions`. */
    readonly view: (state: S) => ViroSpecsSceneDocumentV2;
    readonly registry: ViroSpecsActionRegistry<S>;
    readonly diagnostics: ViroSpecsHostDiagnostics;
    nowMs?: () => number;
    /**
     * Receives every accepted action after it is reduced, for a phone app or
     * server to mirror. Optional; the runtime is complete without it. When
     * set, declared actions without a local handler are not reported (VS5019)
     * because the receiver handles them.
     */
    readonly forward?: (event: ViroSpecsActionEvent) => void;
};
/**
 * State loop for a standalone Lens: trigger → typed action → handler →
 * state → `view(state)` → controller update.
 *
 * A render the controller rejects (an invalid view) rolls the state back so
 * state always matches what the wearer sees.
 */
export declare class ViroSpecsActionRuntime<S> {
    private readonly host;
    private readonly options;
    private stateValue;
    private subscription;
    private readonly stateListeners;
    private readonly nowMs;
    private disposed;
    constructor(host: ViroSpecsActionSceneHost, options: ViroSpecsActionRuntimeOptions<S>);
    /** State the committed scene was rendered from. */
    get state(): S;
    /** Renders the initial state and starts listening for triggered actions. Idempotent. */
    start(): ViroSpecsApplyResult | null;
    /**
     * Dispatches an action from app code (a voice command, a LEAF scenario, a
     * timer). It goes through the same checks as a triggered action and runs
     * now; queue it with the controller's `queueAction` when it must not
     * outlive the current scene.
     */
    dispatch(actionId: string, payload?: ViroSpecsActionPayload): boolean;
    /** State changes, after the scene for the new state is committed. */
    addOnStateListener(listener: (state: S) => void): ViroSpecsSubscription;
    /** Stops listening. The committed scene stays; dispose the controller to remove it. Idempotent. */
    dispose(): void;
    private accept;
    /** Renders `next`; commits it as state only when the host accepted the scene. */
    private render;
}

// ---- ViroSpecsExperience.d.ts
import { type ViroSpecsButtonAuthoredState, type ViroSpecsButtonVisualState, type ViroSpecsComponentSpec, type ViroSpecsExperiencePreferences, type ViroSpecsSpatialTokens, type ViroSpecsTheme } from "./ViroSpecsExperienceTokens";
import { type ViroSpecsHostDiagnostic, type ViroSpecsHostDiagnostics, type ViroSpecsSubscription } from "./ViroSpecsHostDiagnostics";
import type { ViroSpecsCapabilityState, ViroSpecsHostInteraction } from "./ViroSpecsProtocol";
import type { ViroSpecsSceneLifecycle } from "./ViroSpecsSceneController";
type Vec3 = [number, number, number];
/**
 * Time in loading after which `loading.slow` replaces the progress line.
 * The pack targets a first frame under 2 s; WS3 has not measured it on device
 * yet, so this is the target itself, not a measurement.
 */
export declare const VIRO_SPECS_SLOW_LOADING_MS = 2000;
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
export type ViroSpecsLoadingView = {
    readonly visible: false;
} | {
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
    readonly assetProgress: {
        readonly pending: number;
        readonly total: number;
    };
    readonly committedScene: {
        readonly theme?: ViroSpecsTheme;
    } | null;
    addOnLifecycleListener(listener: (state: ViroSpecsSceneLifecycle) => void): ViroSpecsSubscription;
};
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
export declare class ViroSpecsExperienceController {
    private readonly options;
    private theme;
    private preferences;
    private capabilities;
    private lifecycle;
    private progress;
    private loadingSinceMs;
    private hadReadyScene;
    private nodeErrors;
    private sceneError;
    private transportLost;
    private dismissedErrorKey;
    private dismissedNotices;
    private reportedDegraded;
    private permissionClosed;
    private lastInputMode;
    private readonly listeners;
    private readonly subscriptions;
    private cached;
    private source;
    private clamped;
    constructor(options: ViroSpecsExperienceOptions);
    /**
     * Subscribes to a scene controller: lifecycle, asset progress and host
     * diagnostics. Returns the subscription; {@linkcode dispose} also removes it.
     */
    attach(controller: ExperienceSource): ViroSpecsSubscription;
    /** Theme from the scene document. The authored preferences apply unless the app set its own. */
    setTheme(theme: ViroSpecsTheme): void;
    /** High contrast and reduced motion. Applies on the next view; no restart. */
    setPreferences(preferences: ViroSpecsExperiencePreferences): void;
    /** Current capability report. Changes switch input mode and hidden UI without a restart (A-check D3). */
    setCapabilities(report: Readonly<Record<string, ViroSpecsCapabilityState>>): void;
    /** Scene controller lifecycle and asset counts. {@linkcode attach} calls this for you. */
    onSceneLifecycle(lifecycle: ViroSpecsSceneLifecycle, progress: {
        readonly pending: number;
        readonly total: number;
    }): void;
    /**
     * Host diagnostics: `VS5003` marks a node error (placeholder shown),
     * `VS5002`/`VS5005` a rejected scene. Others are ignored here.
     */
    onHostDiagnostic(diagnostic: ViroSpecsHostDiagnostic): void;
    /** The app transport dropped (`false`) or came back (`true`). The scene keeps its last state. */
    setTransportConnected(connected: boolean): void;
    /** Got it on the degraded notice. That capability's notice does not return this session. */
    dismissNotice(): void;
    /**
     * The error panel's one action. Retry clears the node errors and returns
     * their IDs for the host to reload; Close and Got it dismiss the panel.
     * Closing a no-fallback scene error keeps the panel (never a blank view);
     * the wearer exits with the system gesture.
     */
    activateErrorAction(): {
        readonly action: ViroSpecsPanelAction;
        readonly nodeIds: readonly string[];
    } | undefined;
    /** Close on the permission panel. The scene stays on screen without input. */
    closePermissionPanel(): void;
    /**
     * Advances time-based rules and re-reads the attached controller's asset
     * progress and theme, which change without a lifecycle event while assets
     * load and when a scene replaces another in the same state. Call every frame.
     */
    tick(): void;
    /**
     * Keeps a placement or drag position inside the comfort band (distance from
     * the wearer at the origin). Reports `VS5023` when it clamps.
     */
    clampToComfortBand(nodeId: string, position: Vec3): Vec3;
    /**
     * Lens Text size for a text node at `distanceMeters`: `size` unchanged when it
     * is at least 1.2 degrees there, otherwise raised to the minimum with a
     * `VS5022` warning.
     */
    minimumTextSize(nodeId: string, size: number, distanceMeters: number): number;
    /** Listens for view changes. The listener gets the current view immediately. */
    addOnViewListener(listener: (view: ViroSpecsExperienceView) => void): ViroSpecsSubscription;
    /** Removes every subscription. Idempotent. */
    dispose(): void;
    /** The view for the current facts. */
    view(): ViroSpecsExperienceView;
    private loadingView;
    private noticeView;
    private errorView;
    private worstState;
    private handState;
    private inputMode;
    private hiddenFor;
    private report;
    private emit;
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
export declare function resolveViroSpecsButtonVisual(label: string, authored: ViroSpecsButtonAuthoredState, interaction: {
    readonly hovered: boolean;
    readonly pressed: boolean;
}, tokens: ViroSpecsSpatialTokens): ViroSpecsButtonVisual;
/** A press that committed: the action fires on release inside the target. */
export type ViroSpecsButtonCommit = {
    readonly nodeId: string;
    readonly source: ViroSpecsHostInteraction["source"];
};
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
export declare class ViroSpecsButtonTracker {
    private readonly authoredState;
    private readonly onHoverFeedback;
    private hovered;
    private pressedId;
    private feedbackEnabled;
    constructor(authoredState: (nodeId: string) => ViroSpecsButtonAuthoredState | undefined, onHoverFeedback?: (nodeId: string) => void);
    /** The app can turn the haptic/audio hook off. */
    setFeedbackEnabled(enabled: boolean): void;
    /** Hover and press flags for one button. */
    interactionOf(nodeId: string): {
        readonly hovered: boolean;
        readonly pressed: boolean;
    };
    /** Feeds one host interaction. Returns the commit when a press completes. */
    handle(event: Pick<ViroSpecsHostInteraction, "nodeId" | "phase" | "source">): ViroSpecsButtonCommit | undefined;
    /** Forgets nodes that left the scene. */
    retain(nodeIds: ReadonlySet<string>): void;
}
/** Dwell progress for the gaze ring. */
export type ViroSpecsDwellView = {
    readonly nodeId?: string;
    readonly progress: number;
};
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
export declare class ViroSpecsGazeDwell {
    private readonly dwellMs;
    private readonly canSelect;
    private readonly select;
    private target;
    private since;
    private fired;
    private progressValue;
    constructor(dwellMs: () => number, canSelect: (nodeId: string) => boolean, select: (nodeId: string) => void);
    /** Feeds the node under the gaze ray (or undefined) at `nowMs`. */
    update(nodeId: string | undefined, nowMs: number): ViroSpecsDwellView;
    /** Clears the target, for example when input switches back to hands. */
    reset(): void;
}
/**
 * Normalized scroll offset after one gaze Scroll up/down press: one row
 * (`itemHeightMeters`) of the content beyond the viewport, clamped to 0..1.
 */
export declare function stepViroSpecsScroll(current: number, direction: "up" | "down", scroll: {
    readonly itemHeightMeters: number;
    readonly viewportHeightMeters: number;
    readonly contentHeightMeters: number;
}): number;
/**
 * Position after one gaze Move press: `input.gazeStepMeters` left/right in the
 * wearer's frame, or closer/away along the line to the wearer. The caller
 * clamps the result with {@linkcode ViroSpecsExperienceController.clampToComfortBand}.
 */
export declare function stepViroSpecsMove(position: Vec3, direction: "left" | "right" | "closer" | "away", stepMeters: number): Vec3;
/**
 * Premium component features this host carries but does not draw yet, as
 * `prop` names, for one node. The Lens adapter reports each node once with
 * `VS5025` so a dropped prop is never silent.
 */
export declare function unrenderedViroSpecsComponentFeatures(component: ViroSpecsComponentSpec | undefined): readonly string[];
/**
 * ModelViewer `autoRotate` speed: one turn every 20 seconds about the model's
 * own up axis, slow enough to read as a turntable rather than motion of the
 * scene. Off under reduced motion.
 */
export declare const VIRO_SPECS_AUTO_ROTATE_DEG_PER_SECOND = 18;
/**
 * Degrees a ModelViewer with `autoRotate` turns in `deltaSeconds`: zero under
 * reduced motion, while the wearer holds or drags it, or for a non-positive
 * frame time.
 */
export declare function viroSpecsAutoRotateDegrees(deltaSeconds: number, options: {
    readonly reducedMotion: boolean;
    readonly held: boolean;
}): number;
/**
 * Whether a ModelViewer draws its own load ring this frame: only while its
 * asset is still loading and the scene-level loading panel is closed. The
 * loading panel already reports every pending asset, and both rings draw at
 * the same overlay order, so showing both put a second ring across the
 * panel's title.
 */
export declare function viroSpecsShowModelRing(loading: ViroSpecsLoadingView, assetPending: boolean): boolean;
/**
 * The ModelViewer Reset model button: a PanelButton-sized control centred
 * under the model's authored bounds, `space.sm` below their bottom edge.
 * Meters; `y` is the button centre relative to the model's authored origin,
 * along the parent's up axis.
 */
export declare function layoutViroSpecsModelReset(tokens: ViroSpecsSpatialTokens, bounds: {
    readonly bottomMeters: number;
}, distanceMeters: number): {
    readonly y: number;
    readonly widthMeters: number;
    readonly heightMeters: number;
};
/**
 * Progress of a Reset model transition `elapsedMs` after it started:
 * ease-in-out over `motion.base`, or done at once under reduced motion
 * (`motion.instant`). 0 is where the model was, 1 is the authored transform.
 */
export declare function viroSpecsResetProgress(elapsedMs: number, tokens: ViroSpecsSpatialTokens, reducedMotion: boolean): number;
/**
 * Flat geometry in the XY plane, facing +Z (counter-clockwise seen from +Z):
 * interleaved `[x, y, z, nx, ny, nz, u, v]` per vertex and triangle indices.
 */
export type ViroSpecsFlatGeometry = {
    readonly vertices: readonly number[];
    readonly indices: readonly number[];
};
/**
 * A disc of diameter 1 centred on the origin, as a fan of `segments`
 * triangles. The reticle and the gaze dwell disc draw on it, scaled to their
 * diameter.
 */
export declare function viroSpecsDiscGeometry(segments?: number): ViroSpecsFlatGeometry;
/**
 * A `width` by `height` rectangle centred on the origin with corners rounded
 * to `radius` (clamped to half the shorter side), UVs 0..1 across the full
 * rectangle so a texture maps as it would on a plain quad. A fan from the
 * centre over the outline: `cornerSegments` steps per corner.
 */
export declare function viroSpecsRoundedRectGeometry(width: number, height: number, radius: number, cornerSegments?: number): ViroSpecsFlatGeometry;
/**
 * Average glyph advance as a fraction of the em, for line-count estimates.
 * The same 0.55 em guard viro's PanelButton sizing and gallery layout test
 * use; real glyphs are narrower, so an estimate errs toward more lines.
 */
export declare const VIRO_SPECS_EM_PER_CHARACTER = 0.55;
/**
 * Lines `text` needs at `emMeters` when wrapped at `wrapWidthMeters`, by the
 * {@linkcode VIRO_SPECS_EM_PER_CHARACTER} estimate. Explicit newlines count.
 * Zero for empty text.
 */
export declare function estimateViroSpecsLines(text: string, emMeters: number, wrapWidthMeters: number): number;
/**
 * Lines `text` takes at `emMeters` when wrapped at `wrapWidthMeters`; zero for
 * empty text. The layout functions default to
 * {@linkcode estimateViroSpecsLines}; the Lens host passes one that measures
 * the laid-out glyphs, so rows are sized to the lines the text really wraps to.
 */
export type ViroSpecsLineMeasure = (text: string, emMeters: number, wrapWidthMeters: number) => number;
/** A text block in a {@linkcode ViroSpecsStatePanelLayout}: centre and size, meters, panel-local. */
export type ViroSpecsTextBlock = {
    readonly y: number;
    readonly lines: number;
    readonly emMeters: number;
    /** Lines times `type.lineHeight` times the em. */
    readonly heightMeters: number;
};
/**
 * Geometry of a loading, notice, error or permission panel, from
 * {@linkcode layoutViroSpecsStatePanel}. Meters, in the panel's own frame:
 * x right, y up, origin at the panel centre. Rows stack top to bottom with
 * `space.sm` between them and `space.md` padding, so text never runs past
 * the backing and the action never covers a line.
 */
export type ViroSpecsStatePanelLayout = {
    readonly widthMeters: number;
    readonly heightMeters: number;
    /** Width every text row wraps at: the panel width less `space.md` on each side. */
    readonly wrapWidthMeters: number;
    readonly ring?: {
        readonly y: number;
        readonly diameterMeters: number;
        readonly thicknessMeters: number;
    };
    readonly title?: ViroSpecsTextBlock;
    readonly body?: ViroSpecsTextBlock;
    readonly detail?: ViroSpecsTextBlock;
    readonly action?: {
        readonly y: number;
        readonly widthMeters: number;
        readonly heightMeters: number;
    };
};
/** What a state panel shows, for {@linkcode layoutViroSpecsStatePanel}. Empty strings are left out. */
export type ViroSpecsStatePanelContent = {
    readonly title: string;
    readonly body: string;
    readonly detail: string;
    readonly action: string | null;
    /** The loading panel's progress ring, above the title. */
    readonly ring: boolean;
};
/**
 * Lays out a state panel 20 degrees wide (the handoff panel width) at
 * `distanceMeters`. Title and body use `type.bodyDeg`, detail and action
 * `type.labelDeg`; the ring is three body ems across. Row heights come from
 * `measureLines`, which defaults to the {@linkcode estimateViroSpecsLines}
 * estimate.
 */
export declare function layoutViroSpecsStatePanel(tokens: ViroSpecsSpatialTokens, content: ViroSpecsStatePanelContent, distanceMeters: number, measureLines?: ViroSpecsLineMeasure): ViroSpecsStatePanelLayout;
/**
 * Size of a panel action button at `distanceMeters`: one label line plus
 * `space.sm` above and below, and at least the label plus `space.md` each
 * side (the PanelButton default), never narrower than 2.5 heights.
 */
export declare function viroSpecsActionButtonSize(tokens: ViroSpecsSpatialTokens, label: string, distanceMeters: number): {
    readonly widthMeters: number;
    readonly heightMeters: number;
};
/**
 * Where a PanelButton's `errorMessage` goes: a row under the button, its top
 * `space.xs` below the button's bottom edge. Inside a SpatialPanel the row
 * spans the panel's inner width (the panel less `space.md` each side) and is
 * centred on the panel, so the message wraps to two lines instead of four;
 * on its own it wraps at the button width. The line count comes from
 * `measureLines` (default {@linkcode estimateViroSpecsLines}). Meters, button-local (origin at
 * the button centre).
 */
export declare function layoutViroSpecsButtonError(tokens: ViroSpecsSpatialTokens, button: {
    readonly width: number;
    readonly height: number;
}, message: string, distanceMeters: number, panel?: {
    readonly width: number;
    readonly buttonX: number;
}, measureLines?: ViroSpecsLineMeasure): ViroSpecsTextBlock & {
    readonly x: number;
    readonly wrapWidthMeters: number;
};
/**
 * Gaze Scroll up and Scroll down buttons for a scroll group's window, in the
 * group's frame (the window is centred on its origin). They sit side by side
 * under the window's bottom edge, `space.sm` below it and apart, Scroll up on
 * the left, so they cover neither the rows nor a title above the list and
 * stay inside the wearer's view of the list.
 */
export declare function layoutViroSpecsScrollButtons(tokens: ViroSpecsSpatialTokens, window: {
    readonly width: number;
    readonly height: number;
}, distanceMeters: number): {
    readonly up: {
        readonly x: number;
        readonly y: number;
    };
    readonly down: {
        readonly x: number;
        readonly y: number;
    };
    readonly widthMeters: number;
    readonly heightMeters: number;
};
/**
 * Loading ring segments for `progress` (0..1, or undefined when unknown):
 * how many of `count` segments are lit and the rotation of segment 0, in
 * turns. `ring-arc` and `arc-static` fill from the top clockwise and never
 * rotate; `ring-spin` lights a quarter of the ring and turns once per
 * `motion.progressLoopMs`; `dots` (reduced motion, unknown progress) lights
 * every third segment with no movement.
 */
export declare function viroSpecsLoadingRing(indicator: ViroSpecsLoadingIndicator, progress: number | undefined, count: number, elapsedMs: number, tokens: ViroSpecsSpatialTokens): {
    readonly lit: readonly boolean[];
    readonly turns: number;
};
export {};

// ---- ViroSpecsExperienceCopy.d.ts
/**
 * Wearer-facing copy for the experience layer, keyed as in viro
 * `docs/ux/copy.md`. Generated from viro `components/Specs/core/copy.ts`;
 * `scripts/experience.test.mjs` checks it against `scripts/fixtures/copy.json`,
 * which is exported from the same file. Code references keys, never strings.
 *
 * Dependency-free and free of Lens globals.
 */
export declare const VIRO_SPECS_LENS_COPY: {
    readonly "loading.title": "Loading scene";
    readonly "loading.progress": "Loading {done} of {total}";
    readonly "loading.slow": "Still loading. Large models can take a moment.";
    readonly "loading.a11yLabel": "Loading scene, {percent} percent";
    readonly "degraded.worldQuery.unsupported": "Placement isn't available on this device. Content stays in front of you.";
    readonly "degraded.worldQuery.unavailable": "Can't find surfaces right now. Try a brighter spot or look at a table or floor.";
    readonly "degraded.handTracking.permission": "Hand tracking is off. Look at a button and hold your gaze to select.";
    readonly "degraded.handTracking.unavailable": "Can't see your hands. Hold them in view, or select with your gaze.";
    readonly "degraded.unverified": "Some features haven't been checked on this device.";
    readonly "degraded.dismiss": "Got it";
    readonly "error.asset.title": "Model didn't load";
    readonly "error.asset.message": "The rest of the scene works. Retry to load it again.";
    readonly "error.asset.action": "Retry";
    readonly "error.scene.title": "Scene couldn't open";
    readonly "error.scene.message": "The last working scene is still here.";
    readonly "error.scene.action": "Close";
    readonly "error.sceneNoFallback.title": "Scene couldn't open";
    readonly "error.sceneNoFallback.message": "Close this lens and open it again. If it keeps happening, the code below helps the developer.";
    readonly "error.sceneNoFallback.action": "Close";
    readonly "error.transport.title": "Lost connection to the app";
    readonly "error.transport.message": "What's here stays. Changes will show when it reconnects.";
    readonly "error.transport.action": "Got it";
    readonly "placement.searching": "Look at a table or the floor";
    readonly "placement.surface": "{surface}. Pinch to place.";
    readonly "placement.surfaceUnknown": "Look for a flat surface";
    readonly "placement.confirmed": "Placed";
    readonly "placement.cancelHint": "Look away to cancel";
    readonly "placement.cancelled": "Placement cancelled";
    readonly "placement.a11yLabel": "Placement reticle on {surface}";
    readonly "permission.handTracking.title": "Hand tracking is off";
    readonly "permission.handTracking.body": "Turn it on in Spectacles settings to pinch and drag. You can still select with your gaze.";
    readonly "permission.handTracking.body.noGaze": "Turn it on in Spectacles settings to use this scene.";
    readonly "permission.action.continue": "Use gaze instead";
    readonly "permission.action.close": "Close";
    readonly "gallery.hello.title": "Hello";
    readonly "gallery.placement.title": "Placement";
    readonly "gallery.interaction.title": "Interaction";
    readonly "gallery.navigation.title": "Navigation";
    readonly "nav.back": "Back";
    readonly "nav.next": "Next scene";
    readonly "modelViewer.reset": "Reset model";
    readonly "gallery.hello.body": "This scene runs the same Viro JSX as the phone.";
    readonly "gallery.hello.model": "Shiba model";
    readonly "gallery.interaction.body": "Pinch a button. Drag the model.";
    readonly "gallery.interaction.optionA": "Option A";
    readonly "gallery.interaction.optionB": "Option B";
    readonly "gallery.interaction.optionC": "Option C";
    readonly "gallery.interaction.retry": "Retry";
    readonly "gallery.interaction.retryFailed": "That didn't go through. Pinch Retry to try again.";
    readonly "gallery.navigation.card": "Card {n}";
    readonly "gallery.navigation.cardBody": "Change the setting below, then go back. The list keeps your place.";
    readonly "gallery.navigation.showLabels": "Show labels";
    readonly "surface.floor": "Floor";
    readonly "surface.table": "Table";
    readonly "surface.wall": "Wall";
    readonly "surface.seat": "Seat";
    readonly "surface.ceiling": "Ceiling";
    readonly "placement.placeHere": "Place here";
    readonly "placement.placeAgain": "Place again";
    readonly "placement.cancelling": "Cancelling";
    readonly "button.loading": "Working";
    readonly "gaze.moveLeft": "Move left";
    readonly "gaze.moveRight": "Move right";
    readonly "gaze.moveCloser": "Move closer";
    readonly "gaze.moveAway": "Move away";
    readonly "gaze.scrollUp": "Scroll up";
    readonly "gaze.scrollDown": "Scroll down";
    readonly "error.assetMany.title": "{n} models didn't load";
    readonly "a11y.selected": ", selected";
    readonly "a11y.unavailable": ", unavailable";
    readonly "a11y.placeholder": "{label}, didn't load";
};
/** A key of {@linkcode VIRO_SPECS_LENS_COPY}. */
export type ViroSpecsCopyKey = keyof typeof VIRO_SPECS_LENS_COPY;
/**
 * The copy for `key` with `{name}` placeholders filled from `params`. A
 * placeholder without a value stays as written so it is visible in review.
 */
export declare function formatViroSpecsCopy(key: ViroSpecsCopyKey, params?: Readonly<Record<string, string | number>>): string;

// ---- ViroSpecsExperienceTokens.d.ts
/**
 * Spatial design tokens and premium component specs for the Lens host.
 *
 * Mirrors viro's `components/Specs/core/tokens.ts` and the `component` and
 * `theme` fields of manifest v2. A scene document carries the tokens in
 * `theme`; the host falls back to {@linkcode VIRO_SPECS_LENS_DEFAULT_THEME}
 * when it is absent. `scripts/experience.test.mjs` checks these defaults
 * against the `theme` block in the gallery fixtures viro compiled, so the two
 * copies cannot drift unnoticed.
 *
 * Units are in the names: `Deg` is angular size at the node's distance,
 * `Meters` a physical offset, `Ms` milliseconds. Colors are `#RRGGBB`.
 *
 * Dependency-free and free of Lens globals.
 */
/** Token groups. Same keys as viro's `ViroSpecsSpatialTokens`. */
export type ViroSpecsSpatialTokens = {
    readonly distance: {
        readonly minMeters: number;
        readonly defaultMeters: number;
        readonly maxMeters: number;
    };
    readonly type: {
        readonly minAngleDeg: number;
        readonly titleDeg: number;
        readonly bodyDeg: number;
        readonly labelDeg: number;
        readonly lineHeight: number;
    };
    readonly color: {
        readonly surface: string;
        readonly surfaceRaised: string;
        readonly surfacePressed: string;
        readonly text: string;
        readonly textMuted: string;
        readonly textDisabled: string;
        readonly border: string;
        readonly borderStrong: string;
        readonly focus: string;
        readonly onFocus: string;
        readonly selectedFill: string;
        readonly error: string;
        readonly errorSurface: string;
        readonly degraded: string;
        readonly degradedSurface: string;
        readonly success: string;
        readonly placeholder: string;
    };
    readonly tint: {
        readonly floor: string;
        readonly table: string;
        readonly wall: string;
        readonly seat: string;
        readonly ceiling: string;
        readonly opacity: number;
    };
    readonly space: {
        readonly xsDeg: number;
        readonly smDeg: number;
        readonly mdDeg: number;
        readonly lgDeg: number;
        readonly xlDeg: number;
    };
    readonly shape: {
        readonly borderWidthDeg: number;
        readonly borderWidthFocusDeg: number;
        readonly radiusPanelDeg: number;
        readonly radiusButtonDeg: number;
        readonly radiusCardDeg: number;
    };
    readonly depth: {
        readonly baseMeters: number;
        readonly raisedMeters: number;
        readonly hoverMeters: number;
        readonly overlayMeters: number;
    };
    readonly motion: {
        readonly fastMs: number;
        readonly baseMs: number;
        readonly slowMs: number;
        readonly maxMs: number;
        readonly progressLoopMs: number;
        readonly appearScaleFrom: number;
        readonly hoverScale: number;
    };
    readonly opacity: {
        readonly surface: number;
        readonly placeholder: number;
        readonly disabledBorder: number;
    };
    readonly input: {
        /** Provisional; see viro `docs/specs-experience.md#gaze-dwell`. */
        readonly gazeDwellMs: number;
        readonly lookAwayCancelMs: number;
        readonly gazeStepMeters: number;
        readonly reticleDeg: number;
    };
};
/** What high-contrast mode replaces. */
export type ViroSpecsHighContrastTokens = {
    readonly color: {
        readonly surface: string;
        readonly text: string;
        readonly textMuted: string;
        readonly border: string;
        readonly focus: string;
    };
    readonly surfaceOpacity: number;
    readonly borderScale: number;
    readonly typeBoostDeg: number;
};
/** Wearer preferences. Snap OS exposes no system setting for either (unverified), so the app sets them. */
export type ViroSpecsExperiencePreferences = {
    readonly highContrast: boolean;
    readonly reducedMotion: boolean;
};
/** The `theme` block of a scene document. */
export type ViroSpecsTheme = {
    readonly version: 1;
    readonly tokens: ViroSpecsSpatialTokens;
    readonly highContrast: ViroSpecsHighContrastTokens;
    readonly preferences: ViroSpecsExperiencePreferences;
};
/** PanelButton states the app sets. */
export type ViroSpecsButtonAuthoredState = "idle" | "selected" | "disabled" | "loading" | "error";
/** All seven PanelButton visual states. */
export type ViroSpecsButtonVisualState = ViroSpecsButtonAuthoredState | "hover" | "pressed";
/** Premium component carried on a node. */
export type ViroSpecsComponentSpec = {
    readonly type: "spatial-panel";
    readonly title?: string;
} | {
    readonly type: "panel-text";
    readonly role: "title" | "body" | "label";
    readonly tone: "default" | "muted";
} | {
    readonly type: "panel-button";
    readonly state: ViroSpecsButtonAuthoredState;
    readonly errorMessage?: string;
} | {
    readonly type: "panel-image";
} | {
    readonly type: "scroll-view";
    readonly itemHeightMeters: number;
    readonly initialIndex: number;
} | {
    readonly type: "model-viewer";
    readonly autoRotate: boolean;
    readonly resettable: boolean;
};
/** Node kind each component sits on. */
export declare const VIRO_SPECS_COMPONENT_NODE_KIND: {
    readonly "spatial-panel": "panel";
    readonly "panel-text": "text";
    readonly "panel-button": "panel";
    readonly "panel-image": "image";
    readonly "scroll-view": "group";
    readonly "model-viewer": "model";
};
/** Default tokens, identical to viro's `VIRO_SPECS_SPATIAL_TOKENS`. */
export declare const VIRO_SPECS_LENS_SPATIAL_TOKENS: ViroSpecsSpatialTokens;
/**
 * Default high-contrast replacements. SPECS is an additive display, where
 * black adds no light and shows as the room, so the surface is a mid slate
 * (#42525f) rather than black: visible, and white text on it is 8.07:1.
 */
export declare const VIRO_SPECS_LENS_HIGH_CONTRAST: ViroSpecsHighContrastTokens;
/** Theme used when a document has none. */
export declare const VIRO_SPECS_LENS_DEFAULT_THEME: ViroSpecsTheme;
/**
 * Applies preferences: high contrast swaps colors, makes the surface opaque,
 * scales borders and boosts type; reduced motion removes every scale change.
 * Same rules as viro's `resolveSpecsTokens`.
 */
export declare function resolveViroSpecsTokens(theme: ViroSpecsTheme, preferences?: ViroSpecsExperiencePreferences): ViroSpecsSpatialTokens;
/** Meters that subtend `angleDeg` at `distanceMeters`. */
export declare function viroSpecsAngleToMeters(angleDeg: number, distanceMeters: number): number;
/** Angle in degrees `sizeMeters` subtends at `distanceMeters`. */
export declare function viroSpecsMetersToAngle(sizeMeters: number, distanceMeters: number): number;
/**
 * Lens Text em-square height per Lens size unit, in meters: a size of 43.886
 * draws a 1 cm em (CLAD specs-build-ui type scale). The host passes Viro
 * `fontSize` through as Lens size, so this is also meters per Viro point.
 */
export declare const VIRO_SPECS_LENS_TEXT_EM_METERS_PER_SIZE: number;
type Report = (path: string, message: string) => void;
/** Validates a document `theme` block; reports through `fail` and never throws. */
export declare function checkViroSpecsTheme(value: unknown, path: string, fail: Report): void;
/** Validates a node `component` against its node kind; reports through `fail`. */
export declare function checkViroSpecsComponent(value: unknown, kind: string, path: string, fail: Report): void;
export {};

// ---- ViroSpecsHostDiagnostics.d.ts
/**
 * Diagnostics channel for the Lens-side scene host.
 *
 * The host never throws into Lens Studio: every failure becomes a
 * {@linkcode ViroSpecsHostDiagnostic} on this channel, and the live scene
 * either stays as it was (errors) or renders with a stated approximation
 * (warnings). Codes use the `VS5xxx` range of the Specs diagnostic catalog in
 * `mikevocalz/viro` (`components/Specs/core/diagnosticCodes.ts`), so a code
 * means the same thing in the compiler output and in a Lens log.
 *
 * Dependency-free and free of Lens globals, so Node tests run it as is.
 */
/** How a host diagnostic affects the scene. */
export type ViroSpecsHostDiagnosticSeverity = "error" | "warning" | "info";
/** Lifecycle step that produced a diagnostic. */
export type ViroSpecsHostPhase = "validate" | "stage" | "commit" | "patch" | "assets" | "interaction" | "animation" | "dispose" | "listener" | "action" | "experience";
/** Catalog entry: severity is fixed per code. */
export type ViroSpecsHostDiagnosticDefinition = {
    readonly severity: ViroSpecsHostDiagnosticSeverity;
    readonly title: string;
    readonly hint: string;
};
/**
 * Every code the host emits. Append-only; mirrored in viro's catalog and in
 * `doc/LensHostDiagnostics.md`. The test suite checks the doc against this
 * table.
 */
export declare const VIRO_SPECS_HOST_DIAGNOSTICS: {
    readonly VS5001: {
        readonly severity: "error";
        readonly title: "Unsupported scene protocol";
        readonly hint: "The host reads scene protocols 1 and 2. Recompile with a viro-specs-compile that matches this @viro-external/specs.";
    };
    readonly VS5002: {
        readonly severity: "error";
        readonly title: "Scene failed host validation";
        readonly hint: "The previous scene stays on screen. Fix the field named by fieldPath; viro-specs-compile reports the same problem with a source position.";
    };
    readonly VS5003: {
        readonly severity: "warning";
        readonly title: "Asset is not registered; placeholder shown";
        readonly hint: "Add the asset to ViroSpecsAssetRegistry under the reported source ID. The node shows a bounded tinted box until then.";
    };
    readonly VS5004: {
        readonly severity: "warning";
        readonly title: "Material is not registered; default material used";
        readonly hint: "Register the material ID in ViroSpecsAssetRegistry or define it in the scene's materials list.";
    };
    readonly VS5005: {
        readonly severity: "error";
        readonly title: "Staging failed; previous scene kept";
        readonly hint: "The staged scene was disposed and the committed scene is unchanged. The message names the node and the backend error.";
    };
    readonly VS5006: {
        readonly severity: "info";
        readonly title: "Async work finished after its scene was retired";
        readonly hint: "No action needed. The result was discarded because navigation or replacement retired the scene that started it.";
    };
    readonly VS5007: {
        readonly severity: "warning";
        readonly title: "Font family is not registered; default font used";
        readonly hint: "Register the font in ViroSpecsAssetRegistry fontIds/fonts under the fontFamily name.";
    };
    readonly VS5008: {
        readonly severity: "warning";
        readonly title: "maxLines is approximated by the text box height";
        readonly hint: "Lens Text has no line limit. The host sizes the text box to maxLines lines and truncates overflow; give the node extents for exact layout.";
    };
    readonly VS5009: {
        readonly severity: "error";
        readonly title: "Listener or action handler threw";
        readonly hint: "The exception was caught so the Lens keeps running. Fix the listener named in the message.";
    };
    readonly VS5010: {
        readonly severity: "info";
        readonly title: "Resource cache is full; least recently used entry released";
        readonly hint: "Raise maxCachedMaterials if this repeats every frame.";
    };
    readonly VS5011: {
        readonly severity: "warning";
        readonly title: "Placeholder visual is unavailable";
        readonly hint: "Set placeholderMaterial (or defaultImageMaterial) on ViroSpecsAssetRegistry so missing assets render as a tinted box instead of an empty node.";
    };
    readonly VS5012: {
        readonly severity: "warning";
        readonly title: "Material lightingModel is not mapped";
        readonly hint: "Lens shading comes from the base material, not from lightingModel. Register a Lens material under the material ID to control shading.";
    };
    readonly VS5013: {
        readonly severity: "warning";
        readonly title: "Patch op skipped";
        readonly hint: "The op named a node that does not exist or would create a parent cycle. The rest of the patch applied.";
    };
    readonly VS5014: {
        readonly severity: "error";
        readonly title: "Backend operation failed";
        readonly hint: "A Lens call threw while updating a committed node. The node keeps its previous state; the message names the operation.";
    };
    readonly VS5015: {
        readonly severity: "error";
        readonly title: "Action is not declared";
        readonly hint: "Declare the action ID in the scene's actions list and in the ViroSpecsActionRegistry. The trigger or dispatch was dropped.";
    };
    readonly VS5016: {
        readonly severity: "error";
        readonly title: "Action is declared or handled twice";
        readonly hint: "Action IDs are unique per scene and per registry. The first declaration or handler stays; remove the second.";
    };
    readonly VS5017: {
        readonly severity: "error";
        readonly title: "Action payload does not match its declaration";
        readonly hint: "The fieldPath names the field: missing, unknown, wrong type or not in enum. The action was dropped and state is unchanged.";
    };
    readonly VS5018: {
        readonly severity: "info";
        readonly title: "Queued action invalidated by navigation";
        readonly hint: "No action needed. The scene that showed the node was retired before the action ran, so it was dropped.";
    };
    readonly VS5019: {
        readonly severity: "warning";
        readonly title: "Declared action has no handler";
        readonly hint: "Register a handler with ViroSpecsActionRegistry.on, or set forward on ViroSpecsActionRuntime to send the action to a phone app.";
    };
    readonly VS5020: {
        readonly severity: "info";
        readonly title: "Route memory is full; least recently used route forgotten";
        readonly hint: "Scroll positions of the forgotten route reset when it is shown again. Raise maxRememberedRoutes if this repeats.";
    };
    readonly VS5021: {
        readonly severity: "info";
        readonly title: "Capability degraded; dependent UI hidden";
        readonly hint: "No action needed for the build. The message names the capability, its state and the UI the experience layer hid; the wearer sees a one-line notice.";
    };
    readonly VS5022: {
        readonly severity: "warning";
        readonly title: "Text raised to the 1.2 degree minimum";
        readonly hint: "The text rendered smaller than 1.2 degrees at its distance, so the host raised its size. Size it from the type tokens (PanelText) to avoid the clamp.";
    };
    readonly VS5023: {
        readonly severity: "warning";
        readonly title: "Position clamped into the 0.6-3.0 m comfort band";
        readonly hint: "A placement or drag would have put the node nearer than 0.6 m or farther than 3.0 m; the host stopped it at the band edge.";
    };
    readonly VS5024: {
        readonly severity: "info";
        readonly title: "Gaze-only input active";
        readonly hint: "Hand tracking is not available, so selection works by gaze dwell and drag is replaced by step buttons. It switches back when hand tracking returns.";
    };
    readonly VS5025: {
        readonly severity: "warning";
        readonly title: "Premium component feature not drawn by this host";
        readonly hint: "The scene carries a premium feature this host version does not draw; the message names the node and the features. The current Lens host draws every premium feature (ModelViewer load ring, Reset model button and autoRotate; PanelImage radius.card corners), so it reports none. See doc/Experience.md#not-drawn-yet.";
    };
};
/** Codes in {@linkcode VIRO_SPECS_HOST_DIAGNOSTICS}. */
export type ViroSpecsHostDiagnosticCode = keyof typeof VIRO_SPECS_HOST_DIAGNOSTICS;
/** A finding reported by the Lens-side host. */
export type ViroSpecsHostDiagnostic = {
    readonly code: ViroSpecsHostDiagnosticCode;
    readonly severity: ViroSpecsHostDiagnosticSeverity;
    readonly phase: ViroSpecsHostPhase;
    readonly message: string;
    readonly hint: string;
    /** Node, polyline, light or material the finding is about. */
    readonly nodeId?: string;
    /** JSON Pointer into the scene document. */
    readonly fieldPath?: string;
    /** Scene revision the finding belongs to. */
    readonly sceneRevision?: number;
};
/** Optional fields when creating a diagnostic. */
export type ViroSpecsHostDiagnosticDetails = {
    readonly nodeId?: string;
    readonly fieldPath?: string;
    readonly sceneRevision?: number;
    readonly hint?: string;
};
/** Builds a diagnostic with the catalog severity and default hint. */
export declare function createViroSpecsHostDiagnostic(code: ViroSpecsHostDiagnosticCode, phase: ViroSpecsHostPhase, message: string, details?: ViroSpecsHostDiagnosticDetails): ViroSpecsHostDiagnostic;
/** One line for logs: `[viro-specs-host] error VS5002 (validate) /nodes/0/kind: ...`. */
export declare function formatViroSpecsHostDiagnostic(diagnostic: ViroSpecsHostDiagnostic): string;
/** Cleanup handle returned by listener registration. `remove` is idempotent. */
export type ViroSpecsSubscription = {
    remove(): void;
};
/** Options for {@linkcode ViroSpecsHostDiagnostics}. */
export type ViroSpecsHostDiagnosticsOptions = {
    /** Number of recent diagnostics kept for inspection. Default 64. */
    readonly historyLimit?: number;
    /** Where every diagnostic is also written, for example Lens `print`. */
    readonly log?: (line: string) => void;
};
/**
 * Fan-out channel for host diagnostics. Listeners are additive and each
 * owns its subscription. A listener that throws does not stop delivery to
 * the others; the failure is recorded as `VS5009` in {@linkcode recent} and
 * the log, and is not re-dispatched (which could loop).
 */
export declare class ViroSpecsHostDiagnostics {
    private readonly listeners;
    private readonly history;
    private readonly historyLimit;
    private readonly log;
    private readonly counts;
    constructor(options?: ViroSpecsHostDiagnosticsOptions);
    /** Most recent diagnostics, oldest first, at most `historyLimit`. */
    get recent(): readonly ViroSpecsHostDiagnostic[];
    /** Totals since creation, by severity. History eviction does not lower them. */
    get totals(): Readonly<Record<ViroSpecsHostDiagnosticSeverity, number>>;
    /** Registers a listener. Call `remove()` on the result to stop delivery. */
    addOnDiagnosticListener(listener: (diagnostic: ViroSpecsHostDiagnostic) => void): ViroSpecsSubscription;
    /** Records and delivers one diagnostic. Never throws. */
    report(diagnostic: ViroSpecsHostDiagnostic): void;
    /** Drops listeners and history. Idempotent. */
    dispose(): void;
    private record;
}
/** Message text for an unknown thrown value. */
export declare function describeError(error: unknown): string;

// ---- ViroSpecsPlacement.d.ts
import { type ViroSpecsSpatialTokens } from "./ViroSpecsExperienceTokens";
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
export declare function classifyViroSpecsSurface(hit: ViroSpecsPlacementHit, context?: ViroSpecsSurfaceContext): ViroSpecsSurfaceClass;
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
export type ViroSpecsPlacementResult = {
    readonly placed: true;
    readonly position: Vec3;
    readonly normal: Vec3;
    readonly surface: ViroSpecsSurfaceClass;
} | {
    readonly placed: false;
};
/** Options for {@linkcode ViroSpecsPlacementSession}. */
export type ViroSpecsPlacementOptions = {
    readonly tokens: ViroSpecsSpatialTokens;
    /** Reduced motion: the countdown is shown as the word "Cancelling" instead of a draining ring. */
    readonly reducedMotion?: boolean;
    /** Called with the label key each time the session places or cancels. */
    readonly onSettled?: (result: "confirmed" | "cancelled") => void;
};
/**
 * One placement attempt. Feed it every WorldQuery result with
 * {@linkcode update}, call {@linkcode pinch} on pinch release, and render
 * {@linkcode view}. Look-away: no valid hit (no surface, unknown surface, or
 * outside the 0.6-3.0 m band) for `input.lookAwayCancelMs` without a break.
 * Any valid hit resets the timer.
 */
export declare class ViroSpecsPlacementSession {
    private readonly options;
    private phase;
    private lastHit;
    private lastValid;
    private surface;
    private labelSurface;
    private labelChangedAtMs;
    private invalidSinceMs;
    private nowMs;
    private floorY;
    private hintShown;
    private hintConsumed;
    private placed;
    constructor(options: ViroSpecsPlacementOptions);
    /** Current phase. */
    get currentPhase(): ViroSpecsPlacementPhase;
    /** Pose of the confirmed placement, or undefined. */
    get placedPose(): {
        readonly position: Vec3;
        readonly normal: Vec3;
    } | undefined;
    /** Starts a new attempt (Place again). The first-time hint does not return after a cancel. */
    restart(): void;
    /**
     * Feeds one hit-test result (or `null` for no hit) at `nowMs`. Returns the
     * phase after the update.
     */
    update(hit: ViroSpecsPlacementHit | null, nowMs: number): ViroSpecsPlacementPhase;
    /**
     * Pinch release. Places when the latest hit is valid (also during the
     * countdown, when the hit became valid again); otherwise does nothing.
     */
    pinch(): ViroSpecsPlacementResult;
    /** Cancels without waiting (for example when world-query degrades mid-countdown). */
    cancel(): void;
    /** The reticle to draw now. */
    view(): ViroSpecsReticleView;
}
export {};

// ---- ViroSpecsPresentation.d.ts
/**
 * ViroSpecsPresentation: protocol 1 pages with string actions, presented
 * through a {@linkcode ViroSpecsSceneController}.
 *
 * A page is a protocol 1 scene plus `targets` that map node IDs to action
 * strings. Each page becomes a protocol 2 document whose targets are
 * `select` interactions, and the controller presents it transactionally: the
 * page is staged under a disabled root and the previous page is retired only
 * after the new one is enabled. A rejected or failed page leaves the previous
 * page on screen with its targets live.
 *
 * Dependency-free and free of Lens globals. The Lens component is
 * ViroSpecsPresentationHost, which runs this on a
 * ViroSpecsSceneControllerHost.
 */
import type { ViroSpecsHostInteraction, ViroSpecsSceneDocumentV2, ViroSpecsSceneSnapshot } from "./ViroSpecsProtocol";
import { type ViroSpecsSubscription } from "./ViroSpecsHostDiagnostics";
import type { ViroSpecsCancel } from "./ViroSpecsSceneBackend";
import type { ViroSpecsApplyResult } from "./ViroSpecsSceneController";
/** A plain JSON page prepared by the phone/app host, not Lens React. */
export type ViroSpecsPresentationSnapshot = {
    scene: ViroSpecsSceneSnapshot;
    /** Nodes that fire `action` on a completed pinch. Each node at most once. */
    targets: {
        targetId: string;
        action: string;
    }[];
};
/**
 * The scene owner a {@linkcode ViroSpecsPresentation} draws into. Both
 * {@linkcode ViroSpecsSceneController} and ViroSpecsSceneControllerHost
 * satisfy it.
 */
export interface ViroSpecsPresentationScene {
    present(input: unknown): ViroSpecsApplyResult;
    clear(): void;
    queueAction(action: () => void): ViroSpecsCancel;
    addOnInteractionListener(listener: (event: ViroSpecsHostInteraction) => void): ViroSpecsSubscription;
}
/**
 * Converts a presentation page to the protocol 2 document
 * {@linkcode ViroSpecsPresentation.present} hands to the controller.
 *
 * Protocol 1 `textStyle.size` becomes `style.fontSize` (the Lens backend
 * draws one Lens text size per point) and `textStyle.color` becomes an
 * `#RRGGBBAA` string. Every target becomes a `select` interaction without
 * manipulation.
 *
 * @throws Error naming every problem when the page is not a valid, non-empty
 * protocol 1 scene or a target is unknown, duplicated or has no action.
 */
export declare function toViroSpecsPresentationDocument(snapshot: ViroSpecsPresentationSnapshot): ViroSpecsSceneDocumentV2;
/**
 * Presents protocol 1 pages on a scene controller and delivers their string
 * actions.
 *
 * @example
 * const presentation = new ViroSpecsPresentation(sceneHost);
 * const stop = presentation.subscribeAction((action) => app.onAction(action));
 * presentation.present({ scene, targets: [{ targetId: "go", action: "open:apollo" }] });
 * stop();
 * presentation.dispose();
 */
export declare class ViroSpecsPresentation {
    private readonly scene;
    private readonly listeners;
    private targets;
    /** Revision of the page this presentation committed, 0 when none. */
    private revision;
    private subscription;
    private disposed;
    constructor(scene: ViroSpecsPresentationScene);
    /**
     * Adds an action listener. Actions arrive one frame after the pinch, and
     * only while the page that showed the target is still presented.
     *
     * @returns Removes the listener. Idempotent.
     */
    subscribeAction(listener: (action: string) => void): () => void;
    /**
     * Replaces the presented page transactionally. Until the new page is
     * enabled, the previous page and its targets stay live.
     *
     * @throws Error when the page is invalid or the controller rejects it. The
     * previous page is untouched in both cases.
     */
    present(snapshot: ViroSpecsPresentationSnapshot): void;
    /** Removes the presented page. Queued actions of the page are dropped. */
    clear(): void;
    /** Clears the page and drops every listener. Idempotent. */
    dispose(): void;
    private onInteraction;
}

// ---- ViroSpecsProtocol.d.ts
/**
 * Dependency-free wire protocol consumed inside Lens Studio.
 *
 * Keep this file free of npm/workspace imports. The shared TypeScript compiler
 * produces structurally compatible payloads; Lens Studio only needs these
 * serialized shapes and official .lspkg dependencies.
 */
import type { ViroSpecsComponentSpec, ViroSpecsTheme } from "./ViroSpecsExperienceTokens";
export declare const VIRO_SPECS_WIRE_VERSION: 1;
/**
 * Scene protocols ViroSpecsSceneController reads. Protocol 1 is
 * {@linkcode ViroSpecsSceneSnapshot}; protocol 2 is
 * {@linkcode ViroSpecsSceneDocumentV2}, which carries text style, extents,
 * maxLines, opacity, materials and lights. Anything else is rejected with
 * host diagnostic VS5001 before the live scene is touched.
 */
export declare const VIRO_SPECS_SCENE_PROTOCOLS: readonly [1, 2];
/** One of {@linkcode VIRO_SPECS_SCENE_PROTOCOLS}. */
export type ViroSpecsSceneProtocol = (typeof VIRO_SPECS_SCENE_PROTOCOLS)[number];
/** `[x, y, z]`. */
export type ViroSpecsVec3 = [number, number, number];
/** Unit quaternion `[x, y, z, w]`. */
export type ViroSpecsQuat = [number, number, number, number];
/** Width and height in meters. */
export type ViroSpecsExtents = {
    width: number;
    height: number;
};
/**
 * Text style from manifest v2 (`ViroText` `style`). `fontSize` is in Viro
 * points; colors are `#RRGGBB` or `#RRGGBBAA`.
 */
export type ViroSpecsDocumentTextStyle = {
    fontFamily?: string;
    fontSize?: number;
    fontWeight?: "normal" | "bold" | "100" | "200" | "300" | "400" | "500" | "600" | "700" | "800" | "900";
    fontStyle?: "normal" | "italic";
    color?: string;
    textAlign?: "left" | "center" | "right";
    textAlignVertical?: "top" | "center" | "bottom";
};
/** Fields every protocol 2 node kind shares. */
export type ViroSpecsDocumentNodeBase = {
    id: string;
    parentId?: string;
    position?: ViroSpecsVec3;
    rotation?: ViroSpecsQuat;
    scale?: ViroSpecsVec3;
    visible?: boolean;
    /** 0 to 1. */
    opacity?: number;
    /** Entry in `materials`, or a material in the Lens asset registry. */
    materialId?: string;
    /** Accessible name. Required by the compilers on interactable nodes (VS3016). */
    label?: string;
    /** Premium component; drawn by the experience layer from `theme` tokens. */
    component?: ViroSpecsComponentSpec;
};
/** Protocol 2 node, discriminated by `kind`. Video and sound never reach the wire. */
export type ViroSpecsDocumentNode = (ViroSpecsDocumentNodeBase & {
    kind: "group";
    scroll?: ViroSpecsScroll;
}) | (ViroSpecsDocumentNodeBase & {
    kind: "text";
    text: string;
    style?: ViroSpecsDocumentTextStyle;
    extents?: ViroSpecsExtents;
    maxLines?: number;
}) | (ViroSpecsDocumentNodeBase & {
    kind: "image";
    source: string;
    extents?: ViroSpecsExtents;
}) | (ViroSpecsDocumentNodeBase & {
    kind: "model";
    source: string;
    format?: "glb" | "gltf" | "obj" | "fbx";
}) | (ViroSpecsDocumentNodeBase & {
    kind: "panel";
    extents?: ViroSpecsExtents;
});
/** World-space line, meters. */
export type ViroSpecsDocumentPolyline = {
    id: string;
    points: ViroSpecsVec3[];
    radiusMeters: number;
    materialId?: string;
    primitive?: "volumetric-line";
    backendPackage?: string;
};
/** Light from a Viro light component. Intensity in Viro lumens (1000 = default). */
export type ViroSpecsDocumentLight = {
    id: string;
    parentId?: string;
    color?: string;
    intensity?: number;
} & ({
    type: "ambient";
} | {
    type: "directional";
    direction: ViroSpecsVec3;
} | {
    type: "omni";
    position: ViroSpecsVec3;
} | {
    type: "spot";
    position: ViroSpecsVec3;
    direction: ViroSpecsVec3;
    innerAngle?: number;
    outerAngle?: number;
});
/** Material definition. The host builds an owned material from it. */
export type ViroSpecsDocumentMaterial = {
    id: string;
    color?: string;
    opacity?: number;
    /** Image asset ID. */
    texture?: string;
    lightingModel?: "constant" | "lambert" | "blinn" | "phong" | "pbr";
};
/** Value type of one action payload field. `integer` is a whole `number`. */
export type ViroSpecsActionFieldType = "string" | "number" | "integer" | "boolean";
/** One field of an action payload declaration. */
export type ViroSpecsActionField = {
    type: ViroSpecsActionFieldType;
    /** Allowed values. Only valid on `string` fields. */
    enum?: string[];
    /** When true the field may be absent. Default false. */
    optional?: boolean;
};
/**
 * Declares one semantic action: a stable ID and the type of its payload.
 * IDs match {@linkcode VIRO_SPECS_ACTION_ID_PATTERN}, for example
 * `exhibit.open`. A payload is a flat object of strings, numbers and
 * booleans, so it crosses any transport as JSON and never carries a closure.
 */
export type ViroSpecsActionDeclaration = {
    id: string;
    /** Field name to type. Absent means the action takes an empty payload. */
    payload?: Record<string, ViroSpecsActionField>;
};
/** Lowercase dot-separated segments: `exhibit.open`, `settings.set-units`. */
export declare const VIRO_SPECS_ACTION_ID_PATTERN: RegExp;
/** A payload value. */
export type ViroSpecsActionValue = string | number | boolean;
/** An action payload: flat, JSON-safe. */
export type ViroSpecsActionPayload = Record<string, ViroSpecsActionValue>;
/** Interaction moment that fires a trigger. `select` is a completed pinch or click. */
export type ViroSpecsActionTriggerEvent = "select" | "hover-enter" | "hover-exit";
/** Fires a declared action with a fixed payload when its node sees `on`. */
export type ViroSpecsActionTrigger = {
    on: ViroSpecsActionTriggerEvent;
    actionId: string;
    /** Checked against the action's declaration. Absent means `{}`. */
    payload?: ViroSpecsActionPayload;
};
/** Interaction intent for one node. */
export type ViroSpecsDocumentInteraction = {
    nodeId: string;
    interactable: true;
    manipulation: boolean;
    events: ("hover" | "select" | "drag")[];
    /** Actions this node fires. `select` needs `select` in `events`, hover triggers need `hover`. */
    triggers?: ViroSpecsActionTrigger[];
};
/**
 * A typed action raised by a trigger on the committed scene, or dispatched
 * by app code. Delivered by `ViroSpecsSceneController.addOnActionListener`
 * one frame after the interaction, and only if the scene that showed the
 * node is still committed.
 */
export type ViroSpecsActionEvent = {
    actionId: string;
    payload: ViroSpecsActionPayload;
    /** Node whose trigger fired. Absent for app-dispatched actions. */
    nodeId?: string;
    /** Interaction moment. Absent for app-dispatched actions. */
    on?: ViroSpecsActionTriggerEvent;
    source?: ViroSpecsHostInteractionSource;
    /** Revision of the scene the wearer interacted with. */
    sceneRevision: number;
    timestampMs: number;
};
/** Animation on one node. `plan.backendPackage` is optional on the wire. */
export type ViroSpecsDocumentAnimation = {
    nodeId: string;
    name: string;
    plan: Omit<ViroSpecsNativeAnimationPlan, "backendPackage" | "easing"> & {
        backendPackage?: string;
        easing: ViroSpecsAnimationEasing;
    };
};
/**
 * Scene protocol 2: the manifest v2 document minus authoring metadata and
 * the media kinds no host plays. One document describes one scene; the
 * controller diffs consecutive documents by ID.
 */
export type ViroSpecsSceneDocumentV2 = {
    version: 2;
    /**
     * Route the scene belongs to, for example `list` or `details`. When an
     * update names a different route than the committed scene, the controller
     * navigates (transactional replacement) instead of patching, and restores
     * the scroll positions it remembered for the route it returns to.
     */
    route?: string;
    /** Actions the scene's triggers fire. Required when any trigger exists. */
    actions?: ViroSpecsActionDeclaration[];
    nodes: ViroSpecsDocumentNode[];
    polylines?: ViroSpecsDocumentPolyline[];
    lights?: ViroSpecsDocumentLight[];
    materials?: ViroSpecsDocumentMaterial[];
    interactions?: ViroSpecsDocumentInteraction[];
    animations?: ViroSpecsDocumentAnimation[];
    /** Spatial tokens and preferences. Absent means the host's default theme. */
    theme?: ViroSpecsTheme;
};
/** Interaction sources the host reports. */
export type ViroSpecsHostInteractionSource = "hand-left" | "hand-right" | "gaze" | "synthetic";
/**
 * Interaction event the controller delivers. Positions, normals and
 * directions are world space; positions are meters.
 */
export type ViroSpecsHostInteraction = {
    nodeId: string;
    phase: ViroSpecsInteractionPhase;
    source: ViroSpecsHostInteractionSource;
    position?: ViroSpecsVec3;
    normal?: ViroSpecsVec3;
    direction?: ViroSpecsVec3;
    timestampMs: number;
    /** Revision of the scene that owned the node when the event fired. */
    sceneRevision: number;
};
export type ViroSpecsNodeKind = "group" | "text" | "image" | "model" | "panel";
/** Mirrors PortableXRTextStyle: size in Lens points, color linear RGBA 0..1. */
export type ViroSpecsTextStyle = {
    size?: number;
    color?: [number, number, number, number];
};
/** Mirrors PortableXRScroll: metres; children use y = 0 at the content top, negative down. */
export type ViroSpecsScroll = {
    width: number;
    height: number;
    contentHeight: number;
};
export type ViroSpecsSceneNode = {
    id: string;
    kind: ViroSpecsNodeKind;
    parentId?: string;
    position?: [number, number, number];
    rotation?: [number, number, number, number];
    scale?: [number, number, number];
    source?: string;
    text?: string;
    textStyle?: ViroSpecsTextStyle;
    scroll?: ViroSpecsScroll;
    visible?: boolean;
};
export type ViroSpecsSceneSnapshot = {
    version: 1;
    nodes: ViroSpecsSceneNode[];
};
export type ViroSpecsRenderPrimitive = "scene-object" | "text" | "image" | "render-mesh" | "ui-frame";
export type ViroSpecsRenderDiagnostic = {
    level: "warning" | "error";
    nodeId?: string;
    message: string;
};
export type ViroSpecsRenderCommand = {
    op: "create";
    id: string;
    parentId?: string;
    primitive: ViroSpecsRenderPrimitive;
} | {
    op: "transform";
    id: string;
    position?: [number, number, number];
    rotation?: [number, number, number, number];
    scale?: [number, number, number];
} | {
    op: "content";
    id: string;
    text?: string;
    source?: string;
    textStyle?: ViroSpecsTextStyle;
    scroll?: ViroSpecsScroll;
} | {
    op: "visibility";
    id: string;
    visible: boolean;
};
export type ViroSpecsRenderPlan = {
    version: 1;
    commands: ViroSpecsRenderCommand[];
    diagnostics: ViroSpecsRenderDiagnostic[];
};
export type ViroSpecsAnimationEasing = "linear" | "ease-in" | "ease-out" | "ease-in-out" | {
    cubicBezier: [number, number, number, number];
};
export type ViroSpecsAnimationTrackTarget = "transform.position.x" | "transform.position.y" | "transform.position.z" | "transform.scale.x" | "transform.scale.y" | "transform.scale.z" | "transform.rotation.x" | "transform.rotation.y" | "transform.rotation.z" | "material.opacity";
export type ViroSpecsAnimationTrackPlan = {
    target: ViroSpecsAnimationTrackTarget;
    from: "current";
    to: number;
};
export type ViroSpecsNativeAnimationPlan = {
    engine: "AnimationPlayer";
    backendPackage: "AnimationExamples";
    durationSeconds: number;
    delaySeconds: number;
    easing: ViroSpecsAnimationEasing;
    playbackMode: "single" | "loop";
    completionEvent: string;
    tracks: ViroSpecsAnimationTrackPlan[];
};
export type ViroSpecsInteractionSource = "gaze" | "hand" | "pinch" | "controller" | "voice" | "touch" | "neural-band";
export type ViroSpecsInteractionPhase = "hover-enter" | "hover-move" | "hover-exit" | "select-start" | "select-end" | "drag" | "cancel";
export type ViroSpecsPortableInteraction = {
    source: ViroSpecsInteractionSource;
    phase: ViroSpecsInteractionPhase;
    targetId?: string;
    position?: [number, number, number];
    /** Surface normal at the hit, world space. */
    normal?: [number, number, number];
    direction?: [number, number, number];
    timestampMs?: number;
    /** Which hand, gaze or synthetic input produced the event. */
    inputSource?: ViroSpecsHostInteractionSource;
};
export type ViroSpecsSurfaceClassification = "floor" | "wall" | "ceiling" | "table" | "seat" | "unknown";
export type ViroSpecsWorldQueryRequest = {
    origin: [number, number, number];
    direction: [number, number, number];
    maxDistance?: number;
    classifications?: readonly ViroSpecsSurfaceClassification[];
};
export type ViroSpecsARHitTestResult = {
    position: [number, number, number];
    normal?: [number, number, number];
    distance: number;
    surface: ViroSpecsSurfaceClassification;
    confidence?: number;
};
export type ViroSpecsSurfacePlacementMode = "near-surface" | "horizontal" | "vertical";
export type ViroSpecsPlacementPose = {
    position: [number, number, number];
    rotation: [number, number, number, number];
    surface?: ViroSpecsSurfaceClassification;
};
export type ViroSpecsGeoCoordinate = {
    latitude: number;
    longitude: number;
    altitudeMeters?: number;
};
export type ViroSpecsNavigationPlace = {
    id: string;
    name?: string;
    coordinate: ViroSpecsGeoCoordinate;
};
export type ViroSpecsNavigationRoute = {
    id: string;
    points: readonly ViroSpecsGeoCoordinate[];
    destination?: ViroSpecsNavigationPlace;
};
export type ViroSpecsNavigationPlan = {
    route: ViroSpecsNavigationRoute;
    line: {
        widthMeters: number;
        verticalOffsetMeters?: number;
        materialId?: string;
    };
    packages: readonly ["SpecsNavigationKit", "VolumetricLine"];
};
export type ViroSpecsVolumetricLinePlan = {
    primitive: "volumetric-line";
    backendPackage: "VolumetricLine";
    points: readonly [number, number, number][];
    radiusMeters: number;
    materialId?: string;
};
export type ViroSpecsCapabilityState = "supported" | "unsupported" | "permission-required" | "temporarily-unavailable" | "unverified";
export type ViroSpecsCapabilityReport = Record<string, ViroSpecsCapabilityState>;
export declare function compileLensRenderPlan(scene: ViroSpecsSceneSnapshot): ViroSpecsRenderPlan;

// ---- ViroSpecsReferenceFlow.d.ts
/**
 * Reference flow for typed actions: select a card, see its details, change a
 * setting, see the view update, go back to the list at the scroll position
 * it was left at. Runs standalone in the Lens (no phone, no server).
 *
 * The same flow ships in viro as the React Native Platform Lab screen
 * `SpecsActionsLab` (Zustand store) and as compiled fixtures; IDs, action
 * declarations and node IDs match so either side can drive the other.
 *
 * Dependency-free and free of Lens globals.
 */
import type { ViroSpecsActionDeclaration, ViroSpecsSceneDocumentV2 } from "./ViroSpecsProtocol";
import type { ViroSpecsHostDiagnostics } from "./ViroSpecsHostDiagnostics";
import { ViroSpecsActionRegistry } from "./ViroSpecsActionRuntime";
/** One card in the list. */
export type ViroSpecsReferenceExhibit = {
    readonly id: string;
    readonly title: string;
    readonly distanceMeters: number;
};
/** Distance unit setting. */
export type ViroSpecsReferenceUnits = "metric" | "imperial";
/** App state of the reference flow. */
export type ViroSpecsReferenceFlowState = {
    readonly route: "list" | "details";
    readonly exhibits: readonly ViroSpecsReferenceExhibit[];
    /** Card shown on the details route and highlighted on the list. */
    readonly selectedId?: string;
    readonly units: ViroSpecsReferenceUnits;
};
/** Action declarations: the contract both the Lens and a phone app use. */
export declare const VIRO_SPECS_REFERENCE_ACTIONS: ViroSpecsActionDeclaration[];
/** Eight cards, more than the list window shows, so the list scrolls. */
export declare const VIRO_SPECS_REFERENCE_INITIAL_STATE: ViroSpecsReferenceFlowState;
/** Pure reducers for the reference actions. */
export declare function registerViroSpecsReferenceHandlers(registry: ViroSpecsActionRegistry<ViroSpecsReferenceFlowState>): void;
/** Registry with the reference declarations and handlers. */
export declare function createViroSpecsReferenceRegistry(diagnostics: ViroSpecsHostDiagnostics): ViroSpecsActionRegistry<ViroSpecsReferenceFlowState>;
/** Distance label in the chosen units. */
export declare function formatViroSpecsReferenceDistance(meters: number, units: ViroSpecsReferenceUnits): string;
/** Scene for `state`. Pure: same state, same document. */
export declare function viewViroSpecsReferenceFlow(state: ViroSpecsReferenceFlowState): ViroSpecsSceneDocumentV2;

// ---- ViroSpecsResourceCache.d.ts
export declare class ViroSpecsResourceCache<V> {
    private readonly maxIdle;
    private readonly disposeValue;
    private readonly onEvict;
    private readonly entries;
    private disposed;
    /**
     * @param maxIdle Unheld entries kept for reuse. Held entries are never evicted.
     * @param disposeValue Frees one value. Called exactly once per value.
     * @param onEvict Told about each eviction, for diagnostics.
     */
    constructor(maxIdle: number, disposeValue: (value: V) => void, onEvict?: (key: string) => void);
    /** Entries currently cached, held or idle. */
    get size(): number;
    /** Holders of `key`, 0 when absent. */
    holdersOf(key: string): number;
    /**
     * Returns the cached value for `key`, building it with `create` when
     * missing. `holder` identifies the scene that holds it. Returns null when
     * `create` returns null; nothing is cached then.
     */
    acquire(key: string, holder: number, create: () => V | null): V | null;
    /** Drops every key `holder` holds, then evicts idle entries over the bound. */
    releaseHolder(holder: number): void;
    /** Drops `holder` from every key not in `keep`, then evicts idle entries over the bound. */
    releaseUnused(holder: number, keep: ReadonlySet<string>): void;
    /** Disposes everything. Idempotent. */
    dispose(): void;
    private evict;
}

// ---- ViroSpecsSceneBackend.d.ts
/**
 * Contract between ViroSpecsSceneController and whatever draws the scene.
 *
 * The Lens implementation is ViroSpecsLensSceneBackend; tests use a mock
 * that records every call. The controller owns ordering, ownership and
 * diagnostics; a backend owns only "make this SceneObject look like this".
 *
 * Backends may throw. The controller catches every backend exception and
 * turns it into a host diagnostic, so a backend never has to.
 *
 * Dependency-free and free of Lens globals.
 */
import type { ViroSpecsDocumentInteraction, ViroSpecsDocumentLight, ViroSpecsDocumentMaterial, ViroSpecsDocumentPolyline, ViroSpecsExtents, ViroSpecsHostInteractionSource, ViroSpecsInteractionPhase, ViroSpecsNativeAnimationPlan, ViroSpecsQuat, ViroSpecsScroll, ViroSpecsVec3 } from "./ViroSpecsProtocol";
import type { ViroSpecsHostNode, ViroSpecsResolvedTextStyle } from "./ViroSpecsSceneDocument";
/** Stops a scheduled callback or a subscription. Calling it twice is harmless. */
export type ViroSpecsCancel = () => void;
/**
 * Frame clock. On Lens this is DelayedCallbackEvent; in tests a manual queue.
 * Callbacks never run synchronously inside the scheduling call.
 */
export interface ViroSpecsHostScheduler {
    /** Runs `callback` on the next frame. */
    nextFrame(callback: () => void): ViroSpecsCancel;
    /** Runs `callback` after `seconds`. */
    after(seconds: number, callback: () => void): ViroSpecsCancel;
    /** Milliseconds since an arbitrary epoch, for event timestamps. */
    nowMs(): number;
}
/** Node kinds a backend creates. Lights and polylines get their own calls. */
export type ViroSpecsBackendNodeKind = ViroSpecsHostNode["kind"];
/** Transform in protocol units: meters, `[x, y, z, w]`. Absent means identity. */
export type ViroSpecsBackendTransform = {
    position: ViroSpecsVec3;
    rotation: ViroSpecsQuat;
    scale: ViroSpecsVec3;
};
/** Text content after style resolution. */
export type ViroSpecsBackendText = {
    text: string;
    style: ViroSpecsResolvedTextStyle;
    extents?: ViroSpecsExtents;
    maxLines?: number;
    /** Font asset name to use, or undefined for the default font. */
    fontFamily?: string;
};
/** UI state that survives patches and, for stable IDs, navigation. */
export type ViroSpecsNodeUiState = {
    /** Normalized scroll position of a scroll group, `[x, y]` in 0..1. */
    scrollNormalized?: [number, number];
};
/**
 * Row stepping of a SpatialScrollView group (`component.type` "scroll-view"),
 * passed to {@linkcode ViroSpecsSceneBackend.setScroll}.
 */
export type ViroSpecsScrollRows = {
    /** One row in meters; drags settle on whole rows. */
    stepMeters: number;
    /** Distance from the content top shown when the backend creates the window. */
    initialOffsetMeters: number;
};
/** Raw interaction a backend reports for one bound node. */
export type ViroSpecsBackendInteraction = {
    phase: ViroSpecsInteractionPhase;
    source: ViroSpecsHostInteractionSource;
    position?: ViroSpecsVec3;
    normal?: ViroSpecsVec3;
    direction?: ViroSpecsVec3;
};
/**
 * Drawing operations. `N` is the backend's node handle, `A` an asset handle
 * (texture or prefab), `M` a material handle.
 */
export interface ViroSpecsSceneBackend<N, A, M> {
    /** Creates a disabled container for one scene. Staging builds under it. */
    createSceneRoot(revision: number): N;
    /** Shows or hides a scene root or node subtree without changing `visible`. */
    setEnabled(node: N, enabled: boolean): void;
    /** Creates the SceneObject and kind-specific components for `spec` under `parent`. */
    createNode(spec: ViroSpecsHostNode, parent: N): N;
    /** Moves `node` under `parent`, keeping its local transform. */
    setParent(node: N, parent: N): void;
    /** Destroys `node`, its children and everything it owns. */
    destroy(node: N): void;
    setTransform(node: N, transform: ViroSpecsBackendTransform): void;
    setVisible(node: N, visible: boolean): void;
    /** 0..1. The backend clones whatever materials it must, and owns the clones. */
    setOpacity(node: N, opacity: number): void;
    setText(node: N, text: ViroSpecsBackendText): void;
    /** Size of an image or panel surface in meters. */
    setExtents(node: N, extents: ViroSpecsExtents): void;
    /**
     * Makes `node` a vertical scroll window. Content `y = 0` is the window's top
     * edge. The first call creates the window at the content top, or at
     * `rows.initialOffsetMeters`; later calls resize it and keep the position.
     */
    setScroll(node: N, scroll: ViroSpecsScroll, rows?: ViroSpecsScrollRows): void;
    /** Moves a scroll window's content by `deltaMeters` (positive is further down the list), clamped to its ends. */
    scrollBy(node: N, deltaMeters: number): void;
    /** Binds a loaded image texture or model prefab. */
    setAsset(node: N, asset: A): void;
    /**
     * Shows a bounded tinted box in place of a missing asset. Returns false
     * when the backend has nothing to draw it with.
     */
    showPlaceholder(node: N, extents: ViroSpecsExtents): boolean;
    clearPlaceholder(node: N): void;
    /** Applies a material, or the backend default when `material` is null. */
    setMaterial(node: N, material: M | null): void;
    /** Starts loading an asset. Sync registries return the asset or null. */
    loadAsset(kind: "image" | "model", source: string): A | null | Promise<A | null>;
    /** A material the app registered. Borrowed: the controller never disposes it. */
    resolveMaterial(id: string): M | null;
    /** Builds a material the controller owns. Null when the backend has no base material. */
    createMaterial(definition: ViroSpecsDocumentMaterial, texture: A | null): M | null;
    disposeMaterial(material: M): void;
    /** Whether a font with this family name is registered. */
    hasFont(family: string): boolean;
    createLight(light: ViroSpecsDocumentLight, parent: N): N;
    createPolyline(line: ViroSpecsDocumentPolyline, material: M | null, parent: N): N;
    /** Makes `node` interactable. The returned cancel unbinds and releases SIK state. */
    bindInteraction(node: N, interaction: ViroSpecsDocumentInteraction, emit: (event: ViroSpecsBackendInteraction) => void): ViroSpecsCancel;
    /** Plays one animation. `onComplete` fires once for `single` playback. Cancel stops it. */
    playAnimation(node: N, plan: ViroSpecsNativeAnimationPlan, onComplete: () => void): ViroSpecsCancel;
    captureUiState(node: N): ViroSpecsNodeUiState;
    restoreUiState(node: N, state: ViroSpecsNodeUiState): void;
}

// ---- ViroSpecsSceneController.d.ts
/**
 * ViroSpecsSceneController: the Lens-side owner of one live Specs scene.
 *
 * Two ways in:
 *
 * - {@linkcode ViroSpecsSceneController.present} replaces the scene
 *   (navigation). It is transactional: validate, stage the new scene under a
 *   disabled root, commit by enabling it, then retire the previous scene. If
 *   anything fails before commit, the staging is disposed and the previous
 *   scene is untouched.
 * - {@linkcode ViroSpecsSceneController.update} and
 *   {@linkcode ViroSpecsSceneController.applyPatch} change the committed
 *   scene in place with create, update, remove and reparent ops, so a state
 *   change touches only the nodes whose fields changed. Stable nodes keep
 *   their SceneObjects, and with them scroll, selection and focus.
 *
 * Every scene owns its async work: deferred SIK binding, queued actions,
 * delayed animations and asset loads. Retiring a scene cancels all of it, and
 * a late completion is discarded with VS5006 instead of touching a newer
 * scene.
 *
 * The controller never throws. Failures arrive on the
 * {@linkcode ViroSpecsHostDiagnostics} channel.
 *
 * Dependency-free and free of Lens globals; the Lens binding is
 * ViroSpecsLensSceneBackend plus ViroSpecsSceneControllerHost.
 */
import type { ViroSpecsActionEvent, ViroSpecsDocumentNode, ViroSpecsExtents, ViroSpecsHostInteraction, ViroSpecsVec3 } from "./ViroSpecsProtocol";
import { ViroSpecsHostDiagnostics, type ViroSpecsHostDiagnostic, type ViroSpecsSubscription } from "./ViroSpecsHostDiagnostics";
import { type ViroSpecsHostNode, type ViroSpecsHostScene } from "./ViroSpecsSceneDocument";
import type { ViroSpecsCancel, ViroSpecsHostScheduler, ViroSpecsNodeUiState, ViroSpecsSceneBackend } from "./ViroSpecsSceneBackend";
/** Lifecycle of the committed scene, for loading, degraded and error visuals. */
export type ViroSpecsSceneLifecycle =
/** Nothing committed yet. */
"empty"
/** Committed; some assets are still loading. Animations wait. */
 | "loading"
/** Committed; every asset resolved. */
 | "ready"
/** Committed; at least one asset is missing and shows a placeholder. */
 | "degraded"
/** The first scene was rejected; nothing is on screen. */
 | "error";
/** Explicit change to the committed scene. */
export type ViroSpecsPatchOp =
/** Adds a node. Its parent must exist or be created earlier in the same patch. */
{
    op: "create";
    node: ViroSpecsDocumentNode;
}
/** Replaces a node's fields. `kind` and `parentId` must not change; use remove+create or reparent. */
 | {
    op: "update";
    node: ViroSpecsDocumentNode;
}
/** Removes a node and its subtree. */
 | {
    op: "remove";
    id: string;
}
/** Moves a node. Absent `parentId` means the scene root. */
 | {
    op: "reparent";
    id: string;
    parentId?: string;
};
/** Outcome of a present, update or patch call. */
export type ViroSpecsApplyResult = {
    readonly status: "committed" | "patched";
    readonly revision: number;
    /** Ops applied to nodes, in order. Empty for a full replacement. */
    readonly ops: readonly ViroSpecsPatchOp[];
    readonly diagnostics: readonly ViroSpecsHostDiagnostic[];
} | {
    readonly status: "rejected";
    readonly revision: number;
    readonly diagnostics: readonly ViroSpecsHostDiagnostic[];
};
/** Per-node state that survives patches, and navigation for stable IDs. */
export type ViroSpecsNodeState = ViroSpecsNodeUiState & {
    readonly focused: boolean;
    readonly selected: boolean;
};
/** Construction options. */
export type ViroSpecsSceneControllerOptions = {
    /** Channel to report on. A new one is created when absent. */
    readonly diagnostics?: ViroSpecsHostDiagnostics;
    /** Idle owned materials kept for reuse across scenes. Default 32. */
    readonly maxCachedMaterials?: number;
    /** Placeholder size when a missing asset has no extents. Default 0.2 m square. */
    readonly placeholderExtents?: ViroSpecsExtents;
    /** Routes whose scroll positions are remembered for back navigation. Default 16. */
    readonly maxRememberedRoutes?: number;
};
/**
 * Owns one live scene on top of a {@linkcode ViroSpecsSceneBackend}.
 *
 * @example
 * const controller = new ViroSpecsSceneController(backend, scheduler);
 * const sub = controller.diagnostics.addOnDiagnosticListener((d) => print(formatViroSpecsHostDiagnostic(d)));
 * controller.present(GENERATED_SCENE);           // navigation
 * controller.update(nextStateDocument);          // same page, new state
 * controller.dispose();                          // OnDestroyEvent
 */
export declare class ViroSpecsSceneController<N, A, M> {
    private readonly backend;
    private readonly scheduler;
    /** Diagnostics for this controller. */
    readonly diagnostics: ViroSpecsHostDiagnostics;
    private current;
    private revisionCounter;
    private assetToken;
    private disposed;
    private lifecycleValue;
    private focusedId;
    private selectedId;
    private readonly controllerWork;
    private readonly materialCache;
    private readonly placeholderExtents;
    private readonly interactionListeners;
    private dragConstraint;
    private readonly lifecycleListeners;
    private readonly completionListeners;
    private readonly actionListeners;
    /** Route key to the UI state of its scroll groups when the route was left. Insertion order is recency. */
    private readonly routeMemory;
    private readonly maxRememberedRoutes;
    private collecting;
    constructor(backend: ViroSpecsSceneBackend<N, A, M>, scheduler: ViroSpecsHostScheduler, options?: ViroSpecsSceneControllerOptions);
    /** Lifecycle of the committed scene. */
    get lifecycle(): ViroSpecsSceneLifecycle;
    /** Revision of the committed scene, 0 when none. */
    get revision(): number;
    /** IDs of committed nodes, parents first. */
    get nodeIds(): readonly string[];
    /** Async jobs the committed scene still owns. For tests and leak checks. */
    get pendingWork(): number;
    /**
     * Asset loads of the committed scene: `total` image and model nodes, of
     * which `pending` are still loading. The experience layer draws the loading
     * ring from this. Both are 0 when nothing is committed.
     */
    get assetProgress(): {
        readonly pending: number;
        readonly total: number;
    };
    /** True while the committed scene is still loading the image or model asset of node `id`. */
    isAssetPending(id: string): boolean;
    /** The validated scene that is committed, or null. Read-only view for the experience layer. */
    get committedScene(): ViroSpecsHostScene | null;
    /** Owned materials currently cached. */
    get cachedMaterialCount(): number;
    /** Backend handle of a committed node, for host code that adds Lens components. */
    getNodeHandle(id: string): N | null;
    /** Focus, selection and scroll of a committed node. Undefined when absent. */
    getNodeState(id: string): ViroSpecsNodeState | undefined;
    /**
     * Scrolls a committed scroll group by `rows` rows: positive moves further
     * down the list. A SpatialScrollView row is its `itemHeightMeters`; a plain
     * scroll group moves a window height per row. Returns false, and changes
     * nothing, when `id` is not a committed scroll group. Gaze Scroll up/down
     * buttons call this.
     */
    scrollByRows(id: string, rows: number): boolean;
    /** Sets or clears the selected node. Ignored for unknown IDs. */
    setSelected(id: string | undefined): void;
    /** Sets or clears the focused node. Ignored for unknown IDs. */
    setFocused(id: string | undefined): void;
    /**
     * Sets the one drag constraint, replacing the previous one; `undefined`
     * removes it. On every `drag` that carries a position, the constraint gets
     * the node ID and the position (world meters) before any interaction
     * listener or triggered action, and returns the position the node is
     * actually at, which every listener then receives. The experience layer
     * uses it to hold drags inside the comfort band. A constraint that throws
     * is `VS5014` and the event keeps the unconstrained position.
     */
    setDragConstraint(constraint: ((nodeId: string, position: ViroSpecsVec3) => ViroSpecsVec3) | undefined): void;
    /** Interaction events from bound nodes and from {@linkcode dispatchInteraction}. */
    addOnInteractionListener(listener: (event: ViroSpecsHostInteraction) => void): ViroSpecsSubscription;
    /** Lifecycle changes. */
    addOnLifecycleListener(listener: (state: ViroSpecsSceneLifecycle) => void): ViroSpecsSubscription;
    /** Route of the committed scene, when it declares one. */
    get route(): string | undefined;
    /** Routes with remembered scroll positions, least recently left first. */
    get rememberedRoutes(): readonly string[];
    /**
     * Typed actions fired by triggers on the committed scene. Each is
     * delivered one frame after its interaction, and only while the scene that
     * showed the node is still committed; otherwise it is dropped with VS5018.
     */
    addOnActionListener(listener: (event: ViroSpecsActionEvent) => void): ViroSpecsSubscription;
    /** `single` animations that played to the end on the committed scene. */
    addOnAnimationCompleteListener(listener: (nodeId: string, name: string) => void): ViroSpecsSubscription;
    /**
     * Runs `action` on the next frame, owned by the committed scene: if
     * navigation or replacement retires the scene first, the action never
     * runs. Use it for work triggered from inside an SIK callback.
     */
    queueAction(action: () => void): ViroSpecsCancel;
    /**
     * Delivers an interaction that did not come from SIK: a gaze provider, a
     * LEAF scenario or an accessibility switch. Ignored for nodes not in the
     * committed scene.
     */
    dispatchInteraction(event: Omit<ViroSpecsHostInteraction, "timestampMs" | "sceneRevision">): void;
    /**
     * Replaces the committed scene with `input`, transactionally.
     *
     * @param input Parsed JSON: a protocol 2 document or a protocol 1 snapshot.
     */
    present(input: unknown): ViroSpecsApplyResult;
    /**
     * Moves the committed scene to `input` with the smallest set of patch
     * ops. Presents when nothing is committed yet.
     */
    update(input: unknown): ViroSpecsApplyResult;
    /** Applies explicit ops to the committed scene. Invalid ops are skipped with VS5013. */
    applyPatch(ops: readonly ViroSpecsPatchOp[]): ViroSpecsApplyResult;
    /** Removes the committed scene. Lifecycle returns to `empty`. */
    clear(): void;
    /** Clears the scene, disposes owned resources and drops listeners. Idempotent. */
    dispose(): void;
    private presentInner;
    private presentScene;
    /** Captures scroll state of the scene's nodes under its route, evicting the oldest route beyond the limit. */
    private rememberRoute;
    private isStable;
    /** Cancels a scene's async work, unbinds SIK before destroying objects, frees owned materials. */
    private retireScene;
    private reject;
    private applyOpsToSpecs;
    private patchTo;
    /** Whether `id` is one of `roots` or below one, using the pre-patch tree. */
    private isUnder;
    /** Drops this scene's hold on owned materials no node or polyline uses any more. */
    private releaseUnusedMaterials;
    private syncExtras;
    private syncInteractions;
    private syncAnimations;
    private createNodeRecord;
    private updateNodeRecord;
    /**
     * Applies content fields. With `prev`, only fields that differ are sent.
     * During staging (`phase` stage) backend errors propagate to roll back.
     */
    private applyContent;
    private removeNodeRecord;
    private loadNodeAsset;
    private applyAssetResult;
    private resolveMaterial;
    private ownedMaterial;
    private createLight;
    private createPolyline;
    /**
     * SIK fits colliders to visuals that UI Kit builds after creation, so
     * binding waits one frame. The wait is owned by the scene: navigation
     * before it fires cancels it.
     */
    private scheduleBindings;
    private bind;
    private deliverInteraction;
    /**
     * Delivers a triggered action on the next frame, owned by `state`. SIK is
     * mid-callback when the trigger fires, and the action usually replaces
     * the scene that holds the Interactable, so it never runs synchronously.
     * Retiring `state` first drops it with VS5018.
     */
    private queueTriggeredAction;
    private refreshLifecycle;
    private startAnimation;
    /**
     * Schedules a one-shot next-frame job owned by `owner`. The ownership
     * entry is released when the job runs, so finished jobs do not count as
     * pending work.
     */
    private ownFrame;
    private setLifecycle;
    private collect;
    private emit;
    private report;
    /** Runs a backend call; on throw reports VS5014 and returns undefined. */
    private guard;
    private safeCall;
}
/**
 * Minimal node ops that turn `before` into `after`, matched by ID: removes
 * (subtree roots only), creates (parents first), reparents, then updates for
 * nodes whose own fields changed. A kind change is a remove plus a create.
 */
export declare function diffViroSpecsScenes(before: readonly ViroSpecsHostNode[], after: readonly ViroSpecsHostNode[]): ViroSpecsPatchOp[];

// ---- ViroSpecsSceneDocument.d.ts
/**
 * Validation and normalization of scene input at the Lens boundary.
 *
 * Every path into ViroSpecsSceneController goes through
 * {@linkcode readViroSpecsSceneInput}: raw JSON from a transport, a generated
 * host constant, or a protocol 1 snapshot. Nothing reaches the live scene
 * until the whole document validates, so a bad payload can never leave a
 * half-built page.
 *
 * Dependency-free and free of Lens globals.
 */
import { type ViroSpecsDocumentAnimation, type ViroSpecsDocumentInteraction, type ViroSpecsDocumentLight, type ViroSpecsDocumentMaterial, type ViroSpecsDocumentNode, type ViroSpecsDocumentPolyline, type ViroSpecsDocumentTextStyle, type ViroSpecsActionDeclaration, type ViroSpecsSceneProtocol, type ViroSpecsTextStyle } from "./ViroSpecsProtocol";
import { type ViroSpecsHostDiagnostic } from "./ViroSpecsHostDiagnostics";
import { type ViroSpecsTheme } from "./ViroSpecsExperienceTokens";
/** A node after validation. Protocol 1 text keeps its Lens-unit style. */
export type ViroSpecsHostNode = ViroSpecsDocumentNode & {
    /** Protocol 1 `textStyle` (Lens points, RGBA 0..1). Only on text nodes read from protocol 1. */
    legacyTextStyle?: ViroSpecsTextStyle;
};
/** A validated scene, parents ordered before children. */
export type ViroSpecsHostScene = {
    protocol: ViroSpecsSceneProtocol;
    /** Route key; navigation between routes is a replacement. */
    route?: string;
    /** Declared actions, empty when the scene has no triggers. */
    actions: ViroSpecsActionDeclaration[];
    nodes: ViroSpecsHostNode[];
    polylines: ViroSpecsDocumentPolyline[];
    lights: ViroSpecsDocumentLight[];
    materials: ViroSpecsDocumentMaterial[];
    interactions: ViroSpecsDocumentInteraction[];
    animations: ViroSpecsDocumentAnimation[];
    /** Validated theme, when the document carried one. */
    theme?: ViroSpecsTheme;
};
/** Result of {@linkcode readViroSpecsSceneInput}. */
export type ViroSpecsSceneReadResult = {
    ok: true;
    scene: ViroSpecsHostScene;
} | {
    ok: false;
    diagnostics: ViroSpecsHostDiagnostic[];
};
/** Options for {@linkcode readViroSpecsSceneInput}. */
export type ViroSpecsSceneReadOptions = {
    /**
     * Accept `legacyTextStyle` on protocol 2 text nodes. Only the controller
     * sets it, when it re-validates a committed protocol 1 scene after a patch.
     */
    readonly allowLegacyTextStyle?: boolean;
};
/**
 * Validates scene input of either protocol and returns a normalized scene,
 * or the full list of problems. Never throws.
 *
 * @param input Parsed JSON: a protocol 2 document or a protocol 1 snapshot.
 * @param revision Scene revision recorded on diagnostics.
 */
export declare function readViroSpecsSceneInput(input: unknown, revision: number, options?: ViroSpecsSceneReadOptions): ViroSpecsSceneReadResult;
/** `#RRGGBB(AA)` to RGBA channels in 0..1. Input must have passed validation. */
export declare function parseViroSpecsColor(hex: string): [number, number, number, number];
/** Text style shape used by both protocols, for backends. */
export type ViroSpecsResolvedTextStyle = ViroSpecsDocumentTextStyle & {
    /** Protocol 1 Lens size, used when `fontSize` is absent. */
    lensSize?: number;
    /** Protocol 1 RGBA, used when `color` is absent. */
    rgba?: [number, number, number, number];
};
