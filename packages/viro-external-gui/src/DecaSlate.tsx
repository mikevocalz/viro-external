// No DOM, <canvas>, document, or WebGL APIs are used in this component. Renderer is ViroCore.
//
// D.E.C.A. Slate — a single surface that morphs pill → panel → wide on ONE native
// spring (ViroAnimations, EaseOut = critically-damped, no overshoot). The surface
// is built once at the WIDE footprint and never remounted; the morph is a
// non-uniform scale of that one node, so pill→panel→wide is continuous (not a
// crossfade, not unmount/remount — see doc/DecaSlate-Morph-SpatialModel.md).
//
// Spatial placement is owned by the caller's <SceneZone name="primary">; this
// component never types a world coordinate. All sizes come from config tokens.

import React, { useMemo } from "react";
import { ViroAnimations, ViroGeometry, ViroMaterials, ViroNode, ViroQuad, ViroText } from "@reactvision/react-viro";
import type { Vec3 } from "react-native-viro-mux";
import defaults from "../config/defaults.json";
import { roundedPlateBuffers } from "./roundedPlate";
import { FluentMaterials, registerFluentMaterials } from "./materials";
import { ScrollPanel3D } from "./ScrollPanel3D";

export type SlateMode = "pill" | "panel" | "wide";

export interface DecaSlateProps {
  mode: SlateMode;
  title?: string;
  /** pill affordance: user typed/sent → grow to panel. */
  onExpand?: () => void;
  /** header: toggle panel ↔ wide. */
  onToggleWide?: () => void;
  /** header/close: collapse back to pill (content unmounts AFTER settle). */
  onCollapse?: () => void;
  /** Content region children (rendered only in panel/wide, revealed staggered). */
  children?: React.ReactNode;
  /** pill content: input affordance + send (rendered only in pill). */
  pillContent?: React.ReactNode;
  position?: Vec3;
  rotation?: Vec3;
}

const S = defaults.slateStates;
const WIDE = S.wide; // base geometry is built at the widest footprint
const MORPH_MS = S.morphDurationMs;
const STAGGER_MS = S.contentStaggerMs;
const EASE = S.easing as "EaseOut";

// Per-mode non-uniform scale of the wide-sized surface. Because every
// intermediate footprint is bounded by WIDE (proven in the spatial model),
// scaling in never grows past the clearance proven for wide.
const SCALE: Record<SlateMode, { x: number; y: number }> = {
  pill: { x: S.pill.width / WIDE.width, y: S.pill.height / WIDE.height },
  panel: { x: S.panel.width / WIDE.width, y: S.panel.height / WIDE.height },
  wide: { x: 1, y: 1 },
};

let animsRegistered = false;
function registerMorphAnims(): void {
  if (animsRegistered) return;
  animsRegistered = true;
  // One spring per target mode: the surface animates scaleX/scaleY together.
  // EaseOut is monotonic (no overshoot / bounce) — the comfort skill's
  // critically-damped requirement, expressed in the project's real mechanism.
  ViroAnimations.registerAnimations({
    slateToPill: { properties: { scaleX: SCALE.pill.x, scaleY: SCALE.pill.y }, duration: MORPH_MS, easing: EASE },
    slateToPanel: { properties: { scaleX: SCALE.panel.x, scaleY: SCALE.panel.y }, duration: MORPH_MS, easing: EASE },
    slateToWide: { properties: { scaleX: SCALE.wide.x, scaleY: SCALE.wide.y }, duration: MORPH_MS, easing: EASE },
    // Content reveals AFTER the surface settles (delay = full morph), so the
    // surface visibly resolves first; children stagger further inside.
    slateContentIn: { properties: { opacity: 1 }, duration: 140, easing: EASE, delay: MORPH_MS },
    slateContentOut: { properties: { opacity: 0.01 }, duration: 100, easing: EASE },
  });
}

const HEADER_MAT = "vxg_decaslate_headerbtn";

