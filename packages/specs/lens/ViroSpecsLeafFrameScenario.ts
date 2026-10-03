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
  async run(): Promise<void> {
    // The runtime renames a node's object once it carries an Interactable,
    // and Frame always adds one.
    const panel = findSceneObjectByName("viro-interactable:platform-lab-panel");
    expect(panel).toBeTruthy();
    const frame = panel.getComponent(Frame.getTypeName()) as Frame | null;
    expect(frame).toBeTruthy();

    // The panel size each scene source requests: the generated host's PANEL
    // constant (80 x 56 cm) or ViroSpecsPlatformLab's fixture (60 x 50 cm).
    // ponytail: mirrors two constants; read them from the applied scene
    // command once the runtime keeps the last plan per node.
    const requested = generatedHost() ? [80, 56] : [60, 50];
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
    // Panel content has to ride along with a grab, not stay where it was laid out.
    const header = findSceneObjectByName("viro:platform-lab-header");
    expect(header).toBeTruthy();
    const before = panel.getTransform().getWorldPosition();
    const headerBefore = header.getTransform().getWorldPosition();
    // LEAF adds this vector on every drag-update frame, not once in total.
    await new DefaultLeafInteractor().drag(grab, new vec3(1, 0, 0), 400);
    await sleep(50);
    const after = panel.getTransform().getWorldPosition();
    const headerAfter = header.getTransform().getWorldPosition();
    const moved = after.sub(before);
    const headerMoved = headerAfter.sub(headerBefore);
    print("VIRO_VALIDATION frame:grab measured " + JSON.stringify({
      panelMovedCm: [moved.x, moved.y, moved.z],
      headerMovedCm: [headerMoved.x, headerMoved.y, headerMoved.z],
    }));
    expect(moved.x).toBeGreaterThan(3);
    expect(Math.abs(moved.y)).toBeLessThan(2);
    expect(headerMoved.distance(moved)).toBeLessThan(0.5);
    print("VIRO_VALIDATION frame:grab PASS content follows panel");

    print("VIRO_VALIDATION frame:resize SKIP device-only (LEAF drag targets the centre; Frame scales from corner margins)");
  }
}
