import type { MetaWindowPlacement, MetaWindowProps } from "@viro-external/meta-layout";

/**
 * Props for one Meta Layout SDK `<SpatialWindow>`: the
 * `@viro-external/meta-layout` {@linkcode MetaWindowProps} plus the window's
 * background color.
 *
 * `windowBackgroundColor` is the opaque color Meta paints behind the window's
 * content. Without it the window shows the app theme's
 * `android:windowBackground` (Expo's white splash), which shows as a light
 * edge at the content's rounded corners. Set it to the content's own fill.
 *
 * @see {@linkcode SpatialShellGeometry.railWindow}
 */
export type SpatialWindowSpec = MetaWindowProps & {
  readonly windowBackgroundColor?: string;
};

/**
 * Where a hosted window is, in the vocabulary of Meta's
 * `useSpatialWindowState`: `spatial` once placed, `pending` while the OS
 * places it, `dropped` when it was refused, `inline` where nothing asks for a
 * window.
 */
export type SpatialWindowPlacement = MetaWindowPlacement;
