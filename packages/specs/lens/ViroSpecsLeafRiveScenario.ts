import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario";
import { DefaultLeafInteractor } from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor";
import { findInteractableByName } from "Leaf.lspkg/Interactors/InteractableUtils";
import { findSceneObjectByName, sleep } from "Leaf.lspkg/Utils/common/Utils";
import { expect } from "Leaf.lspkg/Utils/common/Expect";
import { ViroSpecsRuntimeHost } from "./ViroSpecsRuntimeHost";

/**
 * The baked Rive lesson panel: it opens on Entering, the animated texture
 * advances, the clip falls through to Idle, and the Rive file's own buttons
 * switch clips.
 */
@component
export class ViroSpecsLeafRiveScenario extends Scenario {
  async run(): Promise<void> {
    const runtime = findSceneObjectByName("RuntimeHost")
      .getComponent(ViroSpecsRuntimeHost.getTypeName()) as ViroSpecsRuntimeHost;
    const id = "platform-lab-lesson-rive";
    const object = runtime.getNode(id);
    expect(object).toBeTruthy();
    const image = object.getComponent("Component.Image") as Image;
    const control = image.mainPass.baseTex.control as AnimatedTextureFileProvider;
    expect(control.getFramesCount()).toBeGreaterThan(1);

    // No baked loading clip: the panel opens on Entering, which falls
    // through to Idle (the host shows its own spinner before that).
    expect(runtime.getRiveClip(id)).toBe("Entering");
    const first = control.getCurrentPlayingFrame();
    await sleep(300);
    const later = control.getCurrentPlayingFrame();
    print("VIRO_VALIDATION rive:play measured " + JSON.stringify({ frames: control.getFramesCount(), first, later }));
    expect(later).not.toBe(first);
    print("VIRO_VALIDATION rive:play PASS Entering advances");
    await sleep(1200);
    expect(runtime.getRiveClip(id)).toBe("Idle");
    print("VIRO_VALIDATION rive:next PASS Entering -> Idle");

    // The Rive art's own buttons are labelled press targets.
    const submit = findInteractableByName("viro-button:Submit");
    expect(submit).toBeTruthy();
    await new DefaultLeafInteractor().trigger(submit);
    await sleep(50);
    expect(runtime.getRiveClip(id)).toBe("Submitting");
    const retry = findInteractableByName("viro-button:Retry");
    expect(retry).toBeTruthy();
    await new DefaultLeafInteractor().trigger(retry);
    await sleep(50);
    expect(runtime.getRiveClip(id)).toBe("Entering");
    print("VIRO_VALIDATION rive:buttons PASS Submit -> Submitting, Retry -> Entering");
  }
}
