import { Frame } from "SpectaclesUIKit.lspkg/Scripts/Components/Frame/Frame";
import { Scenario } from "Leaf.lspkg/Scenarios/scenario/Scenario";
import { DefaultLeafInteractor } from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor";
import { findInteractableByName } from "Leaf.lspkg/Interactors/InteractableUtils";
import { findSceneObjectByName, sleep } from "Leaf.lspkg/Utils/common/Utils";
import { expect } from "Leaf.lspkg/Utils/common/Expect";
import { generatedHost } from "./ViroSpecsRuntimeValidation";

/**
 * Checks the platform-lab panel as UI Kit `Frame` sees it: the size the runtime
 * asked for, the outer size Frame actually draws, and a grab-move.
 *
 * Resize is not driven here. LEAF's `drag` always targets the interactable's
 * centre, and Frame scales only from its corner margin zones, so corner resize
 * stays a device-only check.
 */
@component
export class ViroSpecsLeafFrameScenario extends Scenario {
  /**
   * The video panel: the video fits its source's aspect, a grab carries the
   * video, and a Frame resize scales it uniformly. The resize goes through
   * Frame's innerSize setter, the same path its corner handles drive; the
   * hand gesture itself is a device check.
   */
  private async checkVideoPanel(): Promise<void> {
    const panel = findSceneObjectByName("viro:platform-lab-video-panel");
    const video = findSceneObjectByName("viro-interactable:platform-lab-video")
      ?? findSceneObjectByName("viro:platform-lab-video");
    expect(panel).toBeTruthy();
    expect(video).toBeTruthy();
    const frame = panel.getComponent(Frame.getTypeName()) as Frame;
    const image = video.getComponent("Component.Image") as Image;
    const texture = image.mainPass.baseTex;
    const sourceAspect = texture.getWidth() / texture.getHeight();
    const size = () => video.getTransform().getWorldScale();
    const before = size();
    print("VIRO_VALIDATION video:aspect measured " + JSON.stringify({
      source: [texture.getWidth(), texture.getHeight()],
      drawnCm: [before.x, before.y],
      innerCm: [frame.innerSize.x, frame.innerSize.y],
    }));
    expect(Math.abs(before.x / before.y - sourceAspect)).toBeLessThan(0.01);
    print("VIRO_VALIDATION video:aspect PASS");

    const local = () =>
      panel.getTransform().getInvertedWorldTransform()
        .multiplyPoint(video.getTransform().getWorldPosition());
    const localBefore = local();
    const grab = findInteractableByName("viro:platform-lab-video-panel");
    expect(grab).toBeTruthy();
    const start = panel.getTransform().getWorldPosition();
    await new DefaultLeafInteractor().drag(grab, new vec3(1, 0, 0), 400);
    await sleep(50);
    const moved = panel.getTransform().getWorldPosition().sub(start);
    expect(moved.x).toBeGreaterThan(3);
    expect(local().distance(localBefore)).toBeLessThan(0.1);
    print("VIRO_VALIDATION video:grab PASS " + JSON.stringify({ movedCm: [moved.x, moved.y, moved.z] }));

    frame.innerSize = frame.innerSize.uniformScale(1.5);
    await sleep(50);
    const after = size();
    print("VIRO_VALIDATION video:resize measured " + JSON.stringify({
      beforeCm: [before.x, before.y], afterCm: [after.x, after.y],
    }));
    expect(Math.abs(after.x / before.x - 1.5)).toBeLessThan(0.02);
    expect(Math.abs(after.x / after.y - sourceAspect)).toBeLessThan(0.01);
    print("VIRO_VALIDATION video:resize PASS uniform, aspect kept");
  }

  async run(): Promise<void> {
    // The runtime renames a node's object once it carries an Interactable,
    // and Frame always adds one.
    const panel = findSceneObjectByName("viro-interactable:platform-lab-panel");
    expect(panel).toBeTruthy();
    const frame = panel.getComponent(Frame.getTypeName()) as Frame | null;
    expect(frame).toBeTruthy();

    // The panel size each scene source requests: the generated host's PANEL
    // constant (90 x 60 cm) or ViroSpecsPlatformLab's fixture (60 x 50 cm).
    // ponytail: mirrors two constants; read them from the applied scene
    // command once the runtime keeps the last plan per node.
    const requested = generatedHost() ? [90, 60] : [60, 50];
    // Frame adds its grab margin and padding around innerSize, so the drawn
    // panel is larger than the request.
    const inner = frame.innerSize;
    const total = frame.totalSize;
    const measured = {
      source: generatedHost() ? "generated-host" : "platform-lab",
      requestedCm: requested,
      innerCm: [inner.x, inner.y],
      totalCm: [total.x, total.y],
      marginCm: frame.margin,
      paddingCm: [frame.padding.x, frame.padding.y],
    };
    // Printed before asserting so a failure still reports what Frame holds.
    print("VIRO_VALIDATION frame:size measured " + JSON.stringify(measured));
    expect(Math.abs(inner.x - requested[0])).toBeLessThan(0.1);
    expect(Math.abs(inner.y - requested[1])).toBeLessThan(0.1);
    expect(Math.abs(total.x - (inner.x + frame.margin * 2 + frame.padding.x))).toBeLessThan(0.1);
    expect(Math.abs(total.y - (inner.y + frame.margin * 2 + frame.padding.y))).toBeLessThan(0.1);
    print("VIRO_VALIDATION frame:size PASS");

    const grab = findInteractableByName("viro-interactable:platform-lab-panel");
    expect(grab).toBeTruthy();
    // Panel content has to ride along with a grab. Frame's Billboard turns the
    // panel while it moves, so compare the header in the panel's own space:
    // rigidly attached content keeps the same panel-local position.
    const header = findSceneObjectByName("viro:platform-lab-header-title");
    expect(header).toBeTruthy();
    const local = () =>
      panel.getTransform().getInvertedWorldTransform()
        .multiplyPoint(header.getTransform().getWorldPosition());
    const before = panel.getTransform().getWorldPosition();
    const headerLocalBefore = local();
    // LEAF adds this vector on every drag-update frame, not once in total.
    await new DefaultLeafInteractor().drag(grab, new vec3(1, 0, 0), 400);
    await sleep(50);
    const moved = panel.getTransform().getWorldPosition().sub(before);
    const drift = local().distance(headerLocalBefore);
    print("VIRO_VALIDATION frame:grab measured " + JSON.stringify({
      panelMovedCm: [moved.x, moved.y, moved.z],
      headerDriftInPanelCm: drift,
    }));
    expect(moved.x).toBeGreaterThan(3);
    expect(Math.abs(moved.y)).toBeLessThan(2);
    expect(drift).toBeLessThan(0.1);
    print("VIRO_VALIDATION frame:grab PASS content follows panel");

    print("VIRO_VALIDATION frame:resize-gesture SKIP device-only (LEAF drag targets the centre; Frame scales from corner margins)");

    if (generatedHost()) await this.checkVideoPanel();
  }
}
