import React, { useMemo, useState } from "react";
import { ViroAnimations, ViroGeometry, ViroNode, ViroQuad } from "@reactvision/react-viro";
import type { Vec3 } from "react-native-viro-mux";
import { FluentMaterials, registerFluentMaterials } from "./materials";
import { roundedPlateBuffers } from "./roundedPlate";
import { arcPlateBuffers, polarPose, type ArcFrame } from "./arc";
import { LucideIcon, type LucideIconName } from "./LucideIcon";
import { Text3D } from "./Text3D";

/**
 * Shared panel title bar — extracted from HolographicSlate so every panel
 * (slate, cylinder, …) gets identical chrome: rounded bar, title, follow
 * (pin) toggle, close. Controlled: pin state lives in the OWNING panel
 * (billboardY is applied to the panel body, not the header).
 */
export interface PanelHeader3DProps {
  /** Bar width in meters. */
  width: number;
  /** Bar height in meters. */
  barHeight: number;
  title?: string;
  titleFontFamily?: string;
  pinned: boolean;
  onTogglePin: () => void;
  onClose: () => void;
  /** Hover feedback bubble-up (slate flares its border on chrome hover). */
  onHover?: (hovered: boolean) => void;
  position?: Vec3;
  /**
   * Optional control slotted INSIDE the bar at its left edge (e.g. a
   * hamburger menu toggle). Rendered in header-local space — the slot origin
   * is the accessory button center. The title shifts right to make room.
   * Dependency note: gui depends on react-native-viro-mux (never the other
   * way), so mux-flavored headers pass their accessory in from gui-side
   * composition (MuxPlayerPanel) rather than importing gui from mux.
   */
  leftAccessory?: React.ReactNode;
  /**
   * Meters of bar (from the left edge) the accessory occupies. Defaults to a
   * single button's slot; pass a wider value for multi-button accessories so
   * the title starts after them.
   */
  leftAccessoryWidth?: number;
  /**
   * When set, the bar is rendered as a cylindrical arc concentric with the
   * video mesh (see src/arc.ts — same radius/chord relation as
   * buildCurvedMesh): the backplate becomes an arc plate at the chrome
   * radius and every control is arc-placed at θ = x/chromeRadius with
   * rotation [0, −θ·180/π, 0]. `position` should then be [0, barY, 0] —
   * the axis offset (frame.axisZ) is applied internally.
   */
  arc?: ArcFrame;
}

let animsRegistered = false;
export function registerHeaderAnims(): void {
  if (animsRegistered) return;
  animsRegistered = true;
  ViroAnimations.registerAnimations({
    vxgPressDown: { properties: { scaleX: 0.9, scaleY: 0.9, scaleZ: 0.9 }, duration: 80, easing: "EaseOut" },
    vxgPressUp: { properties: { scaleX: 1.0, scaleY: 1.0, scaleZ: 1.0 }, duration: 120, easing: "EaseOut" },
  });
}

/** Small icon button used in the title bar (close / pin). */
export function TitleBarButton(props: {
  icon: LucideIconName;
  size: number;
  position: Vec3;
  onClick: () => void;
}): React.ReactElement {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  return (
    <ViroNode
      position={props.position}
      animation={{ name: pressed ? "vxgPressDown" : "vxgPressUp", run: true, loop: false }}
    >
      <ViroQuad
        width={props.size}
        height={props.size}
        materials={[hovered ? FluentMaterials.iconHover : FluentMaterials.iconIdle]}
        onHover={(h: boolean) => setHovered(h)}
        onClick={() => {
          setPressed(true);
          setTimeout(() => setPressed(false), 90);
          props.onClick();
        }}
      />
      <LucideIcon name={props.icon} size={props.size * 0.7} position={[0, 0, 0.002]} />
    </ViroNode>
  );
}

