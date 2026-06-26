import React, { useEffect, useMemo, useRef } from "react";
import { ViroQuad } from "@reactvision/react-viro";
import {
  MovableNode,
  createPlaceholderMaterial,
  type MovableProps,
  type Vec3,
} from "react-native-viro-mux";
import defaults from "../../config/defaults.json";
import {
  fallbackDeviceProfile,
  getNativeSplatRenderer,
  isNativeSplatRendererAvailable,
} from "./NativeSplatRenderer";

// Optional splat-pass path. Imported eagerly because the dep is workspace-local;
// resolves to null at runtime if the consumer omitted the package from their build.
// ponytail: try/catch swallow handles the "not installed" case, not a hot path.
type SplatPassRegistrar = {
  registerSplatPass: (opts: {
    source: { uri: string; format: string };
    quality?: { maxSplats?: number };
    priority?: number;
    getTimestamp?: () => number;
  }) => Promise<{ id: string; release: () => void; splatCount: () => number }>;
  isNativeSplatPassAvailable: () => boolean;
};
let SPLAT_PASS: SplatPassRegistrar | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  SPLAT_PASS = require("@viro-external/splat-pass") as SplatPassRegistrar;
} catch {
  SPLAT_PASS = null;
}

export type SplatSourceFormat = "spz" | "splat" | "ply" | "ksplat";

export interface ViroGaussianSplatSource {
  uri: string;
  format: SplatSourceFormat;
}

export interface ViroGaussianSplatMeta {
  splatCount: number;
  bounds: [number, number, number, number, number, number];
  format: string;
  /** Total duration in seconds when the source is 4D; undefined for static 3D. */
  duration?: number;
}

export interface ViroGaussianSplatProps extends MovableProps {
  source: ViroGaussianSplatSource;
  /** Seconds into the 4D sequence. Omitted ⇒ static 3D (degenerate path; no temporal eval). */
  timestamp?: number;
  /** Advance timestamp automatically. */
  playing?: boolean;
  loop?: boolean;
  quality?: "low" | "medium" | "high" | "auto";
  /** Hard cap; native renderer truncates by importance ranking. */
  maxSplats?: number;
  progressive?: boolean;
  /** Named material the splat renderer's output texture binds to (via PROMPT-1 ViroGPUTexture). */
  materialName: string;
  /** Tabletop mode (default) renders at ~0.4m; full-scale mode bypasses scale clamps. */
  mode?: "tabletop" | "full-scale";
  position?: Vec3;
  rotation?: Vec3;
  scale?: Vec3;
  visible?: boolean;
  onLoadStart?: () => void;
  onProgress?: (fractionLoaded: number) => void;
  onLoad?: (meta: ViroGaussianSplatMeta) => void;
  onError?: (error: Error) => void;
}

interface DeviceProfile {
  maxSplats: number;
  targetFps: number;
  tempAllowed: boolean;
}

function resolveProfile(profileId: string): DeviceProfile {
  const table = defaults.gaussianSplat.deviceProfiles as Record<string, DeviceProfile>;
  return table[profileId] ?? table["unknown"]!;
}

/**
 * The React surface of the native 4D Gaussian-splat renderer.
 *
 * What ships here:
 * - Prop contract & device profile selection
 * - Tabletop/full-scale composition with MovableNode
 * - Capability detection + honest error when the native renderer is absent
 *
 * What does NOT ship here (and explicitly does NOT have a fake fallback):
 * - The container parser, temporal kernel, sort, rasterizer. Those land via the
 *   native GPU path (PROMPT-1 native bridge). Per PROMPT-4 rule 3, capability
 *   detection is correct; faking the splat is not. The component reports an
 *   honest error via onError when the native module is absent.
 */
