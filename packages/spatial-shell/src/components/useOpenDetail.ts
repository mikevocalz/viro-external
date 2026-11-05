import { useSpatialShellStore } from "../stores/shellStore";
import { useSpatialShellContext } from "./SpatialShellContext";

/**
 * Returns a function that opens detail content: in the detail panel where
 * the build has one, as a pushed screen otherwise (phones, a headset whose
 * panel host is not ready, and after a panel launch failed).
 *
 * @throws {Error} When the shell has no `detail` config.
 */
export function useOpenDetail(): (id: string) => void {
  const { detail } = useSpatialShellContext();
  if (detail === undefined) {
    throw new Error("[spatial-shell] useOpenDetail needs <SpatialShell detail={...}>.");
  }
  const isInPanel = useSpatialShellStore(
    (state) => state.panelHost !== undefined && state.detailStatus !== "failed"
  );
  const selectDetail = useSpatialShellStore((state) => state.selectDetail);
  const { showAsScreen } = detail;
  return (id) => {
    selectDetail(id);
    if (!isInPanel) showAsScreen(id);
  };
}
