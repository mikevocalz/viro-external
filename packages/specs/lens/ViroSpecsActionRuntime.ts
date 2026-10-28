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
import type {
  ViroSpecsActionDeclaration,
  ViroSpecsActionEvent,
  ViroSpecsActionPayload,
  ViroSpecsSceneDocumentV2,
} from "./ViroSpecsProtocol";
import {
  createViroSpecsHostDiagnostic,
  describeError,
  type ViroSpecsHostDiagnosticCode,
  type ViroSpecsHostDiagnosticDetails,
  type ViroSpecsHostDiagnostics,
  type ViroSpecsSubscription,
} from "./ViroSpecsHostDiagnostics";
import {
  checkViroSpecsActionDeclaration,
  checkViroSpecsActionPayload,
  copyViroSpecsActionPayload,
} from "./ViroSpecsActionContract";
import type { ViroSpecsApplyResult } from "./ViroSpecsSceneController";

/** Reducer for one action: returns the next state, or the same object for no change. */
export type ViroSpecsActionHandler<S> = (state: S, payload: ViroSpecsActionPayload, event: ViroSpecsActionEvent) => S;

/** Outcome of {@linkcode ViroSpecsActionRegistry.reduce}. */
export type ViroSpecsActionReduction<S> =
  /** The handler ran. `state` may be the input object when nothing changed. */
  | { readonly status: "handled"; readonly state: S }
  /** Declared and well-typed, but no handler is registered. */
  | { readonly status: "unhandled" }
  /** Undeclared, ill-typed, or the handler threw. Already reported. */
  | { readonly status: "rejected" };

/**
 * Declared actions and their handlers. Declarations are fixed at
 * construction; handlers are added with {@linkcode on}.
 *
 * @example
 * const registry = new ViroSpecsActionRegistry<AppState>(ACTIONS, diagnostics);
 * registry.on("exhibit.open", (state, payload) => ({ ...state, route: "details", exhibitId: String(payload.exhibitId) }));
 */
export class ViroSpecsActionRegistry<S> {
  private readonly byId = new Map<string, ViroSpecsActionDeclaration>();
  private readonly handlers = new Map<string, ViroSpecsActionHandler<S>>();

  /**
   * @param declarations Invalid entries are reported (VS5017) and left out;
   *   a repeated ID is reported (VS5016) and the first declaration stays.
   */
  constructor(declarations: readonly ViroSpecsActionDeclaration[], private readonly diagnostics: ViroSpecsHostDiagnostics) {
    declarations.forEach((declaration, index) => {
      const problems = checkViroSpecsActionDeclaration(declaration);
      if (problems.length > 0) {
        for (const p of problems) {
          this.report("VS5017", "Declaration " + index + " is invalid at " + (p.path || "/") + ": " + p.message, { fieldPath: "/actions/" + index + p.path });
        }
        return;
      }
      if (this.byId.has(declaration.id)) {
        this.report("VS5016", "Action " + declaration.id + " is declared twice; the first declaration is kept.", { fieldPath: "/actions/" + index + "/id" });
        return;
      }
      this.byId.set(declaration.id, declaration);
    });
  }

  /** Valid declarations, in declaration order. Use them as the scene's `actions`. */
  get declarations(): ViroSpecsActionDeclaration[] {
    return Array.from(this.byId.values());
  }

  /** Whether `actionId` is declared. */
  isDeclared(actionId: string): boolean {
    return this.byId.has(actionId);
  }

  /**
   * Registers the handler for a declared action. Undeclared IDs (VS5015)
   * and a second handler for one ID (VS5016) are reported and not
   * registered; the returned subscription is then inert.
   */
  on(actionId: string, handler: ViroSpecsActionHandler<S>): ViroSpecsSubscription {
    if (!this.byId.has(actionId)) {
      this.report("VS5015", "Cannot handle " + actionId + ": it is not declared.");
      return { remove: () => undefined };
    }
    if (this.handlers.has(actionId)) {
      this.report("VS5016", "Action " + actionId + " already has a handler; the second one was not registered.");
      return { remove: () => undefined };
    }
    this.handlers.set(actionId, handler);
    let removed = false;
    return {
      remove: () => {
        if (removed) return;
        removed = true;
        if (this.handlers.get(actionId) === handler) this.handlers.delete(actionId);
      },
    };
  }

