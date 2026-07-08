// No DOM, <canvas>, document, or WebGL APIs are used in this component. Renderer is ViroCore.
//
// Phase 1 observability: the ONLY thing in the codebase that reads player state
// from INSIDE the Viro compositor (screencap/screen-recording can't cross it).
// Renders on the opaque Chrome plane, NEVER over the OES video (Q1: chrome and
// video are both alpha-blended → keep the HUD off the video plane to avoid the
// transparency-sort glitch). Prints exactly the state that would have caught
// all four regressions:
//   textureId + target (OES)         → alpha-composite / bind class
//   mode (arc|flat) + live path      → dual-surface drift
//   immersive + orientation (euler)  → upside-down 360
//   drawerOpen + anchor              → drawer-from-behind
//   bindCount + playback state       → "plays on 3rd open"
import React from "react";
import { ViroNode, ViroQuad, ViroText, ViroMaterials } from "@reactvision/react-viro";
import type { Vec3 } from "react-native-viro-mux";

let hudMatRegistered = false;
function registerHudMaterial(): void {
  if (hudMatRegistered) return;
  hudMatRegistered = true;
  // Opaque near-black backplate (writesToDepthBuffer default) — sits in the
  // OPAQUE bucket so it never sorts against the video (Q1).
  ViroMaterials.createMaterials({
    vxgHudBg: { diffuseColor: "#F2101216", lightingModel: "Constant" },
  });
}

export interface MuxDebugHUDProps {
  panelId: string;
  mode: "arc" | "flat";
  textureId: number | null;
  playback: "idle" | "loading" | "playing" | "paused" | "error";
  bindCount: number;
  immersive: boolean;
  drawerOpen: boolean;
  activeIndex: number;
  /** Player rotation (euler degrees) — surfaces the 360 orientation. */
  rotation?: Vec3;
  /** Placed above the header, off the video plane. */
  position: Vec3;
  width: number;
}

/** Always-on in-scene state readout. Cheap: 1 quad + 1 text, ignoreEventHandling. */
export function MuxDebugHUD(props: MuxDebugHUDProps): React.ReactElement {
  registerHudMaterial();
  const rot = props.rotation ?? [0, 0, 0];
  const text =
    `HUD ${props.panelId}\n` +
    `tex:${props.textureId ?? "—"} (OES)  binds:${props.bindCount}\n` +
    `state:${props.playback}  mode:${props.mode}\n` +
    `immersive:${props.immersive ? "ON" : "off"}  rot:[${rot.map((n) => Math.round(n)).join(",")}]\n` +
    `drawer:${props.drawerOpen ? "OPEN" : "closed"}  idx:${props.activeIndex}`;
  const w = Math.min(0.6, props.width * 0.6);
  const h = 0.26; // tall enough for 5 lines
  return (
    <ViroNode position={props.position}>
      <ViroQuad width={w} height={h} materials={["vxgHudBg"]} ignoreEventHandling />
      <ViroText
        text={text}
        color="#8CFF9C"
        width={w - 0.02}
        height={h - 0.01}
        maxLines={6}
        textClipMode="None"
        position={[0, 0, 0.002] as Vec3}
        style={{ fontSize: 11, textAlign: "left", textAlignVertical: "top", fontFamily: "Inter-Regular" }}
        ignoreEventHandling
      />
    </ViroNode>
  );
}
