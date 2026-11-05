import React from "react";

import type { SpatialWindowPlacement, SpatialWindowSpec } from "../geometry/SpatialWindowSpec";

/**
 * The parts of `@metavr/layout-compat` and `@metavr/layout-window-compat`
 * the shell uses, typed here so this package never imports them. Meta's own
 * types are Flow-generated and declare `children` as Flow's `Node`.
 *
 * @see {@linkcode createMetaWindows}
 */
export interface MetaLayoutModules {
  readonly layout: {
    SpatialSceneProvider: React.ComponentType<{ initializer?: unknown; children?: React.ReactNode }>;
    useSpatialScene: () => { isSpatialAvailable: boolean };
  };
  readonly window: {
    SpatialWindow: React.ComponentType<SpatialWindowSpec & { children?: React.ReactNode }>;
    createWindowScene: (options?: { fallback?: "inline" | "drop" }) => unknown;
    useSpatialWindowState: (label: string) => { placement: SpatialWindowPlacement };
  };
}

/**
 * The shell's facade over Meta's Layout SDK.
 *
 * @see {@linkcode createMetaWindows}
 */
export interface MetaWindows {
  /** True once the SDK modules loaded. */
  readonly isLinked: boolean;
  /** Meta's `SpatialSceneProvider`, or a fragment when the SDK is not linked. */
  SceneProvider(props: { children?: React.ReactNode }): React.ReactElement;
  /** Meta's `<SpatialWindow>` with `window` spread through, or its children in place. */
  Window(props: { window: SpatialWindowSpec; children?: React.ReactNode }): React.ReactElement;
  /** Placement of one window. Always `inline` when the SDK is not linked. */
  usePlacement(label: string): SpatialWindowPlacement;
  /** Whether this host can place spatial windows at all. */
  useSpatialAvailable(): boolean;
}

/**
 * The facade where the Layout SDK is not linked (PICO, phones, iOS, web):
 * every window renders its children in place and reports `inline`.
 */
export const UNLINKED_META_WINDOWS: MetaWindows = Object.freeze({
  isLinked: false,
  SceneProvider: ({ children }: { children?: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
  Window: ({ children }: { children?: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children),
  usePlacement: (): SpatialWindowPlacement => "inline",
  useSpatialAvailable: (): boolean => false,
});

/**
 * Builds the Meta window facade.
 *
 * `enabled` must be true only in the `quest` flavor (`isHorizonBuild`).
 * Elsewhere the codegen'd `SpatialWindowView` exists in C++ but has no view
 * manager, so rendering it fails. Disabled, `load` is never called and every
 * window renders its children where it is declared, which is what Meta's
 * `fallback="inline"` does. A `load` that throws is reported with
 * `console.warn` and treated as not linked.
 *
 * `load` runs in the app, which has the `@metavr/*` packages as direct
 * dependencies (`metaLayoutSdk` requires that):
 *
 * @example
 * ```ts
 * const metaWindows = createMetaWindows(isHorizonBuild, () => ({
 *   layout: require("@metavr/layout-compat"),
 *   window: require("@metavr/layout-window-compat"),
 * }));
 * ```
 *
 * Hooks are picked once, from the load result, so a component never switches
 * hook implementations between renders.
 */
export function createMetaWindows(enabled: boolean, load: () => MetaLayoutModules): MetaWindows {
  let modules: MetaLayoutModules | undefined;
  if (enabled) {
    try {
      modules = load();
    } catch (error) {
      console.warn(`[spatial-shell] Meta VR Layout SDK failed to load: ${String(error)}`);
    }
  }

  if (modules === undefined) return UNLINKED_META_WINDOWS;

  const { layout, window } = modules;
  // Meta's provider refuses configless initialization, and its initializer's
  // native type must not change while mounted, so build exactly one.
  const initializer = window.createWindowScene({ fallback: "inline" });

  return {
    isLinked: true,
    SceneProvider: ({ children }) =>
      React.createElement(layout.SpatialSceneProvider, { initializer }, children),
    Window: ({ window: props, children }) => React.createElement(window.SpatialWindow, props, children),
    usePlacement: (label) => window.useSpatialWindowState(label).placement,
    useSpatialAvailable: () => layout.useSpatialScene().isSpatialAvailable,
  };
}
