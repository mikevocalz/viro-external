import React, { useCallback, useEffect, useMemo, useRef } from "react";
import {
  ViroAnimations,
  ViroImage,
  ViroMaterials,
  ViroNode,
  ViroQuad,
  ViroText,
} from "@reactvision/react-viro";
import defaults from "../config/defaults.json";
import type { MovableProps, Vec3 } from "./contract";
import { MovableNode } from "./MovableNode";
import {
  getPlayer,
  ViroMuxBridgeSurface,
  type ViroMuxBridgeSurfaceProps,
} from "./ViroMuxBridgeSurface";
import { buildHlsUrl, type MuxTokens } from "./ViroMuxVideo";

/**
 * ViroMuxBridgeSurface + transport chrome: play/pause, Gizmo-drag seek bar,
 * hamburger playlist drawer (Mux thumbnails via the public image API).
 *
 * XR input contract (PICO): trigger = click, grip/A = drag. Every control is
 * a `dragType="Gizmo"` sink — the drag is REPORTED but the node is not moved
 * and it does NOT bubble to the dock's MovableNode, so scrubbing the seek
 * bar never drags the whole dock. Grabbing the video body still moves it.
 */
export type ViroMuxPlaylistEntry = {
  playbackId: string;
  title: string;
  /**
   * How the video should be displayed. "flat" (default) renders on the
   * panel's quad/curved mesh; "360" is equirectangular content that enters
   * immersive mode (inward-facing sphere sharing the same external-texture
   * material) when selected.
   */
  projection?: "flat" | "360";
};

export type ViroMuxPlayerDockProps = {
  playlist?: ViroMuxPlaylistEntry[];
  tokens?: MuxTokens;
} & Omit<ViroMuxBridgeSurfaceProps, "tokens" | "paused"> &
  MovableProps;

// ── Shared transport state (external store, keyed per dock instance).
// zustand is not a dependency of this package (gui depends on US — importing
// it back would be a cycle, and the workspace install doesn't hoist it here),
// so this is the same pattern hand-rolled on useSyncExternalStore.
export interface ViroMuxDockState {
  textureId: number | null;
  positionSec: number;
  durationSec: number;
  isPlaying: boolean;
  drawerOpen: boolean;
  activeIndex: number;
  scrubbing: boolean;
  scrubFrac: number;
}
const initialDock: ViroMuxDockState = {
  textureId: null,
  positionSec: 0,
  durationSec: 0,
  isPlaying: false,
  drawerOpen: false,
  activeIndex: 0,
  scrubbing: false,
  scrubFrac: 0,
};
const dockStates: Record<number, ViroMuxDockState> = {};
const dockListeners = new Set<() => void>();
export function getMuxDockState(dockId: number): ViroMuxDockState {
  return dockStates[dockId] ?? initialDock;
}
function patchMuxDock(dockId: number, partial: Partial<ViroMuxDockState>): void {
  dockStates[dockId] = { ...getMuxDockState(dockId), ...partial };
  dockListeners.forEach((l) => l());
}
function useMuxDockState(dockId: number): ViroMuxDockState {
  return React.useSyncExternalStore(
    (cb) => {
      dockListeners.add(cb);
      return () => dockListeners.delete(cb);
    },
    () => getMuxDockState(dockId)
  );
}

// ── Chrome materials / icons ───────────────────────────────────────────────
// Registered during render (never useEffect). #AARRGGBB. Fills ≥ #2A2A32-ish
// so the chrome doesn't wash out over passthrough.
const M = {
  bar: "vxm_dock_bar",
  track: "vxm_dock_track",
  trackFill: "vxm_dock_track_fill",
  thumb: "vxm_dock_thumb",
  btn: "vxm_dock_btn",
  btnHover: "vxm_dock_btn_hover",
  drawer: "vxm_dock_drawer",
  row: "vxm_dock_row",
  rowHover: "vxm_dock_row_hover",
} as const;
let materialsRegistered = false;
function registerDockMaterials(): void {
  if (materialsRegistered) return;
  materialsRegistered = true;
  ViroMaterials.createMaterials({
    [M.bar]: { diffuseColor: "#F51E212B", lightingModel: "Constant" },
    [M.track]: { diffuseColor: "#FF3A3F4E", lightingModel: "Constant" },
    [M.trackFill]: { diffuseColor: "#FF7FB2FF", lightingModel: "Constant" },
    [M.thumb]: { diffuseColor: "#FFFFFFFF", lightingModel: "Constant" },
    [M.btn]: { diffuseColor: "#F22A2E38", lightingModel: "Constant" },
    [M.btnHover]: { diffuseColor: "#F2434A5C", lightingModel: "Constant" },
    [M.drawer]: { diffuseColor: "#F81A1D26", lightingModel: "Constant" },
    [M.row]: { diffuseColor: "#F2262A34", lightingModel: "Constant" },
    [M.rowHover]: { diffuseColor: "#F2434A5C", lightingModel: "Constant" },
  });
}

