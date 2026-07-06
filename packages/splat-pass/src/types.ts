/**
 * Public TS contract for @viro-external/splat-pass.
 *
 * Per AGENTS.md, the wrapper is a thin native-bridge registrar — the
 * pipeline state lives in the native VROSplatRenderPass instance and is
 * mirrored read-only into the Zustand store for inspection.
 */

export type SplatSourceFormat = 'spz' | 'spz-4d';

export interface SplatSource {
  uri: string;
  format: SplatSourceFormat;
}

export interface SplatQuality {
  /**
   * Hard cap on rendered splats. Native pass truncates by importance
   * ranking (alpha × screen-space size). 0 ⇒ device-profile default
   * from config/defaults.json.
   */
  maxSplats?: number;

  /**
   * Auto-throttle the cap based on a measured frame budget. When set,
   * the native pass will halve the cap if the splat render exceeds
   * `frameBudgetMs` for `throttleAfterFrames` consecutive frames.
   * Defaults: budget 4ms, throttleAfter 30 frames.
   */
  frameBudgetMs?: number;
  throttleAfterFrames?: number;
}

export interface SplatPassOpts {
  /**
   * `findNodeHandle()` result for the host `ViroXRSceneNavigator` /
   * `ViroVRSceneNavigator`. The native bridge resolves this tag back
   * to a `VRT3DSceneNavigator` view, walks to `Renderer.getChoreographerRef()`,
   * and attaches the pass against that choreographer. **Required** —
   * the native side has no other way to know which Viro view should
   * host the pass when multiple are present.
   */
  sceneNavTag: number;

  source: SplatSource;

  /**
   * Returns the current playback time in seconds for 4D sources.
   * Called from the native side once per frame on the render thread —
   * keep cheap. Omitted ⇒ static 3D (no temporal evaluation).
   */
  getTimestamp?: () => number;

  quality?: SplatQuality;

  /**
   * Optional render-priority hint when multiple passes are registered
   * against the same Choreographer. Higher renders later (last writer
   * wins on the linear HDR target before tone-map). Default 0.
   */
  priority?: number;
}

export interface SplatPassHandle {
  /** Stable opaque id assigned by the native side. */
  readonly id: string;

  /**
   * Snapshot of the live splat count for the current frame. Reads from
   * the native pass — do not poll in a tight loop (one read per render
   * tick is cheap, every frame in a useEffect is not).
   */
  splatCount(): number;

  /** Detach from the active VROChoreographer and free native resources. */
  release(): void;
}

export interface SplatPassMetrics {
  /** Live splat count at the most recent frame. */
  splatCount: number;
  /** Sort dispatch ms (rolling 60-frame avg). */
  sortMs: number;
  /** Decode dispatch ms (rolling 60-frame avg). */
  decodeMs: number;
  /** Raster ms (rolling 60-frame avg). */
  rasterMs: number;
}

export interface DeviceProfile {
  id: string;
  maxSplats: number;
  sortWorkgroupSize: number;
  expectedFps: number;
}
