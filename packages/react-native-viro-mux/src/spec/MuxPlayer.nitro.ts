import { Android, type HybridObject } from "nitro-core";
import type { NitroExternalTextureHandle } from "./ViroGPUTextureModule.nitro";

export * from "#nitro/MuxPlayer";

/**
 * Nitro spec for the Mux player control plane (PROMPT 21 §4.1).
 *
 * The player is OWNED by this HybridObject on a dedicated player
 * thread/Looper (§5). Methods arrive on the JS thread: playback control is
 * posted to the player thread; anything touching GL/VRO goes through the
 * render-thread command queue (R2). Frame delivery is 100% native:
 * SurfaceTexture.onFrameAvailable → render-thread updateTexImage +
 * getTransformMatrix (the OES transform is applied IN-SHADER, always — §6.3).
 *
 * `getTextureHandle()` returns the workspace's struct handle (Mode B,
 * GL_TEXTURE_EXTERNAL_OES) — same registry as ViroGPUTextureModule; the
 * pano sphere or any quad material consumes it.
 *
 * No native class implements this spec yet. Playback today runs through the
 * classic `ViroMuxPlayer` React Native module (android/.../ViroMuxPlayerModule.kt,
 * used by ViroMuxBridgeSurface). The spec therefore declares no concrete
 * implementation and no public constructor: JS cannot construct it, and the
 * generated bindings reference no missing Kotlin class. When `HybridMuxPlayer`
 * lands, switch to `implementation: { className: "HybridMuxPlayer" }` and add
 * `constructor()`.
 */

export type MuxSink = "sceneTexture" | "equirect2Layer" | "quadLayer";

export type MuxPlayerState =
  | "idle"
  | "buffering"
  | "ready"
  | "ended"
  | "error";

/** Head-locked stereo (default) or world-locked stereo bed (§12.5). */
export type MuxAudioMode = "headLocked" | "worldLocked";

export interface MuxSource {
  playbackId?: string;
  /** Direct HLS/MP4 escape hatch — overrides playbackId. */
  url?: string;
  /** Signed playback token (Mux). */
  token?: string;
  startPositionMs?: number;
}

@Android({
  language: "kotlin",
  allowMultipleImplementations: true,
})
export declare class MuxPlayer extends HybridObject {
  load(source: MuxSource): Promise<void>;
  play(): void;
  pause(): void;
  seekTo(positionMs: number): Promise<void>;
  setRate(rate: number): void;
  setVolume(volume: number): void;
  setLooping(looping: boolean): void;
  setAudioMode(mode: MuxAudioMode): void;
  /** 360 ABR floor/ceiling control (§12.3): floor 3840-wide enforced natively. */
  setMaxTier(maxWidth: number): void;
  release(): void;

  /**
   * Sink selection — same player, multiple outputs.
   *  - sceneTexture: Mode B OES SurfaceTexture → struct handle (pano/quad).
   *  - equirect2Layer / quadLayer: Phase 6 — decoder surface →
   *    XR_KHR_android_surface_swapchain → compositor layer. Degrades
   *    silently to sceneTexture where the extension is absent (R4).
   */
  setSink(sink: MuxSink): Promise<void>;
  /** sceneTexture sink only; throws otherwise. */
  getTextureHandle(): NitroExternalTextureHandle;

  // Sync getters — the AV-lock backbone. Cheap; no per-frame JS polling.
  readonly positionMs: number;
  readonly durationMs: number;
  readonly bufferedMs: number;
  readonly isPlaying: boolean;
  readonly videoWidth: number;
  readonly videoHeight: number;

  onStateChange(cb: (state: MuxPlayerState) => void): void;
  /** Fires on the JS thread via Nitro's dispatcher at intervalMs cadence. */
  onProgress(
    cb: (positionMs: number, bufferedMs: number) => void,
    intervalMs: number
  ): void;
  onError(cb: (code: string, message: string) => void): void;
}
