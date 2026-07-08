import React, { useEffect, useMemo, useRef } from "react";
import { NativeModules } from "react-native";
import { ViroGeometry, ViroQuad } from "@reactvision/react-viro";
import { buildCurvedMesh } from "./ViroMuxSurface";
import defaults from "../config/defaults.json";
import type { ExternalTextureHandle, MovableProps, Vec3 } from "./contract";
import { createPlaceholderMaterial } from "./createPlaceholderMaterial";
import { MovableNode } from "./MovableNode";
import {
  isExternalTextureReady,
  registerExternalTexture,
  releaseExternalTexture,
} from "./ViroGPUTexture";
import { buildHlsUrl, type MuxTokens } from "./ViroMuxVideo";

/**
 * Native ExoPlayer producer (android/.../ViroMuxPlayerModule.kt). One player
 * per texture id, rendering into the Surface published by the
 * `surface-producer` texture bridge (doc/TextureBridge.md).
 */
export type ViroMuxPlayerStatus = {
  positionSec: number;
  durationSec: number;
  /** How far ahead of the playhead the buffer reaches, seconds. 0 on old APKs. */
  bufferedSec?: number;
  isPlaying: boolean;
  /** Current player volume 0..1. Undefined on old APKs. */
  volume?: number;
};

type ViroMuxPlayerNative = {
  play(textureId: number, url: string, loop: boolean, muted: boolean): void;
  pause(textureId: number): void;
  /** Resume without re-sending the url. */
  resume(textureId: number): void;
  seekTo(textureId: number, seconds: number): void;
  /**
   * Volume 0..1. 0 mutes; non-zero values are remembered natively as the
   * unmute target; -1 restores the last non-zero volume.
   */
  setVolume(textureId: number, volume: number): void;
  getStatus(textureId: number): Promise<ViroMuxPlayerStatus>;
  stop(textureId: number): void;
};

export function getPlayer(): ViroMuxPlayerNative {
  const mod = NativeModules.ViroMuxPlayer as ViroMuxPlayerNative | undefined;
  if (!mod) {
    throw new Error(
      "react-native-viro-mux: native module 'ViroMuxPlayer' not found — " +
        "rebuild the Android app (the module ships in ViroMuxPackage)."
    );
  }
  return mod;
}

export type ViroMuxBridgeSurfaceProps = {
  /** 0 = flat, 1 = fully curved cylindrical section. */
  curvature?: number;
  /** Mux playback id — resolved to https://stream.mux.com/<id>.m3u8. */
  playbackId?: string;
  /** Direct media URL (HLS .m3u8 or progressive). Overrides playbackId. */
  url?: string;
  /** Signed-playback tokens (only used with playbackId). */
  tokens?: MuxTokens;
  /**
   * Override the auto-generated Viro material name the external texture is
   * bound to. Lets a caller put the SAME live video material on additional
   * geometry (e.g. an inward-facing 360 sphere) — Viro materials are
   * name-addressable and shareable across geometries.
   */
  materialName?: string;
  /** Quad width in meters. */
  width?: number;
  /** Quad height in meters. */
  height?: number;
  /** Decode surface size in pixels. */
  textureWidth?: number;
  /** Decode surface size in pixels. */
  textureHeight?: number;
  loop?: boolean;
  muted?: boolean;
  paused?: boolean;
  position?: Vec3;
  scale?: Vec3;
  /** Fired once the Surface is bound and playback has been requested. */
  onReady?: () => void;
  /**
   * Fired with the texture id once the Surface is bound — the id to pass to
   * the native `ViroMuxPlayer` module for pause/resume/seekTo/getStatus
   * (ViroMuxPlayerDock's transport hook).
   */
  onTextureId?: (textureId: number) => void;
  onError?: (error: Error) => void;
} & MovableProps;

let autoMaterialId = 0;

// Bridge binding retries natively for 10s (HybridViroGPUTextureModule:
// 40 × 250ms) — poll a little longer than that before giving up.
const READY_POLL_MS = 250;
const READY_TIMEOUT_MS = 15000;

/**
 * Movable video quad driven by the GPU texture bridge:
 *
 *   ExoPlayer (native, per texture id)
 *     └─ android.view.Surface            ← ViroGPUTextureSurfaces.getSurface(id)
 *          └─ SurfaceTexture (OES)       ← registerExternalTexture(material, surface-producer)
 *               └─ named Viro material   ← this quad
 *
 * This intentionally does NOT use ViroMaterialVideo / com.viro.core.VideoTexture
 * (that legacy path deadlocks the OpenXR scene at creation — see
 * doc/TextureBridge.md and decax9 orb-test history).
 */
function CurvedVideoMesh(props: {
  width: number;
  height: number;
  curvature: number;
  materialName: string;
}): React.ReactElement {
  const mesh = React.useMemo(() => {
    const m = buildCurvedMesh(props.width, props.height, Math.max(props.curvature, 0.02), 24);
    // SurfaceTexture frames are Y-flipped relative to Viro UVs.
    return { ...m, texcoords: m.texcoords.map(([u, v]) => [u, 1 - v] as [number, number]) };
  }, [props.width, props.height, props.curvature]);
  return (
    <ViroGeometry
      vertices={mesh.vertices}
      normals={mesh.normals}
      texcoords={mesh.texcoords}
      triangleIndices={mesh.triangleIndices}
      materials={[props.materialName]}
    />
  );
}

