import { ViroSpecsPresentation, type ViroSpecsPresentationSnapshot } from "./ViroSpecsPresentation";
import { ViroSpecsSceneControllerHost } from "./ViroSpecsSceneControllerHost";

export type { ViroSpecsPresentationSnapshot };

/**
 * Presents protocol 1 pages with string actions on a
 * ViroSpecsSceneControllerHost.
 *
 * Replacement is transactional: the controller stages the new page under a
 * disabled root and retires the previous page only after the new one is
 * enabled. An invalid page throws and a page the controller rejects throws;
 * in both cases the previous page stays on screen with its targets live.
 * See {@linkcode ViroSpecsPresentation}.
 */
@component
export class ViroSpecsPresentationHost extends BaseScriptComponent {
  @input
  @hint("SceneObject hosting ViroSpecsSceneControllerHost")
  sceneHostObject: SceneObject;

  private presentation: ViroSpecsPresentation | null = null;

  onAwake(): void {
    const host = this.sceneHostObject
      ? (this.sceneHostObject.getComponent(ViroSpecsSceneControllerHost.getTypeName()) as ViroSpecsSceneControllerHost | null)
      : null;
    if (!host) {
      throw new Error("ViroSpecsPresentationHost requires ViroSpecsSceneControllerHost on sceneHostObject.");
    }
    this.presentation = new ViroSpecsPresentation(host);
    this.createEvent("OnDestroyEvent").bind(() => this.dispose());
  }

  /** Adds an action listener; actions arrive one frame after the pinch. Returns the remover. */
  subscribeAction(listener: (action: string) => void): () => void {
    return this.requirePresentation().subscribeAction(listener);
  }

  /** Replaces the page. Throws, leaving the previous page live, when the page is invalid or rejected. */
  present(snapshot: ViroSpecsPresentationSnapshot): void {
    this.requirePresentation().present(snapshot);
  }

  /** Removes the page this host presented. */
  clear(): void {
    this.presentation?.clear();
  }

  private dispose(): void {
    this.presentation?.dispose();
    this.presentation = null;
  }

  private requirePresentation(): ViroSpecsPresentation {
    if (!this.presentation) throw new Error("ViroSpecsPresentationHost not initialized.");
    return this.presentation;
  }
}
