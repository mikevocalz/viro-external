import React, { useCallback, useEffect, useMemo, useRef } from "react";
import {
  ViroAnimations,
  ViroGeometry,
  ViroImage,
  ViroMaterials,
  ViroNode,
  ViroQuad,
  ViroSphere,
} from "@reactvision/react-viro";
import {
  ViroMuxBridgeSurface,
  buildHlsUrl,
  createPlaceholderMaterial,
  getPlayer,
  MovableNode,
  type MovableProps,
  type MuxTokens,
  type Vec3,
  type ViroMuxBridgeSurfaceProps,
  type ViroMuxPlaylistEntry,
} from "react-native-viro-mux";
import { create } from "zustand";
import { FluentMaterials, registerFluentMaterials } from "./materials";
import { roundedPlateBuffers } from "./roundedPlate";
import { arcPlateBuffers, makeArcFrame, polarPose, type ArcFrame } from "./arc";
import { LucideIcon, type LucideIconName } from "./LucideIcon";
import { Text3D } from "./Text3D";
import { PanelHeader3D, TitleBarButton, registerHeaderAnims } from "./PanelHeader3D";

/**
 * The Mux video dock, gui-side: ViroMuxBridgeSurface + the SAME PanelHeader3D
 * chrome as HolographicSlate/CylinderPanel (title, hamburger leftAccessory,
 * pin, close, 360-expand globe) + a full Mux-player-anatomy control bar
 * (play/pause, time, buffered+progress scrubber with hover-scaling thumb,
 * duration, mute toggle + hover-expanding volume slider) + an always-mounted
 * playlist drawer + an immersive 360 mode (inward-facing sphere sharing the
 * live external-texture material).
 *
 * CURVED CHROME: when `curvature > 0` every chrome element (header bar,
 * control bar, drawer, and their children) is placed on a cylinder
 * CONCENTRIC with the video mesh — see src/arc.ts for the math (identical
 * radius/chord relation to buildCurvedMesh: radius = width/(2·sin(halfArc)),
 * axis at [0, y, radius·cos(halfArc)]). Backplates sit 8mm proud (smaller
 * radius) of the video; radial layer separation between stacked chrome
 * elements is kept ≥ 2mm.
 *
 * PERSISTENCE: transport state lives in a MODULE-LEVEL zustand store keyed
 * by a STABLE string (persistKey ?? tag), so it survives unmount/remount —
 * leaving the scene, closing the panel, or switching videos and returning.
 * On rebind: position (per playlist entry) is re-seeked once the texture
 * binds and playback is requested, and volume/mute are restored. Unmount
 * pauses/stops the native player but NEVER resets the store.
 *
 * DEPENDENCY DIRECTION: @viro-external/gui depends on react-native-viro-mux
 * (peer dep), never the reverse — so this composition lives HERE, importing
 * mux's transport primitives, instead of viro-mux importing PanelHeader3D
 * (which would be a workspace cycle). viro-mux's own ViroMuxPlayerDock stays
 * as the header-less low-level fallback.
 *
 * XR input contract (PICO): trigger = click, A/X/grip = drag. Every control
 * is a `dragType="Gizmo"` sink — drags are REPORTED, the node is NOT moved,
 * and nothing bubbles to the root MovableNode, so scrubbing never drags the
 * dock. Grabbing the video body still moves it.
 */

export type MuxPlayerPanelProps = {
  /** Header title. */
  title?: string;
  titleFontFamily?: string;
  /** Font for the m:ss time labels (e.g. "Inter-Regular"). */
  timeFontFamily?: string;
  playlist?: ViroMuxPlaylistEntry[];
  tokens?: MuxTokens;
  /** Babylon FollowBehavior parity: pinned in place, or billboard toward the user. */
  defaultPinned?: boolean;
  rotation?: Vec3;
  onClose?: () => void;
  /**
   * Stable key for the persisted transport store. Defaults to `tag`. Two
   * mounted panels sharing a key share transport state — give each panel a
   * distinct key/tag.
   */
  persistKey?: string;
} & Omit<ViroMuxBridgeSurfaceProps, "tokens" | "paused" | "materialName"> &
  MovableProps;

// ── Shared transport state (zustand, MODULE-LEVEL, keyed by persistKey) ────
export interface MuxPanelState {
  textureId: number | null;
  positionSec: number;
  durationSec: number;
  bufferedSec: number;
  isPlaying: boolean;
  /** Last non-zero volume intent 0..1 (the unmute / slider value). */
  volume: number;
  muted: boolean;
  drawerOpen: boolean;
  activeIndex: number;
  /** Last watched position per playlist index — restored on re-select. */
  positionByIndex: Record<number, number>;
  /** 360 mode: video on the inward-facing sphere, chrome faded out. */
  immersive: boolean;
  scrubbing: boolean;
  scrubFrac: number;
  volDragging: boolean;
  volSliderOpen: boolean;
}
const initialPanel: MuxPanelState = {
  textureId: null,
  positionSec: 0,
  durationSec: 0,
  bufferedSec: 0,
  isPlaying: false,
  volume: 1,
  muted: false,
  drawerOpen: false,
  activeIndex: 0,
  positionByIndex: {},
  immersive: false,
  scrubbing: false,
  scrubFrac: 0,
  volDragging: false,
  volSliderOpen: false,
};
interface MuxPanelsStore {
  panels: Record<string, MuxPanelState>;
  patch: (id: string, partial: Partial<MuxPanelState>) => void;
}
export const useMuxPanelStore = create<MuxPanelsStore>((set) => ({
  panels: {},
  patch: (id, partial) =>
    set((s) => ({ panels: { ...s.panels, [id]: { ...(s.panels[id] ?? initialPanel), ...partial } } })),
}));
export function getMuxPanelState(id: string): MuxPanelState {
  return useMuxPanelStore.getState().panels[id] ?? initialPanel;
}
function patchPanel(id: string, partial: Partial<MuxPanelState>): void {
  useMuxPanelStore.getState().patch(id, partial);
}

