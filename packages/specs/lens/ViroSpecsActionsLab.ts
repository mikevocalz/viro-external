import { ViroSpecsActionRuntime } from "./ViroSpecsActionRuntime";
import type { ViroSpecsActionEvent } from "./ViroSpecsProtocol";
import {
  VIRO_SPECS_REFERENCE_INITIAL_STATE,
  createViroSpecsReferenceRegistry,
  viewViroSpecsReferenceFlow,
  type ViroSpecsReferenceFlowState,
} from "./ViroSpecsReferenceFlow";
import { ViroSpecsSceneControllerHost } from "./ViroSpecsSceneControllerHost";

/**
 * Platform Lab scene for typed actions: the reference flow (select card ->
 * details -> change setting -> back with the list's scroll position kept),
 * standalone in the Lens. No phone or server is involved.
 *
 * Wire `controllerHostObject` to a SceneObject with
 * ViroSpecsSceneControllerHost. Set `forwardActions` to log each accepted
 * action, the hook a phone transport would use.
 */
@component
export class ViroSpecsActionsLab extends BaseScriptComponent {
  @input
  controllerHostObject: SceneObject;

  @input
  @hint("Log every accepted action, as a phone transport would receive it")
  forwardActions: boolean = false;

  private runtime: ViroSpecsActionRuntime<ViroSpecsReferenceFlowState> | null = null;

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => this.start());
    this.createEvent("OnDestroyEvent").bind(() => {
      this.runtime?.dispose();
      this.runtime = null;
    });
  }

  /** Current state, for LEAF scenarios. Undefined before start. */
  get state(): ViroSpecsReferenceFlowState | undefined {
    return this.runtime?.state;
  }

  /** Dispatches an action from a LEAF scenario or a voice command. */
  dispatch(actionId: string, payload: Record<string, string | number | boolean> = {}): boolean {
    return this.runtime?.dispatch(actionId, payload) ?? false;
  }

  private start(): void {
    const host = this.controllerHostObject
      ? (this.controllerHostObject.getComponent(ViroSpecsSceneControllerHost.getTypeName()) as ViroSpecsSceneControllerHost | null)
      : null;
    if (!host || !host.isReady) {
      // Report and keep the Lens alive; never throw from a Lens component.
      console.error("[viro-specs-host] error: ViroSpecsActionsLab needs a ready ViroSpecsSceneControllerHost on controllerHostObject.");
      return;
    }
    const diagnostics = host.diagnosticsChannel;
    const forward = this.forwardActions
      ? (event: ViroSpecsActionEvent) => console.log("[viro-specs-actions] " + event.actionId + " " + JSON.stringify(event.payload))
      : undefined;
    this.runtime = new ViroSpecsActionRuntime(host, {
      initialState: VIRO_SPECS_REFERENCE_INITIAL_STATE,
      view: viewViroSpecsReferenceFlow,
      registry: createViroSpecsReferenceRegistry(diagnostics),
      diagnostics,
      nowMs: () => getTime() * 1000,
      ...(forward ? { forward } : {}),
    });
    this.runtime.start();
  }
}
