import { useEffect } from "react";

import { detailPanelCommand, detailPanelStatusAfter } from "../detail/detailPanelRules";
import type { SpatialShellDetailConfig } from "../detail/SpatialShellDetailConfig";
import { useSpatialShellStore } from "../stores/shellStore";
import { useSpatialShellContext } from "./SpatialShellContext";

/**
 * Shows the selected detail as its own panel beside the main panel, the way
 * Harlem Might's Place Detail does (its ADR 0006): a second activity on the
 * app's one ReactHost, launched with Meta's multi-panel flags, which Horizon
 * OS places in the slot beside the app's panel and PICO OS 5 opens as its own
 * window.
 *
 * - Selecting content opens the panel; selecting other content updates it in
 *   place, because the panel reads the same store.
 * - Clearing the selection closes it.
 * - Closing the panel itself (its Close button, Back, the system bar) clears
 *   the selection, which returns the user to rail and main.
 * - When the launch fails, the detail opens as a screen instead.
 *
 * Mounted once by {@linkcode SpatialShell}. Renders nothing.
 */
export function DetailPanelController({ detail }: { detail: SpatialShellDetailConfig }): null {
  const { geometry } = useSpatialShellContext();
  const selectedDetailId = useSpatialShellStore((state) => state.selectedDetailId);
  const detailStatus = useSpatialShellStore((state) => state.detailStatus);
  const panelHost = useSpatialShellStore((state) => state.panelHost);
  const { componentName, createPanelHost, showAsScreen } = detail;

  useEffect(() => {
    if (createPanelHost === undefined) return;
    let isActive = true;
    createPanelHost()
      .then((host) => {
        if (isActive) useSpatialShellStore.getState().setPanelHost(host);
      })
      .catch((error: unknown) => {
        console.warn(`[spatial-shell] no detail panel host; detail opens as a screen. ${String(error)}`);
      });
    return () => {
      isActive = false;
    };
  }, [createPanelHost]);

  useEffect(() => {
    if (panelHost === undefined) return;
    const opened = panelHost.addOnPanelOpenedListener(({ name }) => {
      if (name !== componentName) return;
      useSpatialShellStore.getState().setDetailStatus(detailPanelStatusAfter({ type: "opened" }));
    });
    const closed = panelHost.addOnPanelClosedListener(({ name, reason }) => {
      if (name !== componentName) return;
      const store = useSpatialShellStore.getState();
      store.setDetailStatus(detailPanelStatusAfter({ type: "closed" }));
      if (reason === "user") store.clearDetail();
    });
    return () => {
      opened.remove();
      closed.remove();
    };
  }, [panelHost, componentName]);

  useEffect(() => {
    const store = useSpatialShellStore.getState();
    if (detailStatus === "failed" && selectedDetailId === undefined) {
      store.setDetailStatus("closed");
      return;
    }
    const command = detailPanelCommand({
      selectedId: selectedDetailId,
      status: detailStatus,
      isAvailable: panelHost !== undefined,
    });
    if (command === "open" && panelHost !== undefined) {
      store.setDetailStatus(detailPanelStatusAfter({ type: "requested" }));
      panelHost.openPanel(componentName, geometry.detailPanelSizeDp).catch((error: unknown) => {
        console.warn(`[spatial-shell] the detail panel did not open; showing it as a screen. ${String(error)}`);
        const current = useSpatialShellStore.getState();
        current.setDetailStatus(detailPanelStatusAfter({ type: "failed" }));
        if (current.selectedDetailId !== undefined) showAsScreen(current.selectedDetailId);
      });
    } else if (command === "close" && panelHost !== undefined) {
      panelHost.closePanel(componentName).catch((error: unknown) => {
        console.warn(`[spatial-shell] the detail panel did not close. ${String(error)}`);
      });
    }
  }, [selectedDetailId, detailStatus, panelHost, componentName, geometry, showAsScreen]);

  return null;
}
