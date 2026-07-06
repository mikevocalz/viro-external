import React, { useCallback, useMemo, useState } from "react";
import {
  ViroAnimations,
  ViroBox,
  ViroGeometry,
  ViroMaterials,
  ViroNode,
} from "@reactvision/react-viro";
import { MovableNode, type Vec3 } from "react-native-viro-mux";
import { roundedPlateBuffers, type PlateBuffers } from "./roundedPlate";
import { DecaTheme, registerDecaTheme } from "./decaTheme";
import { annularArcBuffers, annularArcOutlineBuffers } from "./annularArc";
import { LucideIcon, type LucideIconName } from "./LucideIcon";
import { Text3D } from "./Text3D";

/**
 * Radial command menu — curved "petal" chips (ring sectors) that bloom
 * radially out of the center hub, in the slate's Fluent-dark theme
 * (near-black glass, MRTK-blue neon borders).
 *
 * Interaction primitive is the PROVEN HolographicButton pattern: pointer
 * events live on a wrapping ViroNode and the hit surface is a thin ViroBox
 * (opacity ≥ 0.15 — invisible geometry is culled from hit-tests, on-device
 * finding 2026-07-03). The earlier design hung onClick directly on
 * 0.15-opacity quads inside opacity-animated nodes and clicks were flaky.
 *
 * Hover feedback is React-state-driven scale (Control3D pattern), NOT a Viro
 * animation — hover re-renders must never restart the bloom animation, so
 * hover state lives in leaf components below the animated nodes.
 *
 * Choreography: hub tap → petals slide outward along their radial axis with
 * staggered ease-out while a neon orbit ring fades in and a 60° scanner arc
 * sweeps the perimeter. Pin satellite toggles movability; borders flare hot
 * while dragging.
 */
export interface RadialMenuItem {
  icon: LucideIconName;
  label?: string;
  onSelect: () => void;
}

export interface RadialMenu3DProps {
  items: RadialMenuItem[];
  /** Outer radius of the petal ring, meters. */
  radius?: number;
  position?: Vec3;
  tag?: string;
  /** UI sound hooks — the host plays the assets (keeps gui asset-free). */
  onOpen?: () => void;
  onClose?: () => void;
  /** Fires when a petal or the hub gains hover focus. */
  onFocus?: () => void;
}

// ── Materials: the D.E.C.A. cyber theme (ember red over dark chrome) — the
// orb's palette, shared with the account panel and every DECA HUD element.
const RM = {
  plate: DecaTheme.plate,
  plateHover: DecaTheme.plateHover,
  back: DecaTheme.back,
  edge: DecaTheme.ember,
  edgeHot: DecaTheme.emberHot,
  hit: DecaTheme.hit,
} as const;
function registerRadialMaterials(): void {
  registerDecaTheme();
}