export function PanelHeader3D(props: PanelHeader3DProps): React.ReactElement {
  const { width, barHeight, title, titleFontFamily, pinned, onTogglePin, onClose, onHover, position, leftAccessory, leftAccessoryWidth, arc } = props;

  registerFluentMaterials();
  registerHeaderAnims();

  const bar = useMemo(
    () =>
      arc
        ? arcPlateBuffers(arc, -width / 2, width / 2, barHeight, 0)
        : roundedPlateBuffers(width, barHeight, barHeight * 0.3),
    [arc, width, barHeight]
  );
  const btnSize = barHeight * 0.8;

  // Title layout. Legacy formula unless leftAccessoryWidth is given.
  const accW = leftAccessory !== undefined ? (leftAccessoryWidth ?? btnSize * 1.4) : 0;
  const rightW = btnSize * 2.4; // pin + close
  let titleW: number;
  let titleX: number;
  if (leftAccessoryWidth !== undefined || arc) {
    const titleLeft = -width / 2 + accW + 0.015;
    titleW = Math.max(0.1, width / 2 - rightW - titleLeft - 0.015);
    // Arc mode: flat text can't be curved — cap the box so its tangent-plane
    // sagitta stays small, and float it 18mm proud (worst-case ends sink
    // ~15mm on a 0.45m box at r≈1.65 → ≥2mm clearance over the plate).
    if (arc) titleW = Math.min(titleW, 0.45);
    titleX = titleLeft + titleW / 2;
  } else {
    titleW = width - btnSize * (leftAccessory !== undefined ? 4.6 : 3.2);
    titleX = -(btnSize * (leftAccessory !== undefined ? 0.9 : 1.6));
  }

  const accX = -width / 2 + btnSize * 0.7;
  const pinX = width / 2 - btnSize * 1.7;
  const closeX = width / 2 - btnSize * 0.7;

  const titleEl =
    title !== undefined ? (
      <Text3D
        text={title}
        fontFamily={titleFontFamily}
        color="#EDEDF2"
        width={titleW}
        height={barHeight * 0.85}
        textAlign="left"
        fontWeight="600"
        fillRatio={0.9}
        position={arc ? undefined : [titleX, 0, 0.003]}
      />
    ) : null;

  if (arc) {
    const accPose = polarPose(arc, accX, 0.004);
    const titlePose = polarPose(arc, titleX, 0.018);
    const pinPose = polarPose(arc, pinX, 0.004);
    const closePose = polarPose(arc, closeX, 0.004);
    return (
      <ViroNode position={position}>
        <ViroNode position={[0, 0, arc.axisZ]}>
          <ViroGeometry
            vertices={bar.vertices}
            normals={bar.normals}
            texcoords={bar.texcoords}
            triangleIndices={bar.triangleIndices}
            materials={[FluentMaterials.slateTitleBar]}
            onHover={onHover ? (h: boolean) => onHover(h) : undefined}
          />
          {leftAccessory !== undefined && (
            <ViroNode position={accPose.position} rotation={accPose.rotation}>{leftAccessory}</ViroNode>
          )}
          {titleEl && (
            <ViroNode position={titlePose.position} rotation={titlePose.rotation}>{titleEl}</ViroNode>
          )}
          <ViroNode position={pinPose.position} rotation={pinPose.rotation}>
            <TitleBarButton icon={pinned ? "pin" : "pin-off"} size={btnSize} position={[0, 0, 0]} onClick={onTogglePin} />
          </ViroNode>
          <ViroNode position={closePose.position} rotation={closePose.rotation}>
            <TitleBarButton icon="x" size={btnSize} position={[0, 0, 0]} onClick={onClose} />
          </ViroNode>
        </ViroNode>
      </ViroNode>
    );
  }

  return (
    <ViroNode position={position}>
      <ViroGeometry
        vertices={bar.vertices}
        normals={bar.normals}
        texcoords={bar.texcoords}
        triangleIndices={bar.triangleIndices}
        materials={[FluentMaterials.slateTitleBar]}
        onHover={onHover ? (h: boolean) => onHover(h) : undefined}
      />
      {leftAccessory !== undefined && (
        <ViroNode position={[accX, 0, 0.003]}>{leftAccessory}</ViroNode>
      )}
      {titleEl}
      {/* Follow (pin) toggle — Babylon slate's follow button. */}
      <TitleBarButton
        icon={pinned ? "pin" : "pin-off"}
        size={btnSize}
        position={[pinX, 0, 0.003]}
        onClick={onTogglePin}
      />
      {/* Close. */}
      <TitleBarButton icon="x" size={btnSize} position={[closeX, 0, 0.003]} onClick={onClose} />
    </ViroNode>
  );
}
