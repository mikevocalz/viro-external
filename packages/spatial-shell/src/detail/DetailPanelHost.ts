/**
 * A native host that opens a second activity panel beside the main panel on
 * the app's one ReactHost. `@expo-pico/core`'s `PicoPanelHost` (from
 * `new PicoWindows().createPanelHost()`) has this shape on both the `quest`
 * and `pico` flavors; the shell takes any object that does.
 *
 * @see {@linkcode SpatialShellDetailConfig.createPanelHost}
 */
export interface DetailPanelHost {
  /** Opens the registered component `name` in a panel of `size`. Rejects when the launch fails. */
  openPanel(name: string, size: { widthDp: number; heightDp: number }): Promise<void>;
  /** Closes the panel showing `name`. */
  closePanel(name: string): Promise<void>;
  /** Called when a panel reports it is on screen. */
  addOnPanelOpenedListener(listener: (event: { name: string }) => void): { remove(): void };
  /**
   * Called when a panel goes away. `reason` is `user` when the person closed it
   * from the system bar or Back.
   */
  addOnPanelClosedListener(
    listener: (event: { name: string; reason: string }) => void
  ): { remove(): void };
}