let animsRegistered = false;
function registerRadialAnims(): void {
  if (animsRegistered) return;
  animsRegistered = true;
  ViroAnimations.registerAnimations({
    // Petal bloom: slide radially outward (local +y) + swirl (rotateZ -16°→0)
    // + scale + fade, staggered per petal via animation.delay. The swirl makes
    // the ring read as unfurling around the hub, not just inflating.
    // Closed state is opacity 0.01, NOT 0 — this fork never hydrates texture
    // substrates inside opacity-0 subtrees, then SIGSEGVs in
    // VROTexture::getSubstrate when the bloom makes them visible
    // (on-device 2026-07-05). 0.01 keeps icon/label textures alive.
    vxgRadPetalIn: {
      properties: { positionY: 0, rotateZ: 0, scaleX: 1, scaleY: 1, scaleZ: 1, opacity: 1 },
      duration: 320,
      easing: "EaseOut",
    },
    vxgRadPetalOut: {
      properties: { positionY: -0.05, rotateZ: -16, scaleX: 0.55, scaleY: 0.55, scaleZ: 0.55, opacity: 0.01 },
      duration: 170,
      easing: "EaseIn",
    },
    vxgRadFadeIn: { properties: { opacity: 1 }, duration: 280, easing: "EaseOut" },
    vxgRadFadeOut: { properties: { opacity: 0.01 }, duration: 140, easing: "EaseOut" },
    // Perimeter scanner sweep — single-step relative loop (chained anims hang
    // this fork).
    vxgRadSpin: { properties: { rotateZ: "+=360" }, duration: 9000, easing: "Linear" },
    // Center attract pulse (single-step loop, same constraint).
    vxgRadPulse: { properties: { scaleX: 1.05, scaleY: 1.05, scaleZ: 1.05 }, duration: 1400, easing: "EaseInEaseOut" },
    vxgRadPulseBack: { properties: { scaleX: 1, scaleY: 1, scaleZ: 1 }, duration: 200, easing: "EaseOut" },
    // Hover/press micro-feedback — native-driven (state-snap scale reads as
    // a pop at 90Hz; these glide). Dedicated inner nodes only, so restarts
    // can never touch the bloom animation.
    vxgMicroHoverIn: { properties: { scaleX: 1.08, scaleY: 1.08, scaleZ: 1.08 }, duration: 110, easing: "EaseOut" },
    vxgMicroHoverOut: { properties: { scaleX: 1, scaleY: 1, scaleZ: 1 }, duration: 140, easing: "EaseOut" },
    vxgMicroPress: { properties: { scaleX: 0.94, scaleY: 0.94, scaleZ: 0.94 }, duration: 60, easing: "EaseOut" },
  });
}

function Plate(props: {
  buffers: PlateBuffers;
  materials: string[];
  position?: Vec3;
  hittable?: boolean;
}): React.ReactElement {
  return (
    <ViroGeometry
      vertices={props.buffers.vertices}
      normals={props.buffers.normals}
      texcoords={props.buffers.texcoords}
      triangleIndices={props.buffers.triangleIndices}
      materials={props.materials}
      position={props.position}
      // hittable → the visible rounded plate IS the hit surface, so there's no
      // separate rectangular ViroBox behind it (that box was the faint square).
      ignoreEventHandling={!props.hittable}
    />
  );
}

// ── One petal: ring-sector plate + neon edge + icon + label. ─────────────
// Geometry is generated once, centered at 12 o'clock, and shared by every
// petal — each petal's wrapper node rotates it into its slot; icon/label
// counter-rotate to stay upright.
function Petal(props: {
  item: RadialMenuItem;
  rotDeg: number;
  plate: PlateBuffers;
  edge: PlateBuffers;
  midR: number;
  chord: number;
  depth: number;
  open: boolean;
  delayMs: number;
  dragging: boolean;
  onSelect: (item: RadialMenuItem) => void;
  onFocus?: () => void;
}): React.ReactElement {
  const { item, rotDeg, plate, edge, midR, chord, depth, open, delayMs, dragging, onSelect, onFocus } = props;
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const micro = pressed ? "vxgMicroPress" : hovered ? "vxgMicroHoverIn" : "vxgMicroHoverOut";
  const focus = (h: boolean) => { setHovered(h); if (h) onFocus?.(); };

  return (
    <ViroNode rotation={[0, 0, rotDeg]}>
      <ViroNode
        position={[0, -0.05, 0]}
        rotation={[0, 0, -16]}
        scale={[0.55, 0.55, 0.55]}
        opacity={0.01}
        animation={{
          name: open ? "vxgRadPetalIn" : "vxgRadPetalOut",
          run: true,
          loop: false,
          delay: open ? delayMs : 0,
        }}
      >
        {/* Hover scale is about the menu center → petals glide radially. */}
        <ViroNode
          animation={{ name: micro, run: true, loop: false }}
          onHover={focus}
          // Fire on ClickDown (state 1) — instant, no down→up round-trip lag.
          onClickState={(state: number) => {
            if (state === 1) { setPressed(true); if (open) onSelect(item); }
            else if (state === 2) setPressed(false);
          }}
        >
          {/* The rounded plate itself is the hit surface — no square box. */}
          <Plate buffers={plate} materials={[hovered ? RM.plateHover : RM.plate]} position={[0, 0, 0.002]} hittable />
          <Plate
            buffers={edge}
            materials={[dragging || hovered ? RM.edgeHot : RM.edge]}
            position={[0, 0, 0.004]}
          />
          {/* Upright content at the petal centroid. */}
          <ViroNode position={[0, midR, 0.006]} rotation={[0, 0, -rotDeg]}>
            <LucideIcon
              name={item.icon}
              size={0.042}
              position={[0, item.label !== undefined ? 0.014 : 0, 0]}
            />
            {item.label !== undefined && (
              <Text3D
                text={item.label}
                width={chord * 0.9}
                height={0.03}
                fillRatio={0.85}
                fontFamily="Republica-Minor"
                color="#EDEDF2"
                position={[0, -0.034, 0]}
              />
            )}
          </ViroNode>
        </ViroNode>
      </ViroNode>
    </ViroNode>
  );
}

