import type {
  NativeRiveSpatialAdapter,
  RiveSpatialSurfaceConfig,
  RiveSpatialSurfaceHandle,
} from "@viro-external/xr-contract";

/**
 * Native Rive scene integration point.
 *
 * This is intentionally a controller/factory, not a React Native View.
 * A React Native RiveView cannot become a Viro scene node merely by nesting
 * it in JSX; the native renderer must own the scene-node integration.
 *
 * Interactive Rive panels also expose drag lifecycle methods. ESIK owns the
 * spatial drag gesture and the native adapter applies the resulting transform;
 * Rive remains responsible for animation/state-machine behavior.
 */
export function createRiveSpatialSurface(
  adapter: NativeRiveSpatialAdapter,
  config: RiveSpatialSurfaceConfig,
): RiveSpatialSurfaceHandle {
  return adapter.mount(config);
}

export function disposeRiveSpatialSurface(
  adapter: NativeRiveSpatialAdapter,
  handle: RiveSpatialSurfaceHandle,
): void {
  adapter.unmount(handle);
}
