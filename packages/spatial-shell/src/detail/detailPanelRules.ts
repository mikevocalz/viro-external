/**
 * Where the detail panel is.
 *
 * - `closed`: no panel.
 * - `opening`: the launch went to the OS; the panel has not reported in.
 * - `open`: the panel is on screen.
 * - `failed`: the launch threw; the app shows the detail as a pushed screen
 *   until the selection clears.
 *
 * @see {@linkcode detailPanelCommand}
 */
export type DetailPanelStatus = "closed" | "opening" | "open" | "failed";

/**
 * The detail panel's lifecycle events, as the panel host reports them.
 *
 * @see {@linkcode detailPanelStatusAfter}
 */
export type DetailPanelEvent =
  | { readonly type: "requested" }
  | { readonly type: "opened" }
  | { readonly type: "failed" }
  | { readonly type: "closed" };

/**
 * Input to {@linkcode detailPanelCommand}. `selectedId` is undefined when no
 * detail is selected; `isAvailable` is true once the app has a panel host.
 */
export interface DetailPanelCommandInput {
  readonly selectedId: string | undefined;
  readonly status: DetailPanelStatus;
  readonly isAvailable: boolean;
}

/**
 * What to ask of the detail panel now, or undefined for nothing. A selection
 * opens the panel only from `closed`, so a failed launch is not retried for
 * the same selection; clearing the selection closes an opening or open panel.
 * Pure.
 */
export function detailPanelCommand(input: DetailPanelCommandInput): "open" | "close" | undefined {
  const { selectedId, status, isAvailable } = input;
  if (selectedId !== undefined) return isAvailable && status === "closed" ? "open" : undefined;
  return status === "opening" || status === "open" ? "close" : undefined;
}

/** The status after `event`. Pure. */
export function detailPanelStatusAfter(event: DetailPanelEvent): DetailPanelStatus {
  switch (event.type) {
    case "requested":
      return "opening";
    case "opened":
      return "open";
    case "failed":
      return "failed";
    case "closed":
      return "closed";
  }
}