// ── Center hub — own hover state so hovering never re-renders petals. ────
function Hub(props: {
  centerR: number;
  open: boolean;
  onToggle: () => void;
  onFocus?: () => void;
}): React.ReactElement {
  const { centerR, open, onToggle, onFocus } = props;
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  const micro = pressed ? "vxgMicroPress" : hovered ? "vxgMicroHoverIn" : "vxgMicroHoverOut";
  const focus = (h: boolean) => { setHovered(h); if (h) onFocus?.(); };
  const plate = useMemo(
    () => roundedPlateBuffers(centerR * 2, centerR * 2, centerR * 0.999, 14),
    [centerR]
  );
  const ring = useMemo(
    () => annularArcOutlineBuffers(centerR * 0.9, centerR * 1.1, 0, 360, 40),
    [centerR]
  );

  return (
    <ViroNode
      animation={{
        name: open || hovered ? "vxgRadPulseBack" : "vxgRadPulse",
        run: true,
        loop: !open && !hovered,
      }}
    >
      <ViroNode
        animation={{ name: micro, run: true, loop: false }}
        onHover={focus}
        // Fire on ClickDown (state 1) — hub opens/closes the instant you press.
        onClickState={(state: number) => {
          if (state === 1) { setPressed(true); onToggle(); }
          else if (state === 2) setPressed(false);
        }}
      >
        <Plate buffers={plate} materials={[hovered ? RM.plateHover : RM.plate]} position={[0, 0, 0.002]} hittable />
        <Plate buffers={ring} materials={[open || hovered ? RM.edgeHot : RM.edge]} position={[0, 0, 0.004]} />
        {/* Both icons stay mounted; opacity cross-fade. Swapping the image
            SOURCE mid-render is the null-texture SIGSEGV (2026-07-05). */}
        <LucideIcon name="menu" size={centerR * 0.85} position={[0, 0, 0.006]} opacity={open ? 0.01 : 1} />
        <LucideIcon name="x" size={centerR * 0.85} position={[0, 0, 0.007]} opacity={open ? 1 : 0.01} />
      </ViroNode>
    </ViroNode>
  );
}

