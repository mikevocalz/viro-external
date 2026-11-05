import type { ReactNode } from "react";

/**
 * One navigation destination: a rail item on headsets, tablets and unfolded
 * foldables, and a bottom tab on phones.
 *
 * @see {@linkcode SpatialShellProps.destinations}
 */
export interface ShellDestination<Id extends string = string> {
  /** Stable identity, also used as the React key. */
  readonly id: Id;
  /** The label under the icon and the accessibility label. */
  readonly title: string;
  /** Draws the destination's icon in `color` at `size` dp. */
  renderIcon(state: { color: string; size: number; isSelected: boolean }): ReactNode;
}