// Local white-PNG icon set (copied from @viro-external/gui's icon pipeline —
// gui depends on this package, so importing LucideIcon back would be a cycle).
const ICONS = {
  play: require("../assets/icons/play.png"),
  pause: require("../assets/icons/pause.png"),
  menu: require("../assets/icons/menu.png"),
} as const;

// Gizmo drag: reported to JS, node NOT moved, no bubbling to the dock root.
const GIZMO = "Gizmo" as never;
const noopDrag = () => {};

/** World-size-correct label (Text3D's canvas-scale trick, local minimal copy). */
function DockText(props: {
  text: string;
  width: number;
  height: number;
  color?: string;
  textAlign?: "left" | "center" | "right";
  position?: Vec3;
}): React.ReactElement {
  const { text, width, height, color = "#EDEDF2", textAlign = "left", position } = props;
  const longest = text.split("\n").reduce((m, l) => Math.max(m, l.length), 1);
  const size = Math.max(1, Math.round(Math.min((0.92 * 100) / (0.55 * longest), (80 * height) / width)));
  const K = 2;
  return (
    <ViroNode position={position} scale={[width / K, width / K, 1]}>
      <ViroText
        text={text}
        color={color}
        width={K}
        height={(height / width) * K}
        textClipMode="None"
        style={{ fontSize: size * K, fontWeight: "500", textAlign, textAlignVertical: "center" }}
        ignoreEventHandling
      />
    </ViroNode>
  );
}

function IconButton(props: {
  icon: keyof typeof ICONS;
  size: number;
  position: Vec3;
  onClick: () => void;
}): React.ReactElement {
  const [hovered, setHovered] = React.useState(false);
  return (
    <ViroNode position={props.position} dragType={GIZMO} onDrag={noopDrag}>
      <ViroQuad
        width={props.size}
        height={props.size}
        materials={[hovered ? M.btnHover : M.btn]}
        onHover={(h: boolean) => setHovered(h)}
        onClick={props.onClick}
      />
      <ViroImage
        source={ICONS[props.icon]}
        width={props.size * 0.62}
        height={props.size * 0.62}
        position={[0, 0, 0.002]}
        ignoreEventHandling
      />
    </ViroNode>
  );
}

let dockInstanceId = 0;