export function RadialMenu3D(props: RadialMenu3DProps): React.ReactElement {
  const { items, radius = 0.24, position, tag, onOpen, onClose, onFocus } = props;
  registerRadialMaterials();
  registerRadialAnims();

  const menuId = tag ?? "vxg-radial";
  const list = useMemo(() => items.slice(0, 8), [items]);
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [pinHovered, setPinHovered] = useState(false);

  const centerR = radius * 0.23;
  const innerR = radius * 0.44;
  const outerR = radius;
  const midR = (innerR + outerR) / 2;
  const depth = outerR - innerR;

  const n = list.length;
  const gapDeg = 4;
  const spanDeg = 360 / n - gapDeg;
  const chord = 2 * midR * Math.sin((spanDeg * Math.PI) / 360);

  // Shared petal geometry, centered at 12 o'clock — wrappers rotate it.
  const petalPlate = useMemo(
    () => annularArcBuffers(innerR, outerR, 90 - spanDeg / 2, 90 + spanDeg / 2, 24),
    [innerR, outerR, spanDeg]
  );
  const petalEdge = useMemo(
    () => annularArcOutlineBuffers(innerR, outerR, 90 - spanDeg / 2, 90 + spanDeg / 2, 24, 0.035),
    [innerR, outerR, spanDeg]
  );
  const orbitRing = useMemo(
    () => annularArcOutlineBuffers(outerR + 0.012, outerR + 0.018, 0, 360, 64),
    [outerR]
  );
  const scannerArc = useMemo(
    () => annularArcBuffers(outerR + 0.022, outerR + 0.027, 0, 60, 24),
    [outerR]
  );
  const pinPlate = useMemo(() => roundedPlateBuffers(0.044, 0.044, 0.021, 10), []);
  const pinRing = useMemo(() => annularArcOutlineBuffers(0.02, 0.026, 0, 360, 32), []);

  const select = useCallback(
    (item: RadialMenuItem) => {
      console.log(`[VXG] radial ${menuId}: select ${item.label ?? item.icon}`);
      item.onSelect();
      setOpen(false);
      onClose?.();
    },
    [menuId, onClose]
  );
  const toggle = useCallback(() => {
    setOpen((o) => {
      console.log(`[VXG] radial ${menuId}: ${o ? "close" : "open"}`);
      (o ? onClose : onOpen)?.();
      return !o;
    });
  }, [menuId, onOpen, onClose]);

  return (
    <MovableNode
      movable={!pinned}
      tag={menuId}
      position={position}
      onMoveStart={() => {
        setDragging(true);
        console.log(`[VXG] radial ${menuId}: drag start`);
      }}
      onMoveEnd={() => setDragging(false)}
    >
      {/* Orbit ring + scanner sweep — appear with the bloom, spin while open. */}
      <ViroNode
        opacity={0.01}
        animation={{ name: open ? "vxgRadFadeIn" : "vxgRadFadeOut", run: true, loop: false }}
      >
        <Plate buffers={orbitRing} materials={[dragging ? RM.edgeHot : RM.edge]} position={[0, 0, -0.002]} />
        <ViroNode animation={{ name: "vxgRadSpin", run: open, loop: true }}>
          <Plate buffers={scannerArc} materials={[RM.edgeHot]} position={[0, 0, -0.002]} />
        </ViroNode>
      </ViroNode>

      {/* Petals — 12 o'clock start, clockwise, staggered bloom. */}
      {list.map((item, i) => (
        <Petal
          key={item.label ?? `${item.icon}-${i}`}
          item={item}
          rotDeg={-(i * 360) / n}
          plate={petalPlate}
          edge={petalEdge}
          midR={midR}
          chord={chord}
          depth={depth}
          open={open}
          delayMs={i * 45}
          dragging={dragging}
          onSelect={select}
          onFocus={onFocus}
        />
      ))}

      <Hub centerR={centerR} open={open} onToggle={toggle} onFocus={onFocus} />

      {/* Pin satellite — rose ring while movable. */}
      <ViroNode
        position={[0, -(outerR + 0.07), 0]}
        onHover={(h: boolean) => setPinHovered(h)}
        onClickState={(state: number) => { if (state === 1) setPinned((p) => !p); }}
      >
        <Plate buffers={pinPlate} materials={[pinHovered ? RM.plateHover : RM.plate]} position={[0, 0, 0.002]} hittable />
        <Plate buffers={pinRing} materials={[pinned ? RM.edge : RM.edgeHot]} position={[0, 0, 0.003]} />
        <LucideIcon name="pin" size={0.024} position={[0, 0, 0.005]} opacity={pinned ? 1 : 0.01} />
        <LucideIcon name="pin-off" size={0.024} position={[0, 0, 0.006]} opacity={pinned ? 0.01 : 1} />
      </ViroNode>
    </MovableNode>
  );
}
