import { createContext, useContext } from "react";

import type { SpatialShellDetailConfig } from "../detail/SpatialShellDetailConfig";
import type { SpatialShellGeometry } from "../geometry/createSpatialShellGeometry";
import type { SpatialShellRuntime } from "../runtime/createSpatialShellRuntime";
import type { SpatialShellTheme } from "../theme/SpatialShellTheme";
import type { ShellDestination } from "./ShellDestination";

/** What every shell part reads from {@linkcode SpatialShell}. */
export interface SpatialShellContextValue {
  readonly runtime: SpatialShellRuntime;
  readonly geometry: SpatialShellGeometry;
  readonly theme: SpatialShellTheme;
  readonly destinations: readonly ShellDestination[];
  readonly activeDestinationId: string;
  onSelectDestination(id: string): void;
  readonly detail: SpatialShellDetailConfig | undefined;
}

export const SpatialShellContext = createContext<SpatialShellContextValue | undefined>(undefined);

/**
 * The enclosing shell's values.
 *
 * @throws {Error} When called outside {@linkcode SpatialShell}.
 */
export function useSpatialShellContext(): SpatialShellContextValue {
  const value = useContext(SpatialShellContext);
  if (value === undefined) {
    throw new Error("[spatial-shell] this component must render inside <SpatialShell>.");
  }
  return value;
}
