import type { RivePanelOptions } from "./RivePanelOptions";

/**
 * How the artboard is fitted into the panel. Same meanings as Rive's `Fit`,
 * without `layout`, which resizes the artboard and is not a panel mode.
 *
 * @see {@linkcode RivePanelOptions.fit}
 */
export type RiveFit = "fill" | "contain" | "cover" | "fit-width" | "fit-height" | "none" | "scale-down";
