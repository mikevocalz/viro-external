import type { HybridObject } from "react-native-nitro-modules";

/**
 * Nitro spec for the pano control plane (PROMPT 21 §3.2, adapted to this
 * workspace's frozen texture-bridge contract).
 *
 * ADAPTATIONS from the prompt spec (recorded in DECISIONS.md):
 *  - `TextureHandle` is a STRUCT + native registry (the workspace's existing
 *    Mode A/B contract in react-native-viro-mux/src/contract.ts), NOT a
 *    HybridObject — cross-package HybridObject references complicate
 *    Nitrogen codegen for zero benefit; the struct+registry is proven.
 *  - Release is `releaseTexture(id)` on the controller (GL delete is deferred
 *    to the owning context thread — §5 threading table).
 *
 * Threading (§5): every method here arrives on the JS thread. Implementations
 * VALIDATE + ENQUEUE onto the render-thread command queue — they never touch
 * GL or VRO objects directly (R2).
 */

export type PanoTransitionType =
  | "fadeThroughColor"
  | "crossfade"
  | "wipe"
  | "iris"
  | "luminanceDissolve";

export type StereoLayout = "mono" | "topBottom" | "sideBySide";

/** Critically-damped by default (dampingRatio 1.0). Shared spring impl from @viro-external/core/math. */
export interface PanoSpring {
  stiffness: number;
  dampingRatio: number;
}

export interface PanoTransitionOptions {
  type?: PanoTransitionType; // default 'fadeThroughColor' (comfort default)
  durationMs?: number; // ignored if spring provided
  spring?: PanoSpring;
  /** fadeThroughColor only; default [0,0,0]. Linear-space RGB 0..1. */
  color?: number[];
  /** wipe only, degrees. */
  angleDeg?: number;
}

/**
 * Struct handle — mirror of the Mode A contract in
 * react-native-viro-mux/src/contract.ts. Minted by the preload pipeline on
 * the shared EGL context thread; resident before any transition may target it.
 */
export interface PanoTextureHandle {
  id: number;
  width: number;
  height: number;
  /** GPU-resident (upload complete, mips built). */
  isResident: boolean;
  stereo: StereoLayout;
  nativeToken: number;
}

export interface PanoController
  extends HybridObject<{ ios: "c++", android: "c++" }> {
  /**
   * Attach the pano background to the active Viro scene. nodeTag is the Viro
   * node handle resolved by the JS wrapper (<PanoView>); the native side
   * resolves the choreographer via the fork's Renderer.getChoreographerRef()
   * seam and registers the pano draw (draws FIRST: depth-write off,
   * depth-test off — §6.9).
   */
  attach(nodeTag: number): void;
  detach(): void;

  /**
   * Preload: resolves when the texture is GPU-resident (placeholder-first:
   * an optional tiny blurred equirect shows in <1 frame; full-res crossfades
   * over it when resident — §12.1). NEVER transitions implicitly.
   */
  preload(url: string, stereo: StereoLayout): Promise<PanoTextureHandle>;

  /** Zero-copy path for procedural/stitched sources (RGBA8, tightly packed). */
  preloadFromPixels(
    pixels: ArrayBuffer,
    width: number,
    height: number
  ): Promise<PanoTextureHandle>;

  /** Deferred GL delete on the owning context thread. Idempotent. */
  releaseTexture(handleId: number): void;

  /**
   * Transition: rejects if the handle is not resident. Runs 100% native
   * (R1 — zero per-frame JSI). A new transition during an active one
   * retargets cleanly (no snap — G4).
   */
  transitionTo(
    handleId: number,
    opts?: PanoTransitionOptions
  ): Promise<void>;
  cancelTransition(): void;
  /** Hard cut — restore-state paths only (§12.4). */
  setImmediate(handleId: number): void;

  /** Comfort (§12.2): recenter/snap-turn hook — 150ms fade-through-black. */
  comfortFade(durationMs: number): void;

  // Sync state (Nitro sync getters — no per-frame JS polling in production).
  readonly isTransitioning: boolean;
  readonly currentBlend: number;

  onTransitionStart(cb: (type: PanoTransitionType) => void): void;
  onTransitionEnd(cb: () => void): void;
  onError(cb: (code: string, message: string) => void): void;
}