  /** Checks `event` against its declaration and runs its handler. Never throws. */
  reduce(state: S, event: ViroSpecsActionEvent): ViroSpecsActionReduction<S> {
    const declaration = this.byId.get(event.actionId);
    const where = event.nodeId !== undefined ? { nodeId: event.nodeId, sceneRevision: event.sceneRevision } : { sceneRevision: event.sceneRevision };
    if (!declaration) {
      this.report("VS5015", "Action " + event.actionId + " is not declared; it was dropped.", where);
      return { status: "rejected" };
    }
    const problems = checkViroSpecsActionPayload(declaration, event.payload);
    if (problems.length > 0) {
      for (const p of problems) {
        this.report("VS5017", event.actionId + " payload " + (p.path || "/") + ": " + p.message, { ...where, fieldPath: "/payload" + p.path });
      }
      return { status: "rejected" };
    }
    const handler = this.handlers.get(event.actionId);
    if (!handler) return { status: "unhandled" };
    try {
      return { status: "handled", state: handler(state, copyViroSpecsActionPayload(event.payload), event) };
    } catch (error) {
      this.report("VS5009", "Handler for " + event.actionId + " threw: " + describeError(error), where);
      return { status: "rejected" };
    }
  }

  private report(code: ViroSpecsHostDiagnosticCode, message: string, details: ViroSpecsHostDiagnosticDetails = {}): void {
    this.diagnostics.report(createViroSpecsHostDiagnostic(code, "action", message, details));
  }
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
export class ViroSpecsActionRuntime<S> {
  private stateValue: S;
  private subscription: ViroSpecsSubscription | null = null;
  private readonly stateListeners = new Set<(state: S) => void>();
  private readonly nowMs: () => number;
  private disposed = false;

  constructor(private readonly host: ViroSpecsActionSceneHost, private readonly options: ViroSpecsActionRuntimeOptions<S>) {
    this.stateValue = options.initialState;
    this.nowMs = options.nowMs ?? (() => 0);
  }

  /** State the committed scene was rendered from. */
  get state(): S {
    return this.stateValue;
  }

  /** Renders the initial state and starts listening for triggered actions. Idempotent. */
  start(): ViroSpecsApplyResult | null {
    if (this.disposed || this.subscription) return null;
    this.subscription = this.host.addOnActionListener((event) => this.accept(event));
    return this.render(this.stateValue);
  }

  /**
   * Dispatches an action from app code (a voice command, a LEAF scenario, a
   * timer). It goes through the same checks as a triggered action and runs
   * now; queue it with the controller's `queueAction` when it must not
   * outlive the current scene.
   */
  dispatch(actionId: string, payload: ViroSpecsActionPayload = {}): boolean {
    if (this.disposed) return false;
    return this.accept({ actionId, payload, sceneRevision: 0, timestampMs: this.nowMs() });
  }

  /** State changes, after the scene for the new state is committed. */
  addOnStateListener(listener: (state: S) => void): ViroSpecsSubscription {
    this.stateListeners.add(listener);
    let removed = false;
    return {
      remove: () => {
        if (removed) return;
        removed = true;
        this.stateListeners.delete(listener);
      },
    };
  }

  /** Stops listening. The committed scene stays; dispose the controller to remove it. Idempotent. */
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.subscription?.remove();
    this.subscription = null;
    this.stateListeners.clear();
  }

  private accept(event: ViroSpecsActionEvent): boolean {
    const result = this.options.registry.reduce(this.stateValue, event);
    if (result.status === "rejected") return false;
    if (result.status === "unhandled") {
      if (!this.options.forward) {
        this.options.diagnostics.report(
          createViroSpecsHostDiagnostic("VS5019", "action", "Action " + event.actionId + " is declared but has no handler.", {
            sceneRevision: event.sceneRevision,
            ...(event.nodeId !== undefined ? { nodeId: event.nodeId } : {}),
          })
        );
      }
    } else if (result.state !== this.stateValue) {
      const applied = this.render(result.state);
      if (applied === null || applied.status === "rejected") return false;
    }
    if (this.options.forward) {
      const forward = this.options.forward;
      try {
        forward(event);
      } catch (error) {
        this.options.diagnostics.report(
          createViroSpecsHostDiagnostic("VS5009", "action", "forward threw for " + event.actionId + ": " + describeError(error))
        );
      }
    }
    return true;
  }

  /** Renders `next`; commits it as state only when the host accepted the scene. */
  private render(next: S): ViroSpecsApplyResult | null {
    let document: ViroSpecsSceneDocumentV2;
    try {
      document = this.options.view(next);
    } catch (error) {
      this.options.diagnostics.report(createViroSpecsHostDiagnostic("VS5009", "action", "view threw: " + describeError(error)));
      return null;
    }
    const result = this.host.update(document);
    if (result.status === "rejected") return result;
    this.stateValue = next;
    for (const listener of Array.from(this.stateListeners)) {
      try {
        listener(next);
      } catch (error) {
        this.options.diagnostics.report(createViroSpecsHostDiagnostic("VS5009", "listener", "State listener threw: " + describeError(error)));
      }
    }
    return result;
  }
}