// ── Materials — registered during render, #AARRGGBB, ≥ #2A2A32-ish fills ───
const M = {
  track: "vxg_mux_track",
  buffered: "vxg_mux_buffered",
  fill: "vxg_mux_fill",
  hitStrip: "vxg_mux_hitstrip",
  drawer: "vxg_mux_drawer",
  row: "vxg_mux_row",
  rowHover: "vxg_mux_row_hover",
} as const;
let materialsRegistered = false;
function registerMuxPanelMaterials(): void {
  if (materialsRegistered) return;
  materialsRegistered = true;
  ViroMaterials.createMaterials({
    [M.track]: { diffuseColor: "#FF3A3F4E", lightingModel: "Constant" },
    // Buffered range — slightly lighter than the idle track.
    [M.buffered]: { diffuseColor: "#FF4C5266", lightingModel: "Constant" },
    // Progress — MRTK-blue family.
    [M.fill]: { diffuseColor: "#FF8896C8", lightingModel: "Constant" },
    // Click-to-seek strips: additive-black renders (stays hit-testable, not
    // opacity-0-culled) but adds nothing → truly invisible, no faint box.
    // writesToDepthBuffer:false — invisible hit surfaces must never carve
    // depth holes over content behind them (phantom-box bug).
    [M.hitStrip]: { diffuseColor: "#FF000000", lightingModel: "Constant", blendMode: "Add", writesToDepthBuffer: false },
    // Light drawer — thumbnails read against near-white, not dark chrome.
    [M.drawer]: { diffuseColor: "#F6EDEFF4", lightingModel: "Constant" },
    [M.row]: { diffuseColor: "#14202430", lightingModel: "Constant" },
    [M.rowHover]: { diffuseColor: "#3843506A", lightingModel: "Constant" },
  });
}

// ── Animations (global names; per-panel drawer anims are registered inline) ─
let animsRegistered = false;
function registerMuxPanelAnims(): void {
  if (animsRegistered) return;
  animsRegistered = true;
  ViroAnimations.registerAnimations({
    // Scrubber thumb hover/drag feedback.
    vxgMuxThumbGrow: { properties: { scaleX: 1.4, scaleY: 1.4, scaleZ: 1.4 }, duration: 120, easing: "EaseOut" },
    vxgMuxThumbShrink: { properties: { scaleX: 1.0, scaleY: 1.0, scaleZ: 1.0 }, duration: 140, easing: "EaseOut" },
    // Volume slider expand/collapse (anchored at its right edge — children
    // are offset -w/2, so scaleX grows leftward out of the icon).
    vxgMuxVolOpen: { properties: { scaleX: 1, opacity: 1 }, duration: 260, easing: "EaseInEaseOut" },
    vxgMuxVolClose: { properties: { scaleX: 1, opacity: 1 }, duration: 260, easing: "EaseInEaseOut" },
    // Drawer entry stagger (delay applied per-row at the call site). Out
    // floor is 0.15, not 0 — prop/animated opacity 0 hit-culls AND skips
    // texture hydration on this fork (thumbnails never appear).
    vxgMuxEntryIn: { properties: { opacity: 1 }, duration: 220, easing: "EaseOut" },
    vxgMuxEntryOut: { properties: { opacity: 0.15 }, duration: 140, easing: "EaseIn" },
    // 360 immersive transition — chrome and sphere cross-fade (opacity 0
    // also hit-test-culls the hidden side, deliberately).
    vxgMuxFadeOut300: { properties: { opacity: 0 }, duration: 300, easing: "EaseInEaseOut" },
    vxgMuxFadeIn300: { properties: { opacity: 1 }, duration: 300, easing: "EaseInEaseOut" },
    vxgMuxFadeIn220: { properties: { opacity: 1 }, duration: 220, easing: "EaseInEaseOut" },
    vxgMuxFadeOut320: { properties: { opacity: 0 }, duration: 320, easing: "EaseInEaseOut" },
  });
}

// Gizmo drag: reported to JS, node NOT moved, no bubbling to the dock root.
const GIZMO = "Gizmo" as never;
const noopDrag = () => {};
const SEEK_SEGMENTS = 16;

// Radial layering off the chrome backplate (dz, meters toward the viewer).
// Mirrors the flat z-stack; every stacked pair keeps ≥ 2mm separation.
const DZ = { strip: 0.002, ctrl: 0.004, track: 0.004, buffered: 0.006, fill: 0.008, thumb: 0.011, vol: 0.006 } as const;

