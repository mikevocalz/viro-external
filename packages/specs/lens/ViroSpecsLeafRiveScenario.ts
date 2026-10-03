import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario";
import { DefaultLeafInteractor } from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor";
import { findInteractableByName } from "Leaf.lspkg/Interactors/InteractableUtils";
import { findSceneObjectByName, sleep } from "Leaf.lspkg/Utils/common/Utils";
import { expect } from "Leaf.lspkg/Utils/common/Expect";
import { ViroSpecsRuntimeHost } from "./ViroSpecsRuntimeHost";

/**
 * The baked Rive lesson panel: it starts on its first clip, the animated
 * texture advances inside that clip's frame range, and a pinch moves the
 * state graph on (Loading → Entering, which then falls through to Idle).
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

    expect(runtime.getRiveClip(id)).toBe("Loading");
    const first = control.getCurrentPlayingFrame();
    await sleep(400);
    const later = control.getCurrentPlayingFrame();
    print("VIRO_VALIDATION rive:play measured " + JSON.stringify({ frames: control.getFramesCount(), first, later }));
    expect(later).not.toBe(first);
    // Loading is baked frames 0-49; check against the frames Lens kept.
    expect(later).toBeLessThan(Math.ceil(control.getFramesCount() * 50 / 107) + 1);
    print("VIRO_VALIDATION rive:play PASS Loading advances inside its range");

    const tap = findInteractableByName(object.name);
    expect(tap).toBeTruthy();
    await new DefaultLeafInteractor().trigger(tap);
    await sleep(50);
    expect(runtime.getRiveClip(id)).toBe("Entering");
    // Entering is 18 frames at 25 fps; it then falls through to Idle.
    await sleep(1200);
    expect(runtime.getRiveClip(id)).toBe("Idle");
    print("VIRO_VALIDATION rive:select PASS Loading -> Entering -> Idle");

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
