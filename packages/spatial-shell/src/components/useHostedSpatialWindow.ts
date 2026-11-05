import { useLayoutEffect, type ReactNode } from "react";

import type { SpatialWindowPlacement, SpatialWindowSpec } from "../geometry/SpatialWindowSpec";
import { useSpatialWindowHostStore } from "../stores/spatialWindowHostStore";
import { useSpatialShellContext } from "./SpatialShellContext";

/**
 * Asks for `content` to show in its own window, rendered by the shell's
 * `SpatialWindowHost` (Meta) or the PICO main window's strip. Ported from
 * Harlem Might and MoyoLearn by way of expo-pico #45.
 *
 * Returns the window's placement. Draw the in-panel fallback whenever it is
 * not `spatial`: `pending` while the OS places it, `dropped` when it was
 * refused, `inline` where nothing asks for a window. The host never draws the
 * content inline. Pass undefined to ask for no window.
 *
 * `content` renders outside the caller's tree position, so it sees only the
 * providers above {@linkcode SpatialShell}.
 */
export function useHostedSpatialWindow(
  window: SpatialWindowSpec | undefined,
  content: ReactNode
): SpatialWindowPlacement {
  const { runtime } = useSpatialShellContext();
  const isAvailable = runtime.useSpatialAvailable();
  const requested = window !== undefined && runtime.windowBackend !== "none" && isAvailable ? window : undefined;
  const label = requested?.label;
  const placement = runtime.usePlacement(label ?? "");
  const mount = useSpatialWindowHostStore((state) => state.mount);
  const unmount = useSpatialWindowHostStore((state) => state.unmount);

  useLayoutEffect(() => {
    if (requested !== undefined) mount({ window: requested, content });
  });
  useLayoutEffect(() => {
    if (label === undefined) return;
    return () => unmount(label);
  }, [label, unmount]);

  return requested === undefined ? "inline" : placement;
}