export function ViroGaussianSplat(props: ViroGaussianSplatProps): React.ReactElement {
  const {
    source,
    timestamp,
    playing = false,
    loop = false,
    quality = "auto",
    maxSplats: maxSplatsOverride,
    progressive = true,
    materialName,
    mode = "tabletop",
    position,
    rotation,
    scale,
    visible = true,
    onLoadStart,
    onProgress,
    onLoad,
    onError,
    // Movable
    movable,
    dragType,
    dragPlane,
    axisLock,
    onMoveStart,
    onMove,
    onMoveEnd,
    pinchToScale,
  } = props;

  const reportedRef = useRef(false);
  const profile = useMemo(() => {
    const native = getNativeSplatRenderer();
    const id = native?.deviceProfile() ?? fallbackDeviceProfile();
    return { id, ...resolveProfile(id) };
  }, []);

  const effectiveMaxSplats = Math.min(maxSplatsOverride ?? profile.maxSplats, profile.maxSplats);

  // Capability detection + honest reporting. Source URL is intentionally NOT included in any message.
  useEffect(() => {
    if (reportedRef.current) return;
    reportedRef.current = true;
    if (!isNativeSplatRendererAvailable()) {
      onError?.(
        new Error(
          "ViroGaussianSplat: native Gaussian-splat renderer is not available in this build. " +
            "Splats are GPU-compute work and require a native rebuild (no OTA). No fallback is provided by design."
        )
      );
      return;
    }
    if (timestamp !== undefined && !profile.tempAllowed) {
      onError?.(
        new Error(
          `ViroGaussianSplat: device profile '${profile.id}' does not support 4D temporal evaluation. ` +
            `Provide a static 3D source (no timestamp) on this device.`
        )
      );
      return;
    }
    onLoadStart?.();
    // Real load/progress/onLoad events come from the native module via a Nitro event emitter
    // when the renderer is wired in. Until then, this is a no-op rather than a fake "fully loaded".
  }, [onError, onLoadStart, profile.id, profile.tempAllowed, timestamp]);

  // Splat-pass lifecycle: register a native VROSplatRenderPass on mount; release on unmount.
  // Only runs when @viro-external/splat-pass is wired in — legacy `ViroSplatRenderer` builds
  // skip this branch entirely.
  const tsRef = useRef(timestamp ?? 0);
  tsRef.current = timestamp ?? 0;
  useEffect(() => {
    const pass = SPLAT_PASS;
    if (!pass || !pass.isNativeSplatPassAvailable()) return;
    let cancelled = false;
    let handle: { release: () => void } | null = null;
    pass
      .registerSplatPass({
        source: { uri: source.uri, format: source.format },
        quality: { maxSplats: effectiveMaxSplats },
        getTimestamp: timestamp !== undefined ? () => tsRef.current : undefined,
      })
      .then((h) => {
        if (cancelled) {
          h.release();
          return;
        }
        handle = h;
      })
      .catch((err) => {
        if (!cancelled) onError?.(err instanceof Error ? err : new Error(String(err)));
      });
    return () => {
      cancelled = true;
      handle?.release();
      handle = null;
    };
    // timestamp tracked via ref — re-registering on every frame would be wrong.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source.uri, source.format, effectiveMaxSplats]);

  useEffect(() => {
    createPlaceholderMaterial(materialName);
  }, [materialName]);

  // ponytail: ViroQuad of unit size is the canvas; native renderer writes into materialName,
  // and quality / maxSplats / timestamp / playing / loop are conveyed through the native module
  // (not as ViroQuad props) — they are forwarded by the native side based on materialName binding.
  void quality;
  void effectiveMaxSplats;
  void progressive;
  void playing;
  void loop;
  void onProgress;
  void onLoad;

  const tabletopScale: Vec3 = useMemo(() => {
    const s = defaults.gaussianSplat.tabletop.scaleMeters;
    return [s, s, s];
  }, []);

  const effectiveScale = scale ?? (mode === "tabletop" ? tabletopScale : undefined);

  if (!visible) {
    return <></>;
  }

  // Pure splat-pass path: the native render pass writes directly into
  // the Choreographer's HDR target, so no placeholder ViroQuad is
  // needed. MovableNode still wraps for hit-test / drag affordances.
  const usingSplatPass =
    SPLAT_PASS != null && SPLAT_PASS.isNativeSplatPassAvailable();

  return (
    <MovableNode
      movable={mode === "tabletop" && movable}
      dragType={dragType}
      dragPlane={dragPlane}
      axisLock={axisLock}
      onMoveStart={onMoveStart}
      onMove={onMove}
      onMoveEnd={onMoveEnd}
      pinchToScale={mode === "tabletop" && pinchToScale}
      position={position}
      scale={effectiveScale}
    >
      {usingSplatPass ? null : (
        <ViroQuad
          rotation={rotation}
          width={1}
          height={1}
          materials={[materialName]}
        />
      )}
    </MovableNode>
  );
}

// Self-check: device profile resolution always returns the unknown profile for an unrecognized id.
if (typeof process !== "undefined" && process.env?.NODE_ENV === "test") {
  console.assert(resolveProfile("not-a-real-profile").maxSplats > 0, "fallback to unknown profile");
  console.assert(resolveProfile("quest3").tempAllowed === true, "quest3 allows 4D");
  console.assert(resolveProfile("quest2").tempAllowed === false, "quest2 does not allow 4D");
}
