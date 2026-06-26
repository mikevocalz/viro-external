import { createContext, useContext } from "react";

/**
 * Set by any movable container (StackPanel3D, CylinderPanel, HolographicSlate, ...).
 * Child controls reading `true` here ignore their own `movable` prop and warn in dev.
 */
export const MovablePanelContext = createContext<boolean>(false);

export function useInsideMovablePanel(): boolean {
  return useContext(MovablePanelContext);
}