export function DecaSlate(props: DecaSlateProps): React.ReactElement {
  const { mode, title, onToggleWide, onCollapse, children, pillContent, position, rotation } = props;
  registerFluentMaterials();
  registerMorphAnims();
  useMemo(() => {
    ViroMaterials.createMaterials({ [HEADER_MAT]: { diffuseColor: "#F5121216", lightingModel: "Constant" } });
  }, []);

  // Base surface geometry: built ONCE at the wide footprint (never rebuilt per
  // frame — the morph is scale, not geometry). corner radius from token.
  const corner = Math.min(WIDE.width, WIDE.height) * 0.03;
  const surface = useMemo(() => roundedPlateBuffers(WIDE.width, WIDE.height, corner), [corner]);

  const animName = mode === "pill" ? "slateToPill" : mode === "panel" ? "slateToPanel" : "slateToWide";
  const isWide = mode === "wide";

  // Content stays mounted through the collapse so it can fade OUT on the same
  // spring, then unmounts AFTER the morph settles (never during) — comfort skill.
  // Ephemeral view-only state (never leaves the component) → useState is allowed.
  const [contentMounted, setContentMounted] = React.useState(mode !== "pill");
  React.useEffect(() => {
    if (mode !== "pill") {
      setContentMounted(true);
      return;
    }
    const t = setTimeout(() => setContentMounted(false), MORPH_MS);
    return () => clearTimeout(t);
  }, [mode]);
  const showContent = contentMounted;
  const contentAnim = mode === "pill" ? "slateContentOut" : "slateContentIn";

  // Header buttons live in the surface-local top edge; scaled with the surface
  // (they only exist in panel/wide where scale is near 1, so no squish).
  const headerY = WIDE.height / 2 - 0.06;
  const btn = 0.06;

  return (
    <ViroNode position={position} rotation={rotation}>
      {/* THE morphing surface — one node, scale animated by the single spring. */}
      <ViroNode
        animation={{ name: animName, run: true, loop: false }}
        scale={[SCALE[mode].x, SCALE[mode].y, 1]}
      >
        <ViroGeometry
          vertices={surface.vertices}
          normals={surface.normals}
          texcoords={surface.texcoords}
          triangleIndices={surface.triangleIndices}
          materials={[FluentMaterials.slateChrome]}
          onClick={mode === "pill" ? props.onExpand : undefined}
        />
      </ViroNode>

      {/* PILL content (input + send affordance) — only in pill. */}
      {mode === "pill" && pillContent ? (
        <ViroNode position={[0, 0, 0.004]}>{pillContent}</ViroNode>
      ) : null}

      {/* PANEL / WIDE content — mounted only when expanded, opacity revealed
          staggered behind the surface settle. Unmounts when mode === pill,
          which the parent triggers AFTER the collapse animation settles. */}
      {showContent ? (
        <ViroNode
          position={[0, 0, 0.004]}
          opacity={0.01}
          animation={{ name: contentAnim, run: true, loop: false }}
        >
          {/* Header: title + expand-width toggle + close */}
          {title !== undefined ? (
            <ViroText
              text={title}
              color="#EDEDF2"
              width={WIDE.width * 0.7}
              height={0.12}
              position={[-(WIDE.width / 2) + 0.14, headerY, 0.002]}
              style={{ textAlign: "left", textAlignVertical: "center", fontWeight: "600" }}
            />
          ) : null}

          <ViroNode
            position={[WIDE.width / 2 - btn * 2.4, headerY, 0.002]}
            dragType={"Gizmo" as never}
            onDrag={() => {}}
            onClick={onToggleWide}
          >
            <ViroQuad width={btn} height={btn} materials={[HEADER_MAT]} />
            <ViroText
              text={isWide ? "▷◁" : "◁▷"}
              color="#EDEDF2"
              width={btn}
              height={btn}
              position={[0, 0, 0.001]}
              style={{ textAlign: "center", textAlignVertical: "center" }}
            />
          </ViroNode>

          <ViroNode
            position={[WIDE.width / 2 - btn, headerY, 0.002]}
            dragType={"Gizmo" as never}
            onDrag={() => {}}
            onClick={onCollapse}
          >
            <ViroQuad width={btn} height={btn} materials={[HEADER_MAT]} />
            <ViroText
              text="✕"
              color="#EDEDF2"
              width={btn}
              height={btn}
              position={[0, 0, 0.001]}
              style={{ textAlign: "center", textAlignVertical: "center" }}
            />
          </ViroNode>

          {/* Scrollable content — managed component, never hand-rolled. */}
          <ScrollPanel3D
            width={WIDE.width - 0.16}
            height={WIDE.height - 0.28}
            itemHeight={0.12}
            position={[0, -0.06, 0]}
          >
            {children}
          </ScrollPanel3D>
        </ViroNode>
      ) : null}
    </ViroNode>
  );
}
