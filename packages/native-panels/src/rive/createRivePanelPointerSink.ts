import type { RivePanel } from "../specs/RivePanel.nitro";
import type { RivePointerPhase } from "../specs/RivePointerPhase";
import type { RivePanelPointerEvent } from "./RivePanelPointerEvent";

/**
 * Forwards board input events to {@linkcode RivePanel.dispatchPointer} in
 * panel pixels. `hover` and `leave` have no Rive effect and are dropped;
 * `cancel` releases that pointer's press off the artboard, without a click
 * (see {@linkcode RivePointerPhase}).
 *
 * @param size The pixel size the panel was created with.
 */
export function createRivePanelPointerSink(
  panel: Pick<RivePanel, "dispatchPointer">,
  size: { readonly widthPx: number; readonly heightPx: number },
): (event: RivePanelPointerEvent) => void {
  return (event) => {
    if (event.phase === "hover" || event.phase === "leave") return;
    panel.dispatchPointer(event.phase, event.uv[0] * size.widthPx, event.uv[1] * size.heightPx, event.pointerId);
  };
}