export function ViroMuxPlayerDock(props: ViroMuxPlayerDockProps): React.ReactElement {
  const {
    playlist,
    playbackId,
    url,
    tokens,
    width = defaults.surface.widthMeters,
    height = defaults.surface.heightMeters,
    loop = true,
    muted = defaults.mux.playback.muted,
    position,
    scale,
    onReady,
    onError,
    movable,
    tag,
    dragType,
    dragPlane,
    axisLock,
    onMoveStart,
    onMove,
    onMoveEnd,
    pinchToScale,
    ...surfaceRest
  } = props;

  registerDockMaterials();

  const dockId = useMemo(() => ++dockInstanceId, []);
  const dock = useMuxDockState(dockId);

  // ── Layout ────────────────────────────────────────────────────────────
  const barH = Math.max(0.09, height * 0.14);
  const barW = width * 0.96;
  const barY = -height / 2 - barH / 2 - 0.03;
  const btnSize = barH * 0.72;
  const trackW = barW - btnSize * 2.2;
  const trackX = btnSize * 0.55; // track center, right of the play button
  const thumbSize = barH * 0.34;

  const drawerW = Math.max(0.44, width * 0.36);
  const entryH = 0.13;
  const entries = playlist ?? [];
  const drawerH = Math.max(entryH * entries.length + 0.04, entryH + 0.04);
  const drawerClosedX = -width / 2 + drawerW / 2 - 0.06;
  const drawerOpenX = -width / 2 - drawerW / 2 - 0.04;
  const drawerY = height / 2 - drawerH / 2;

  // Per-dock slide-out animation (targets are computed, so names are scoped).
  const drawerAnim = useMemo(() => {
    const name = `vxmDrawerOpen_${dockId}`;
    ViroAnimations.registerAnimations({
      [name]: { properties: { positionX: drawerOpenX }, duration: 300, easing: "EaseOut" },
    });
    return name;
  }, [dockId, drawerOpenX]);

  // ── Transport ─────────────────────────────────────────────────────────
  const activeUrl = useMemo(() => {
    if (entries.length > 0) return buildHlsUrl(entries[Math.min(dock.activeIndex, entries.length - 1)]!.playbackId, tokens);
    if (url) return url;
    if (playbackId) return buildHlsUrl(playbackId, tokens);
    return null;
  }, [entries, dock.activeIndex, url, playbackId, tokens]);
  const initialUrl = useRef(activeUrl); // the surface owns the FIRST load only

  const wasPlayingRef = useRef<boolean | null>(null);

  // Poll native status ~500ms while the surface is live (skipped mid-scrub so
  // the thumb doesn't fight the hand).
  useEffect(() => {
    const textureId = dock.textureId;
    if (textureId == null) return;
    // JS updates over Metro can outrun the installed APK — degrade instead of
    // throwing every 500ms when the transport API isn't in the binary yet.
    if (typeof getPlayer().getStatus !== "function") {
      console.log(`[VXMUX] dock${dockId} native transport API missing — rebuild + install the APK for seek/status`);
      return;
    }
    const iv = setInterval(() => {
      const s = getMuxDockState(dockId);
      if (s?.scrubbing) return;
      getPlayer()
        .getStatus(textureId)
        .then((st) => {
          if (wasPlayingRef.current !== st.isPlaying) {
            wasPlayingRef.current = st.isPlaying;
            console.log(`[VXMUX] dock${dockId} isPlaying → ${st.isPlaying}`);
          }
          patchMuxDock(dockId,{
            positionSec: st.positionSec,
            durationSec: st.durationSec,
            isPlaying: st.isPlaying,
          });
        })
        .catch(() => {}); // player not created yet — next tick
    }, 500);
    return () => clearInterval(iv);
  }, [dock.textureId, dockId]);

  const togglePlay = useCallback(() => {
    const textureId = getMuxDockState(dockId)?.textureId;
    if (textureId == null) return;
    const playing = getMuxDockState(dockId)?.isPlaying ?? false;
    console.log(`[VXMUX] dock${dockId} ${playing ? "pause" : "resume"}`);
    if (playing) getPlayer().pause(textureId);
    else if (typeof getPlayer().resume === "function") getPlayer().resume(textureId);
    else if (activeUrl) getPlayer().play(textureId, activeUrl, loop, muted); // old-APK fallback: play() resumes
    patchMuxDock(dockId,{ isPlaying: !playing }); // optimistic; poll corrects
  }, [dockId, activeUrl, loop, muted]);

  const selectEntry = useCallback(
    (index: number) => {
      const textureId = getMuxDockState(dockId)?.textureId;
      const entry = entries[index];
      if (textureId == null || !entry) return;
      const nextUrl = buildHlsUrl(entry.playbackId, tokens);
      console.log(`[VXMUX] dock${dockId} playlist → "${entry.title}" (${entry.playbackId})`);
      // Same texture id — native play() re-prepares when the url differs.
      getPlayer().play(textureId, nextUrl, loop, muted);
      patchMuxDock(dockId,{ activeIndex: index, drawerOpen: false, isPlaying: true, positionSec: 0 });
    },
    [dockId, entries, tokens, loop, muted]
  );

  // ── Seek (Gizmo drag: deltas between reported positions → track fraction) ─
  const lastDrag = useRef<[number, number, number] | null>(null);
  const lastSeekSent = useRef(0);
  const commitSeek = useCallback(
    (frac: number, final: boolean) => {
      const s = getMuxDockState(dockId);
      if (!s || s.textureId == null || s.durationSec <= 0) return;
      if (typeof getPlayer().seekTo !== "function") return; // old-APK: no seek
      const now = Date.now();
      if (!final && now - lastSeekSent.current < 250) return;
      lastSeekSent.current = now;
      getPlayer().seekTo(s.textureId, frac * s.durationSec);
      if (final) console.log(`[VXMUX] dock${dockId} seek → ${(frac * s.durationSec).toFixed(1)}s`);
    },
    [dockId]
  );

  const playedFrac = dock.scrubbing
    ? dock.scrubFrac
    : dock.durationSec > 0
      ? Math.min(1, dock.positionSec / dock.durationSec)
      : 0;
  const thumbX = -trackW / 2 + playedFrac * trackW;

  return (
    <MovableNode
      movable={movable}
      tag={tag ?? "vxm-dock"}
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
      {/* Video — grabbing the picture drags the whole dock (bubbles to root). */}
      <ViroMuxBridgeSurface
        {...surfaceRest}
        url={initialUrl.current ?? undefined}
        width={width}
        height={height}
        loop={loop}
        muted={muted}
        onReady={onReady}
        onError={onError}
        onTextureId={(id) => {
          console.log(`[VXMUX] dock${dockId} textureId=${id}`);
          patchMuxDock(dockId,{ textureId: id });
        }}
      />

      {/* Hamburger — playlist drawer toggle, video top-left. */}
      {entries.length > 0 && (
        <IconButton
          icon="menu"
          size={0.09}
          position={[-width / 2 + 0.075, height / 2 - 0.075, 0.02]}
          onClick={() => {
            const open = !(getMuxDockState(dockId)?.drawerOpen ?? false);
            console.log(`[VXMUX] dock${dockId} drawer ${open ? "open" : "close"}`);
            patchMuxDock(dockId,{ drawerOpen: open });
          }}
        />
      )}

      {/* Control bar — below the video. */}
      <ViroNode position={[0, barY, 0.01]}>
        <ViroQuad
          width={barW}
          height={barH}
          materials={[M.bar]}
          dragType={GIZMO}
          onDrag={noopDrag}
        />
        <IconButton
          icon={dock.isPlaying ? "pause" : "play"}
          size={btnSize}
          position={[-barW / 2 + btnSize * 0.75, 0, 0.004]}
          onClick={togglePlay}
        />
        {/* Seek track + played fill + Gizmo thumb. */}
        <ViroNode position={[trackX, 0, 0.004]}>
          <ViroQuad width={trackW} height={0.012} materials={[M.track]} dragType={GIZMO} onDrag={noopDrag} />
          <ViroQuad
            width={Math.max(0.001, playedFrac * trackW)}
            height={0.012}
            materials={[M.trackFill]}
            position={[-trackW / 2 + (playedFrac * trackW) / 2, 0, 0.001]}
            ignoreEventHandling
          />
          <ViroNode
            position={[thumbX, 0, 0.003]}
            dragType={GIZMO}
            onDrag={(pos: number[]) => {
              const p = pos as [number, number, number];
              if (!lastDrag.current) {
                lastDrag.current = p;
                patchMuxDock(dockId,{ scrubbing: true, scrubFrac: playedFrac });
                return;
              }
              const dx = p[0] - lastDrag.current[0];
              lastDrag.current = p;
              const s = getMuxDockState(dockId);
              const frac = Math.min(1, Math.max(0, (s?.scrubFrac ?? 0) + dx / trackW));
              patchMuxDock(dockId,{ scrubFrac: frac });
              commitSeek(frac, false);
            }}
            onClickState={(state: number) => {
              if (state === 2 && lastDrag.current) {
                lastDrag.current = null;
                const frac = getMuxDockState(dockId)?.scrubFrac ?? 0;
                commitSeek(frac, true);
                patchMuxDock(dockId,{ scrubbing: false });
              }
            }}
          >
            <ViroQuad width={thumbSize} height={thumbSize} materials={[M.thumb]} />
          </ViroNode>
        </ViroNode>
      </ViroNode>

      {/* Playlist drawer — slides out to the left on open (unmounts on close). */}
      {dock.drawerOpen && entries.length > 0 && (
        <ViroNode
          position={[drawerClosedX, drawerY, 0.03]}
          animation={{ name: drawerAnim, run: true, loop: false }}
        >
          <ViroQuad width={drawerW} height={drawerH} materials={[M.drawer]} dragType={GIZMO} onDrag={noopDrag} />
          {entries.map((entry, i) => {
            const rowY = drawerH / 2 - 0.02 - entryH / 2 - i * entryH;
            const active = i === dock.activeIndex;
            return (
              <ViroNode
                key={`${entry.playbackId}-${i}`}
                position={[0, rowY, 0.004]}
                dragType={GIZMO}
                onDrag={noopDrag}
                onClick={() => selectEntry(i)}
              >
                <ViroQuad width={drawerW - 0.02} height={entryH - 0.012} materials={[active ? M.rowHover : M.row]} />
                <ViroImage
                  source={{ uri: `https://image.mux.com/${entry.playbackId}/thumbnail.png?width=256` }}
                  width={0.17}
                  height={0.0956}
                  position={[-drawerW / 2 + 0.1, 0, 0.003]}
                  ignoreEventHandling
                />
                <DockText
                  text={entry.title}
                  width={drawerW - 0.24}
                  height={entryH * 0.6}
                  position={[0.1, 0, 0.003]}
                />
              </ViroNode>
            );
          })}
        </ViroNode>
      )}
    </MovableNode>
  );
}