export function ViroMuxBridgeSurface(props: ViroMuxBridgeSurfaceProps): React.ReactElement {
  const {
    playbackId,
    url,
    tokens,
    materialName: materialNameProp,
    width = defaults.surface.widthMeters,
    height = defaults.surface.heightMeters,
    curvature = 0,
    textureWidth = 1280,
    textureHeight = 720,
    loop = true,
    muted = defaults.mux.playback.muted,
    paused = false,
    position,
    scale,
    onReady,
    onTextureId,
    onError,
    // movable props
    movable,
    tag,
    dragType,
    dragPlane,
    axisLock,
    onMoveStart,
    onMove,
    onMoveEnd,
    pinchToScale,
  } = props;

  const resolvedUrl = useMemo(() => {
    if (url) return url;
    if (playbackId) return buildHlsUrl(playbackId, tokens);
    return null;
  }, [url, playbackId, tokens]);

  // Material must exist BEFORE the quad's materials prop commits AND before
  // registerExternalTexture binds — createPlaceholderMaterial is idempotent
  // and synchronous, so seed it while deriving the name (issue #436 +
  // "register after final material definition" caveat, doc/TextureBridge.md).
  const materialName = useMemo(() => {
    const name = materialNameProp ?? `viroMuxBridge_${++autoMaterialId}`;
    createPlaceholderMaterial(name);
    return name;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [materialNameProp]);

  const handleRef = useRef<ExternalTextureHandle | null>(null);
  const startedRef = useRef(false);
  const resolvedUrlRef = useRef(resolvedUrl);
  resolvedUrlRef.current = resolvedUrl;

  useEffect(() => {
    if (!resolvedUrl) {
      onError?.(new Error("ViroMuxBridgeSurface: neither `url` nor `playbackId` provided"));
      return;
    }

    let cancelled = false;
    let handle: ExternalTextureHandle;
    try {
      handle = registerExternalTexture(materialName, {
        id: 0,
        kind: "surface-producer",
        width: textureWidth,
        height: textureHeight,
        colorSpace: "srgb",
      });
    } catch (e) {
      onError?.(e instanceof Error ? e : new Error(String(e)));
      return;
    }
    handleRef.current = handle;
    // Lifecycle forensics: the effect cleanup is the ONLY caller of native
    // stop() — logging register/cleanup makes a mid-playback teardown
    // attributable (deps change vs unmount) instead of invisible.
    console.log(`[VXMUX] surface register mat=${materialName} url=${resolvedUrl}`);

    const startedAt = Date.now();
    const poll = setInterval(() => {
      if (cancelled) return;
      if (isExternalTextureReady(handle)) {
        clearInterval(poll);
        startedRef.current = true;
        try {
          onTextureId?.(handle.id);
          getPlayer().play(handle.id, resolvedUrl, loop, muted);
          onReady?.();
        } catch (e) {
          onError?.(e instanceof Error ? e : new Error(String(e)));
        }
        return;
      }
      if (Date.now() - startedAt > READY_TIMEOUT_MS) {
        clearInterval(poll);
        onError?.(
          new Error(
            `ViroMuxBridgeSurface: surface for material '${materialName}' not ready ` +
              `after ${READY_TIMEOUT_MS}ms — is a Viro scene navigator mounted?`
          )
        );
      }
    }, READY_POLL_MS);

    return () => {
      console.log(`[VXMUX] surface CLEANUP mat=${materialName} tex=${handle.id} — stopping player`);
      cancelled = true;
      clearInterval(poll);
      startedRef.current = false;
      handleRef.current = null;
      try {
        getPlayer().stop(handle.id);
      } catch {
        // native module missing — nothing to stop
      }
      releaseExternalTexture(handle);
    };
    // Intentionally NOT keyed on loop/muted — those are re-applied by the
    // idempotent native play() below without tearing the pipeline down.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedUrl, materialName, textureWidth, textureHeight]);

  // Pause / resume (native play() is an idempotent resume once created).
  useEffect(() => {
    const handle = handleRef.current;
    const currentUrl = resolvedUrlRef.current;
    if (!handle || !startedRef.current || !currentUrl) return;
    try {
      if (paused) getPlayer().pause(handle.id);
      else getPlayer().play(handle.id, currentUrl, loop, muted);
    } catch (e) {
      onError?.(e instanceof Error ? e : new Error(String(e)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused, loop, muted]);

  return (
    <MovableNode
      movable={movable}
      tag={tag}
      dragType={dragType}
      dragPlane={dragPlane}
      axisLock={axisLock}
      onMoveStart={onMoveStart}
      onMove={onMove}
      onMoveEnd={onMoveEnd}
      pinchToScale={pinchToScale}
      position={position}
      scale={scale}
    >
      <CurvedVideoMesh width={width} height={height} curvature={curvature} materialName={materialName} />
    </MovableNode>
  );
}