function formatTime(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

type Pose = { position: Vec3; rotation?: Vec3 };

/** Icon button with hover reporting (volume cluster needs it). */
function BarIconButton(props: {
  icon: LucideIconName;
  size: number;
  pose: Pose;
  onClick: () => void;
  onHover?: (hovered: boolean) => void;
}): React.ReactElement {
  const [hovered, setHovered] = React.useState(false);
  return (
    <ViroNode position={props.pose.position} rotation={props.pose.rotation} dragType={GIZMO} onDrag={noopDrag}>
      <ViroQuad
        width={props.size}
        height={props.size}
        materials={[hovered ? FluentMaterials.iconHover : FluentMaterials.iconIdle]}
        onHover={(h: boolean) => {
          setHovered(h);
          props.onHover?.(h);
        }}
        onClick={props.onClick}
      />
      <LucideIcon name={props.icon} size={props.size * 0.66} position={[0, 0, 0.002]} />
    </ViroNode>
  );
}

export function MuxPlayerPanel(props: MuxPlayerPanelProps): React.ReactElement {
  const {
    title = "Video",
    titleFontFamily,
    timeFontFamily,
    playlist,
    playbackId,
    url,
    tokens,
    width = 1.2,
    height = 0.675,
    curvature = 0,
    loop = true,
    muted = false,
    defaultPinned = true,
    onClose,
    position,
    scale,
    rotation,
    onReady,
    onError,
    movable,
    tag,
    persistKey,
    dragType,
    dragPlane,
    axisLock,
    onMoveStart,
    onMove,
    onMoveEnd,
    pinchToScale,
    ...surfaceRest
  } = props;

  registerFluentMaterials();
  registerMuxPanelMaterials();
  registerHeaderAnims();
  registerMuxPanelAnims();

  // STABLE store key — state survives unmount/remount (persistence contract).
  const panelId = persistKey ?? tag ?? "vxg-mux-panel";
  const animKey = useMemo(() => panelId.replace(/[^A-Za-z0-9_]/g, "_"), [panelId]);
  const panel = useMuxPanelStore((s) => s.panels[panelId] ?? initialPanel);
  const [pinned, setPinned] = React.useState(defaultPinned);
  const [closed, setClosed] = React.useState(false);

  // The video material is owned HERE (not auto-generated inside the surface)
  // so the 360 sphere can share the SAME live external-texture material —
  // Viro materials are name-addressable across geometries.
  const videoMaterial = useMemo(() => {
    const name = `vxgMuxPanel_${animKey}`;
    createPlaceholderMaterial(name);
    return name;
  }, [animKey]);

  // ── Layout ────────────────────────────────────────────────────────────
  const chromeW = width + 0.02;
  const headerH = Math.max(0.06, height * 0.1);
  const headerY = height / 2 + headerH / 2 + 0.02;

  const ctrlH = Math.max(0.09, height * 0.14);
  const ctrlY = -height / 2 - ctrlH / 2 - 0.02;
  const pad = 0.025;
  const btn = ctrlH * 0.7;
  const timeW = 0.1;
  const volIcon = ctrlH * 0.62;
  const volW = 0.16;
  const playX = -chromeW / 2 + pad + btn / 2;
  const curX = playX + btn / 2 + 0.008 + timeW / 2;
  const volIconX = chromeW / 2 - pad - volIcon / 2;
  const volRightX = volIconX - volIcon / 2 - 0.012; // slider right-edge anchor
  const durX = volRightX - volW - 0.012 - timeW / 2;
  const trackLeft = curX + timeW / 2 + 0.014;
  const trackRight = durX - timeW / 2 - 0.014;
  const trackW = trackRight - trackLeft;
  const thumbSize = ctrlH * 0.3;

  // Concentric-arc frame (null → flat layout). Chrome 8mm proud of the video.
  const arcF: ArcFrame | null = useMemo(() => makeArcFrame(width, curvature, 0.008), [width, curvature]);

  // Unified placement: flat [x, y, dz] vs arc polar pose (axis-local; the
  // cluster wrapper node sits at [0, rowY, axisZ]).
  const pose = useCallback(
    (x: number, dz: number, y = 0): Pose =>
      arcF ? polarPose(arcF, x, dz, y) : { position: [x, y, dz] },
    [arcF]
  );

  const ctrlPlate = useMemo(
    () =>
      arcF
        ? arcPlateBuffers(arcF, -chromeW / 2, chromeW / 2, ctrlH, 0)
        : roundedPlateBuffers(chromeW, ctrlH, ctrlH * 0.3),
    [arcF, chromeW, ctrlH]
  );

  const entries = playlist ?? [];
  const drawerW = Math.max(0.44, width * 0.36);
  const entryH = 0.13;
  const drawerH = Math.max(entryH * entries.length + 0.04, entryH + 0.04);
  // Closed: tucked over the video's left region (opacity 0 → invisible AND
  // hit-test-culled); open: fully clear of the panel's left edge. The node
  // stays MOUNTED — flat: positionX+opacity animate; arc: the drawer hangs
  // off a pivot at the cylinder AXIS and rotateY+opacity animate, so it
  // swings along the same concentric arc.
  const drawerClosedX = -width / 2 + drawerW / 2 - 0.06;
  const drawerOpenX = -width / 2 - drawerW / 2 - 0.05;
  const drawerY = height / 2 - drawerH / 2;

  // Arc drawer pivot angles. Content is built centered at φ=0 (axis-local);
  // pivot rotateY ρ shows content at world angle −ρ (right-handed +Y), so
  // ρ = −θ_target. θ measured at the chrome radius, matching the bars.
  const arcDrawer = useMemo(() => {
    if (!arcF) return null;
    const Rc = arcF.chromeRadius;
    const thetaD = drawerW / Rc;
    const thetaLeftEdge = -arcF.arcAngle / 2;
    const thetaOpen = thetaLeftEdge - 0.05 / Rc - thetaD / 2;
    const thetaClosed = thetaLeftEdge + thetaD / 2 - 0.06 / Rc;
    return {
      openDeg: (-thetaOpen * 180) / Math.PI,
      closedDeg: (-thetaClosed * 180) / Math.PI,
    };
  }, [arcF, drawerW]);

  // Per-panel drawer open/close (targets are computed → names are scoped).
  const drawerAnims = useMemo(() => {
    const open = `vxgMuxDrawerOpen_${animKey}`;
    const close = `vxgMuxDrawerClose_${animKey}`;
    // Close floor is 0.01, not 0 — opacity-0 props hit-cull the rows forever
    // and skip thumbnail texture hydration on this fork (drawer looked fine
    // but was unclickable, 2026-07-05). Open leads with a fast EaseOut.
    if (arcDrawer) {
      ViroAnimations.registerAnimations({
        [open]: { properties: { rotateY: arcDrawer.openDeg, opacity: 1 }, duration: 300, easing: "EaseOut" },
        [close]: { properties: { rotateY: arcDrawer.closedDeg, opacity: 0.01 }, duration: 200, easing: "EaseIn" },
      });
    } else {
      ViroAnimations.registerAnimations({
        [open]: { properties: { positionX: drawerOpenX, opacity: 1 }, duration: 300, easing: "EaseOut" },
        [close]: { properties: { positionX: drawerClosedX, opacity: 0.01 }, duration: 200, easing: "EaseIn" },
      });
    }
    return { open, close };
  }, [animKey, arcDrawer, drawerOpenX, drawerClosedX]);

  // ── Transport ─────────────────────────────────────────────────────────
  const activeUrl = useMemo(() => {
    if (entries.length > 0)
      return buildHlsUrl(entries[Math.min(panel.activeIndex, entries.length - 1)]!.playbackId, tokens);
    if (url) return url;
    if (playbackId) return buildHlsUrl(playbackId, tokens);
    return null;
  }, [entries, panel.activeIndex, url, playbackId, tokens]);
  const initialUrl = useRef(activeUrl); // the surface owns the FIRST load only

  const wasPlayingRef = useRef<boolean | null>(null);
  const wasMutedRef = useRef<boolean | null>(null);

  // Mount/unmount lifecycle: clear the STALE texture id from a previous bind
  // (the store persists; the texture does not), and on unmount pause the
  // player but KEEP the store — that's the whole point of the persistence.
  useEffect(() => {
    patchPanel(panelId, { textureId: null, scrubbing: false, volDragging: false, drawerOpen: false });
    return () => {
      const s = getMuxPanelState(panelId);
      if (s.textureId != null) {
        try {
          getPlayer().pause(s.textureId);
        } catch {
          // native module missing / surface already stopped — position is in the store
        }
      }
      // NO store reset here — state must survive for the next mount.
    };
  }, [panelId]);

  // Poll native status ~500ms while the surface is live (skipped mid-scrub /
  // mid-volume-drag so controls don't fight the hand).
  useEffect(() => {
    const textureId = panel.textureId;
    if (textureId == null) return;
    if (typeof getPlayer().getStatus !== "function") {
      console.log(`[VXMUX] panel ${panelId}: native transport API missing — rebuild + install the APK`);
      return;
    }
    const iv = setInterval(() => {
      const s = getMuxPanelState(panelId);
      if (s.scrubbing) return;
      getPlayer()
        .getStatus(textureId)
        .then((st) => {
          if (wasPlayingRef.current !== st.isPlaying) {
            wasPlayingRef.current = st.isPlaying;
            console.log(`[VXMUX] panel ${panelId}: isPlaying → ${st.isPlaying}`);
          }
          const next: Partial<MuxPanelState> = {
            positionSec: st.positionSec,
            durationSec: st.durationSec,
            bufferedSec: st.bufferedSec ?? 0,
            isPlaying: st.isPlaying,
          };
          const cur = getMuxPanelState(panelId);
          if (!cur.volDragging && typeof st.volume === "number") {
            if (st.volume > 0) {
              next.volume = st.volume;
              next.muted = false;
            } else {
              next.muted = true;
            }
            if (wasMutedRef.current !== next.muted && next.muted !== undefined) {
              wasMutedRef.current = next.muted;
              console.log(`[VXMUX] panel ${panelId}: muted → ${next.muted}`);
            }
          }
          patchPanel(panelId, next);
        })
        .catch(() => {}); // player not created yet — next tick
    }, 500);
    return () => clearInterval(iv);
  }, [panel.textureId, panelId]);

  // Rebind resume: once the texture binds and playback is requested (surface
  // onReady), seek back to the persisted position (>2s, per-entry) and
  // restore volume/mute.
  const handleReady = useCallback(() => {
    const s = getMuxPanelState(panelId);
    const id = s.textureId;
    if (id != null) {
      const resume = s.positionByIndex[s.activeIndex] ?? s.positionSec;
      if (resume > 2 && typeof getPlayer().seekTo === "function") {
        getPlayer().seekTo(id, resume);
        console.log(`[VXMUX] resume at ${resume.toFixed(1)}s`);
      }
      if (typeof getPlayer().setVolume === "function" && (s.muted || s.volume < 1)) {
        getPlayer().setVolume(id, s.muted ? 0 : s.volume);
      }
    }
    onReady?.();
  }, [panelId, onReady]);

  const togglePlay = useCallback(() => {
    const s = getMuxPanelState(panelId);
    if (s.textureId == null) return;
    console.log(`[VXMUX] panel ${panelId}: ${s.isPlaying ? "pause" : "resume"}`);
    if (s.isPlaying) getPlayer().pause(s.textureId);
    else if (typeof getPlayer().resume === "function") getPlayer().resume(s.textureId);
    else if (activeUrl) getPlayer().play(s.textureId, activeUrl, loop, muted); // old-APK fallback
    patchPanel(panelId, { isPlaying: !s.isPlaying }); // optimistic; poll corrects
  }, [panelId, activeUrl, loop, muted]);

  const selectEntry = useCallback(
    (index: number) => {
      const s = getMuxPanelState(panelId);
      const entry = entries[index];
      if (!entry || !s.drawerOpen) return;
      if (s.textureId == null) {
        console.log(`[VXMUX] panel ${panelId}: select ignored — texture not bound yet`);
        return;
      }
      const nextUrl = buildHlsUrl(entry.playbackId, tokens);
      console.log(`[VXMUX] panel ${panelId}: playlist → "${entry.title}" (${entry.playbackId})`);
      getPlayer().play(s.textureId, nextUrl, loop, muted);
      // Remember where the OUTGOING entry was; restore the incoming one.
      const positionByIndex = { ...s.positionByIndex, [s.activeIndex]: s.positionSec };
      const resume = positionByIndex[index] ?? 0;
      if (resume > 2 && typeof getPlayer().seekTo === "function") {
        getPlayer().seekTo(s.textureId, resume);
        console.log(`[VXMUX] resume at ${resume.toFixed(1)}s`);
      }
      const immersive = entry.projection === "360";
      if (immersive !== s.immersive) console.log(`[VXMUX] mode → ${immersive ? "immersive" : "panel"}`);
      patchPanel(panelId, {
        activeIndex: index,
        drawerOpen: false,
        isPlaying: true,
        positionSec: resume,
        positionByIndex,
        immersive,
      });
    },
    [panelId, entries, tokens, loop, muted]
  );

  const toggleDrawer = useCallback(() => {
    const open = !getMuxPanelState(panelId).drawerOpen;
    console.log(`[VXMUX] panel ${panelId}: drawer ${open ? "open" : "close"}`);
    patchPanel(panelId, { drawerOpen: open });
  }, [panelId]);

  // ── 360 immersive mode ────────────────────────────────────────────────
  // Playback continues on the SAME texture/material — no reload on toggle.
  const setImmersive = useCallback(
    (immersive: boolean) => {
      if (getMuxPanelState(panelId).immersive === immersive) return;
      console.log(`[VXMUX] mode → ${immersive ? "immersive" : "panel"}`);
      patchPanel(panelId, { immersive, drawerOpen: false });
    },
    [panelId]
  );
  const toggleImmersive = useCallback(() => {
    setImmersive(!getMuxPanelState(panelId).immersive);
  }, [panelId, setImmersive]);

  // Exit choreography: 'cover' fades the black sphere in, then the video
  // sphere stops rendering and the panel returns, then the cover lifts.
  const [exitPhase, setExitPhase] = React.useState<"idle" | "cover" | "lift">("idle");
  const exitSmooth = React.useCallback(() => {
    setExitPhase("cover");
    setTimeout(() => {
      setImmersive(false);
      setExitPhase("lift");
      setTimeout(() => setExitPhase("idle"), 360);
    }, 240);
  }, [setImmersive]);

  // Keep the sphere mounted through its 300ms fade-out.
  const [sphereLinger, setSphereLinger] = React.useState(panel.immersive);
  useEffect(() => {
    if (panel.immersive) {
      setSphereLinger(true);
      return;
    }
    const t = setTimeout(() => setSphereLinger(false), 350);
    return () => clearTimeout(t);
  }, [panel.immersive]);
  const sphereMounted = panel.immersive || sphereLinger;

  // ── Seek (Gizmo drag deltas → track fraction; 250ms-throttled live seek) ─
  const lastDrag = useRef<[number, number, number] | null>(null);
  const lastSeekSent = useRef(0);
  const commitSeek = useCallback(
    (frac: number, final: boolean) => {
      const s = getMuxPanelState(panelId);
      if (s.textureId == null || s.durationSec <= 0) return;
      if (typeof getPlayer().seekTo !== "function") return; // old-APK: no seek
      const now = Date.now();
      if (!final && now - lastSeekSent.current < 250) return;
      lastSeekSent.current = now;
      getPlayer().seekTo(s.textureId, frac * s.durationSec);
      if (final) console.log(`[VXMUX] panel ${panelId}: seek → ${(frac * s.durationSec).toFixed(1)}s`);
    },
    [panelId]
  );

  // ── Volume ────────────────────────────────────────────────────────────
  const volCloseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const volHover = useCallback(
    (hovered: boolean) => {
      if (volCloseTimer.current) {
        clearTimeout(volCloseTimer.current);
        volCloseTimer.current = null;
      }
      if (hovered) {
        if (!getMuxPanelState(panelId).volSliderOpen) patchPanel(panelId, { volSliderOpen: true });
        return;
      }
      volCloseTimer.current = setTimeout(() => {
        patchPanel(panelId, { volSliderOpen: false });
      }, 900);
    },
    [panelId]
  );
  useEffect(
    () => () => {
      if (volCloseTimer.current) clearTimeout(volCloseTimer.current);
    },
    []
  );

  const applyVolume = useCallback(
    (v: number) => {
      const s = getMuxPanelState(panelId);
      if (s.textureId == null || typeof getPlayer().setVolume !== "function") return;
      getPlayer().setVolume(s.textureId, v);
    },
    [panelId]
  );

  const toggleMute = useCallback(() => {
    const s = getMuxPanelState(panelId);
    if (s.textureId == null) return;
    if (typeof getPlayer().setVolume !== "function") {
      console.log(`[VXMUX] panel ${panelId}: setVolume missing — rebuild + install the APK for mute/volume`);
      return;
    }
    if (s.muted) {
      getPlayer().setVolume(s.textureId, s.volume > 0 ? s.volume : -1); // -1 = native last-non-zero restore
      console.log(`[VXMUX] panel ${panelId}: unmute → ${s.volume > 0 ? s.volume.toFixed(2) : "native-last"}`);
      patchPanel(panelId, { muted: false });
    } else {
      getPlayer().setVolume(s.textureId, 0);
      console.log(`[VXMUX] panel ${panelId}: mute`);
      patchPanel(panelId, { muted: true });
    }
  }, [panelId]);

  const lastVolDrag = useRef<[number, number, number] | null>(null);
  const lastVolSent = useRef(0);

  // ── Derived render state ──────────────────────────────────────────────
  const playedFrac = panel.scrubbing
    ? panel.scrubFrac
    : panel.durationSec > 0
      ? Math.min(1, panel.positionSec / panel.durationSec)
      : 0;
  const bufferedFrac = panel.durationSec > 0 ? Math.min(1, panel.bufferedSec / panel.durationSec) : 0;
  const thumbAbsX = trackLeft + playedFrac * trackW;
  const volFrac = panel.muted ? 0 : panel.volume;
  const shownSec = panel.scrubbing ? playedFrac * panel.durationSec : panel.positionSec;
  const [thumbHot, setThumbHot] = React.useState(false);

  // Dynamic scrubber fills. Arc: thin concentric arc plates rebuilt when the
  // fraction moves (2×N verts — trivial); flat: quads.
  const trackPlate = useMemo(
    () => (arcF ? arcPlateBuffers(arcF, trackLeft, trackRight, 0.012, DZ.track) : null),
    [arcF, trackLeft, trackRight]
  );
  const bufferedPlate = useMemo(
    () =>
      arcF && bufferedFrac > 0
        ? arcPlateBuffers(arcF, trackLeft, trackLeft + Math.max(0.001, bufferedFrac * trackW), 0.012, DZ.buffered)
        : null,
    [arcF, trackLeft, trackW, bufferedFrac]
  );
  const playedPlate = useMemo(
    () =>
      arcF && playedFrac > 0
        ? arcPlateBuffers(arcF, trackLeft, trackLeft + Math.max(0.001, playedFrac * trackW), 0.012, DZ.fill)
        : null,
    [arcF, trackLeft, trackW, playedFrac]
  );
  const drawerPlate = useMemo(
    () => (arcF ? arcPlateBuffers(arcF, -drawerW / 2, drawerW / 2, drawerH, 0) : null),
    [arcF, drawerW, drawerH]
  );
  const rowPlate = useMemo(
    () => (arcF ? arcPlateBuffers(arcF, -(drawerW - 0.02) / 2, (drawerW - 0.02) / 2, entryH - 0.012, 0.004) : null),
    [arcF, drawerW, entryH]
  );
  const pillPlate = useMemo(() => roundedPlateBuffers(0.36, 0.1, 0.05), []);

  if (closed) return <ViroNode />;

  const seekStrips = Array.from({ length: SEEK_SEGMENTS }, (_, i) => {
    const stripPose = pose(trackLeft + (trackW / SEEK_SEGMENTS) * (i + 0.5), DZ.strip);
    return (
      <ViroNode key={i} position={stripPose.position} rotation={stripPose.rotation}>
        <ViroQuad
          width={trackW / SEEK_SEGMENTS}
          height={ctrlH * 0.5}
          materials={[M.hitStrip]}
          opacity={0.15}
          dragType={GIZMO}
          onDrag={noopDrag}
          onClick={() => {
            const frac = (i + 0.5) / SEEK_SEGMENTS;
            console.log(`[VXMUX] panel ${panelId}: track click → ${(frac * 100).toFixed(0)}%`);
            commitSeek(frac, true);
            patchPanel(panelId, {
              positionSec: frac * getMuxPanelState(panelId).durationSec,
            });
          }}
        />
      </ViroNode>
    );
  });

  const thumbPose = pose(thumbAbsX, DZ.thumb);
  const curTimePose = pose(curX, DZ.ctrl);
  const durPose = pose(durX, DZ.ctrl);
  const volClusterPose = pose(volRightX, DZ.vol);

  // Drawer row content (shared by flat and arc drawers). In arc mode the
  // rows live under the axis pivot, so children use polar poses at their
  // flat drawer-local x; thumbnails/text ride 9mm proud of the row plate
  // (flat-chord sagitta ≤3mm on a 0.2m box at r≈1.65 → ≥2mm clearance).
  const drawerRows = entries.map((entry, i) => {
    const rowY = drawerH / 2 - 0.02 - entryH / 2 - i * entryH;
    const active = i === panel.activeIndex;
    const thumbPoseRow = arcF ? polarPose(arcF, -drawerW / 2 + 0.1, 0.009) : { position: [-drawerW / 2 + 0.1, 0, 0.003] as Vec3, rotation: undefined };
    const textPoseRow = arcF ? polarPose(arcF, 0.1, 0.009) : { position: [0.1, 0, 0.003] as Vec3, rotation: undefined };
    return (
      <ViroNode
        key={`${entry.playbackId}-${i}`}
        position={[0, rowY, arcF ? 0 : 0.004]}
        opacity={0.15}
        animation={{
          name: panel.drawerOpen ? "vxgMuxEntryIn" : "vxgMuxEntryOut",
          run: true,
          loop: false,
          delay: panel.drawerOpen ? 60 + i * 50 : 0,
        }}
        dragType={GIZMO}
        onDrag={noopDrag}
        onClick={() => selectEntry(i)}
      >
        {arcF && rowPlate ? (
          <>
            <ViroGeometry
              vertices={rowPlate.vertices}
              normals={rowPlate.normals}
              texcoords={rowPlate.texcoords}
              triangleIndices={rowPlate.triangleIndices}
              materials={[active ? M.rowHover : M.row]}
            />
            {/* Curved row plates are custom ViroGeometry — controller rays miss
                them. Flat additive-black strip catches the click (the seek
                bar's proven hitStrip pattern) — invisible, rides proud of the
                thumbnail/text at 14mm. */}
            <ViroNode {...polarPose(arcF, 0, 0.014)}>
              <ViroQuad
                width={drawerW - 0.02}
                height={entryH - 0.012}
                materials={[M.hitStrip]}
                opacity={0.15}
                dragType={GIZMO}
                onDrag={noopDrag}
                onClick={() => selectEntry(i)}
              />
            </ViroNode>
          </>
        ) : (
          <ViroQuad width={drawerW - 0.02} height={entryH - 0.012} materials={[active ? M.rowHover : M.row]} />
        )}
        <ViroNode position={thumbPoseRow.position} rotation={thumbPoseRow.rotation}>
          <ViroImage
            source={{ uri: `https://image.mux.com/${entry.playbackId}/thumbnail.png?width=256` }}
            width={0.17}
            height={0.0956}
            ignoreEventHandling
          />
        </ViroNode>
        <ViroNode position={textPoseRow.position} rotation={textPoseRow.rotation}>
          <Text3D
            text={entry.title}
            color="#22242C"
            width={drawerW - 0.24}
            height={entryH * 0.6}
            textAlign="left"
            fillRatio={0.95}
          />
        </ViroNode>
      </ViroNode>
    );
  });

  return (
    <MovableNode
      movable={movable}
      tag={tag ?? "vxg-mux-panel"}
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
      <ViroNode rotation={rotation} transformBehaviors={pinned ? undefined : ["billboardY"]}>
        {/* ── Panel + chrome (fades out in 360 mode; opacity 0 also hit-culls).
            visible gates RENDERING while the sphere holds the shared material —
            exactly one geometry renders the external texture at any time
            (double-render during the exit fade crashed VROTexture::getSubstrate). ── */}
        <ViroNode
          visible={!sphereMounted}
          animation={{ name: panel.immersive ? "vxgMuxFadeOut300" : "vxgMuxFadeIn300", run: true, loop: false }}
        >
          {/* Playlist drawer — ALWAYS mounted. Flat: positionX+opacity animate.
              Arc: hangs off a pivot at the cylinder axis; rotateY+opacity swing
              it along the concentric arc (a continuation of the video's curve). */}
          {entries.length > 0 &&
            (arcF && arcDrawer && drawerPlate ? (
              <ViroNode
                position={[0, drawerY, arcF.axisZ]}
                rotation={[0, arcDrawer.closedDeg, 0]}
                opacity={0.01}
                animation={{
                  name: panel.drawerOpen ? drawerAnims.open : drawerAnims.close,
                  run: true,
                  loop: false,
                }}
              >
                <ViroGeometry
                  vertices={drawerPlate.vertices}
                  normals={drawerPlate.normals}
                  texcoords={drawerPlate.texcoords}
                  triangleIndices={drawerPlate.triangleIndices}
                  materials={[M.drawer]}
                  dragType={GIZMO}
                  onDrag={noopDrag}
                />
                {drawerRows}
              </ViroNode>
            ) : (
              <ViroNode
                position={[drawerClosedX, drawerY, -0.02]}
                opacity={0.01}
                animation={{
                  name: panel.drawerOpen ? drawerAnims.open : drawerAnims.close,
                  run: true,
                  loop: false,
                }}
              >
                <ViroQuad width={drawerW} height={drawerH} materials={[M.drawer]} dragType={GIZMO} onDrag={noopDrag} />
                {drawerRows}
              </ViroNode>
            ))}

          {/* Video — grabbing the picture drags the whole dock (bubbles to root). */}
          <ViroMuxBridgeSurface
            {...surfaceRest}
            materialName={videoMaterial}
            url={initialUrl.current ?? undefined}
            width={width}
            height={height}
            curvature={curvature}
            loop={loop}
            muted={muted}
            onReady={handleReady}
            onError={onError}
            onTextureId={(id) => {
              console.log(`[VXMUX] panel ${panelId}: textureId=${id}`);
              patchPanel(panelId, { textureId: id });
            }}
          />

          {/* Header — the SAME chrome as slate/cylinder; hamburger + 360 globe
              slotted in. Curved concentrically when the video is curved. */}
          <PanelHeader3D
            width={chromeW}
            barHeight={headerH}
            title={title}
            titleFontFamily={titleFontFamily}
            pinned={pinned}
            onTogglePin={() => setPinned((p) => !p)}
            onClose={() => {
              setClosed(true);
              onClose?.();
            }}
            position={[0, headerY, arcF ? 0 : 0.005]}
            arc={arcF ?? undefined}
            leftAccessory={
              <>
                {entries.length > 0 && (
                  <TitleBarButton icon="menu" size={headerH * 0.8} position={[0, 0, 0]} onClick={toggleDrawer} />
                )}
                {/* Globe ONLY for real 360 content — 2D videos never wrap the user. */}
                {entries[panel.activeIndex]?.projection === "360" && (
                  <TitleBarButton
                    icon="globe"
                    size={headerH * 0.8}
                    position={[entries.length > 0 ? headerH * 0.8 * 1.15 : 0, 0, 0]}
                    onClick={toggleImmersive}
                  />
                )}
              </>
            }
            leftAccessoryWidth={headerH * 0.8 * (entries.length > 0 ? 2.45 : 1.4)}
          />

          {/* Control bar — full-width plate under the video (arc: concentric). */}
          <ViroNode position={[0, ctrlY, arcF ? arcF.axisZ : 0.012]}>
            <ViroGeometry
              vertices={ctrlPlate.vertices}
              normals={ctrlPlate.normals}
              texcoords={ctrlPlate.texcoords}
              triangleIndices={ctrlPlate.triangleIndices}
              materials={[FluentMaterials.slateTitleBar]}
              dragType={GIZMO}
              onDrag={noopDrag}
            />

            {/* Play / pause. */}
            <BarIconButton
              icon={panel.isPlaying ? "pause" : "play"}
              size={btn}
              pose={pose(playX, DZ.ctrl)}
              onClick={togglePlay}
            />

            {/* Current time. */}
            <ViroNode position={curTimePose.position} rotation={curTimePose.rotation}>
              <Text3D
                text={formatTime(shownSec)}
                fontFamily={timeFontFamily}
                color="#C8C8D4"
                width={timeW}
                height={ctrlH * 0.5}
                fillRatio={0.85}
              />
            </ViroNode>

            {/* Scrubber: hit strips → track → buffered → progress → thumb.
                Radial layering (DZ) keeps ≥2mm between every stacked pair. */}
            {seekStrips}
            {arcF && trackPlate ? (
              <ViroGeometry
                vertices={trackPlate.vertices}
                normals={trackPlate.normals}
                texcoords={trackPlate.texcoords}
                triangleIndices={trackPlate.triangleIndices}
                materials={[M.track]}
                ignoreEventHandling
              />
            ) : (
              <ViroQuad
                width={trackW}
                height={0.012}
                materials={[M.track]}
                position={[(trackLeft + trackRight) / 2, 0, DZ.track]}
                ignoreEventHandling
              />
            )}
            {arcF ? (
              bufferedPlate && (
                <ViroGeometry
                  vertices={bufferedPlate.vertices}
                  normals={bufferedPlate.normals}
                  texcoords={bufferedPlate.texcoords}
                  triangleIndices={bufferedPlate.triangleIndices}
                  materials={[M.buffered]}
                  ignoreEventHandling
                />
              )
            ) : (
              <ViroQuad
                width={Math.max(0.001, bufferedFrac * trackW)}
                height={0.012}
                materials={[M.buffered]}
                position={[trackLeft + (bufferedFrac * trackW) / 2, 0, DZ.buffered]}
                ignoreEventHandling
              />
            )}
            {arcF ? (
              playedPlate && (
                <ViroGeometry
                  vertices={playedPlate.vertices}
                  normals={playedPlate.normals}
                  texcoords={playedPlate.texcoords}
                  triangleIndices={playedPlate.triangleIndices}
                  materials={[M.fill]}
                  ignoreEventHandling
                />
              )
            ) : (
              <ViroQuad
                width={Math.max(0.001, playedFrac * trackW)}
                height={0.012}
                materials={[M.fill]}
                position={[trackLeft + (playedFrac * trackW) / 2, 0, DZ.fill]}
                ignoreEventHandling
              />
            )}
            {/* Thumb — round, grows 1.4× on hover/drag, Gizmo-drag scrubs. */}
            <ViroNode
              position={thumbPose.position}
              rotation={thumbPose.rotation}
              dragType={GIZMO}
              onDrag={(pos: number[]) => {
                const p = pos as [number, number, number];
                if (!lastDrag.current) {
                  lastDrag.current = p;
                  patchPanel(panelId, { scrubbing: true, scrubFrac: playedFrac });
                  return;
                }
                const dx = p[0] - lastDrag.current[0];
                lastDrag.current = p;
                const s = getMuxPanelState(panelId);
                const frac = Math.min(1, Math.max(0, s.scrubFrac + dx / trackW));
                patchPanel(panelId, { scrubFrac: frac });
                commitSeek(frac, false);
              }}
              onClickState={(state: number) => {
                if (state === 2 && lastDrag.current) {
                  lastDrag.current = null;
                  const frac = getMuxPanelState(panelId).scrubFrac;
                  commitSeek(frac, true);
                  patchPanel(panelId, { scrubbing: false });
                }
              }}
            >
              <ViroNode
                animation={{
                  name: thumbHot || panel.scrubbing ? "vxgMuxThumbGrow" : "vxgMuxThumbShrink",
                  run: true,
                  loop: false,
                }}
              >
                <ThumbDot size={thumbSize} onHover={setThumbHot} />
              </ViroNode>
            </ViroNode>

            {/* Duration. */}
            <ViroNode position={durPose.position} rotation={durPose.rotation}>
              <Text3D
                text={formatTime(panel.durationSec)}
                fontFamily={timeFontFamily}
                color="#C8C8D4"
                width={timeW}
                height={ctrlH * 0.5}
                fillRatio={0.85}
              />
            </ViroNode>

            {/* Volume cluster: hover-expanding slider + mute toggle. Arc-posed
                at its right anchor, 6mm proud — the 0.16m flat slider's chord
                sagitta (~1.9mm) keeps ≥4mm clearance over the plate. */}
            <ViroNode
              position={volClusterPose.position}
              rotation={volClusterPose.rotation}
              scale={[0.15, 1, 1]}
              opacity={0.15}
              animation={{
                name: panel.volSliderOpen ? "vxgMuxVolOpen" : "vxgMuxVolClose",
                run: true,
                loop: false,
              }}
            >
              {/* Children offset −w/2 so scaleX expands leftward from the icon. */}
              <ViroNode position={[-volW / 2, 0, 0]} onHover={volHover}>
                <ViroQuad width={volW} height={0.01} materials={[M.track]} dragType={GIZMO} onDrag={noopDrag} />
                <ViroQuad
                  width={Math.max(0.001, volFrac * volW)}
                  height={0.01}
                  materials={[M.fill]}
                  position={[-volW / 2 + (volFrac * volW) / 2, 0, 0.002]}
                  ignoreEventHandling
                />
                <ViroNode
                  position={[-volW / 2 + volFrac * volW, 0, 0.004]}
                  dragType={GIZMO}
                  onDrag={(pos: number[]) => {
                    const p = pos as [number, number, number];
                    const s = getMuxPanelState(panelId);
                    if (!lastVolDrag.current) {
                      lastVolDrag.current = p;
                      patchPanel(panelId, { volDragging: true });
                      return;
                    }
                    const dx = p[0] - lastVolDrag.current[0];
                    lastVolDrag.current = p;
                    const cur = s.muted ? 0 : s.volume;
                    const v = Math.min(1, Math.max(0, cur + dx / volW));
                    patchPanel(panelId, { volume: v > 0 ? v : s.volume, muted: v === 0 });
                    const now = Date.now();
                    if (now - lastVolSent.current >= 80) {
                      lastVolSent.current = now;
                      applyVolume(v);
                    }
                  }}
                  onClickState={(state: number) => {
                    if (state === 2 && lastVolDrag.current) {
                      lastVolDrag.current = null;
                      const s = getMuxPanelState(panelId);
                      const v = s.muted ? 0 : s.volume;
                      applyVolume(v);
                      console.log(`[VXMUX] panel ${panelId}: volume → ${v.toFixed(2)}`);
                      patchPanel(panelId, { volDragging: false });
                    }
                  }}
                >
                  <ThumbDot size={thumbSize * 0.8} />
                </ViroNode>
              </ViroNode>
            </ViroNode>
            <BarIconButton
              icon={panel.muted ? "volume-x" : "volume-2"}
              size={volIcon}
              pose={pose(volIconX, DZ.ctrl)}
              onClick={toggleMute}
              onHover={volHover}
            />
          </ViroNode>
        </ViroNode>

        {/* ── 360 immersive sphere — SAME live external-texture material as
            the panel mesh (name-addressable, shared across geometries). The
            video BECOMES the surroundings; passthrough occlusion is desired.
            V-FLIP: SurfaceTexture frames are Y-flipped vs Viro UVs (the flat
            mesh flips texcoords in JS); sphere UVs aren't editable from JS,
            so scale [1,−1,1] mirrors about XZ — a pure vertical flip with no
            horizontal mirror (rotation [0,0,180] would mirror horizontally).
            The material is cullMode "None", so the winding reversal from the
            negative scale can't cull the inside faces. */}
        {exitPhase !== "idle" && (
          <ViroSphere
            radius={9}
            widthSegmentCount={12}
            heightSegmentCount={12}
            facesOutward={false}
            position={[0, 0, 2.0]}
            materials={["vxgMuxBlackout"]}
            opacity={exitPhase === "cover" ? 0 : 1}
            animation={{
              name: exitPhase === "cover" ? "vxgMuxFadeIn220" : "vxgMuxFadeOut320",
              run: true,
              loop: false,
            }}
            ignoreEventHandling
          />
        )}
        {sphereMounted && (
          <ViroNode
            opacity={0}
            visible={panel.immersive}
            animation={{ name: panel.immersive ? "vxgMuxFadeIn300" : "vxgMuxFadeOut300", run: true, loop: false }}
          >
            <ViroSphere
              radius={10}
              widthSegmentCount={30}
              heightSegmentCount={30}
              facesOutward={false}
              scale={[1, -1, 1]}
              position={[0, 0, 2.0]}
              materials={[videoMaterial]}
              ignoreEventHandling
            />
          </ViroNode>
        )}

        {/* Exit pill — low-center, billboards toward the user. */}
        {panel.immersive && (
          <ViroNode
            position={[0, -1.25, 0.7]}
            transformBehaviors={["billboardY"]}
            opacity={0}
            animation={{ name: "vxgMuxFadeIn300", run: true, loop: false }}
          >
            <ViroNode dragType={GIZMO} onDrag={noopDrag} onClick={exitSmooth}>
              {/* SAFETY: the pill plate is custom ViroGeometry — rays miss it
                  (drawer-row bug). Without this flat hitStrip the exit is
                  unclickable and the user is trapped in 360. Never remove. */}
              <ViroQuad
                width={0.38}
                height={0.12}
                position={[0, 0, 0.006]}
                materials={[M.hitStrip]}
                opacity={0.15}
                dragType={GIZMO}
                onDrag={noopDrag}
                onClick={exitSmooth}
              />
              <ViroGeometry
                vertices={pillPlate.vertices}
                normals={pillPlate.normals}
                texcoords={pillPlate.texcoords}
                triangleIndices={pillPlate.triangleIndices}
                materials={[FluentMaterials.slateTitleBar]}
              />
              <LucideIcon name="x" size={0.05} position={[-0.115, 0, 0.004]} />
              <Text3D
                text="Exit 360"
                color="#EDEDF2"
                width={0.2}
                height={0.06}
                textAlign="left"
                fillRatio={0.9}
                position={[0.025, 0, 0.004]}
              />
            </ViroNode>
          </ViroNode>
        )}
      </ViroNode>
    </MovableNode>
  );
}

/** Round white slider thumb (rounded plate with r = half → circle, seg 12). */
function ThumbDot(props: { size: number; onHover?: (h: boolean) => void }): React.ReactElement {
  const g = useMemo(() => roundedPlateBuffers(props.size, props.size, props.size / 2), [props.size]);
  return (
    <ViroGeometry
      vertices={g.vertices}
      normals={g.normals}
      texcoords={g.texcoords}
      triangleIndices={g.triangleIndices}
      materials={[FluentMaterials.gizmoHandle]}
      onHover={props.onHover ? (h: boolean) => props.onHover!(h) : undefined}
    />
  );
}
