import React, { useState } from "react";
import { ViroBox, ViroQuad } from "@reactvision/react-viro";
import type { Vec3 } from "react-native-viro-mux";
import defaults from "../config/defaults.json";
import { ViroGeometry } from "@reactvision/react-viro";
import { roundedPlateBuffers } from "./roundedPlate";
import { Text3D } from "./Text3D";

function RoundedPlate(props: {
  w: number; h: number; r: number;
  position: Vec3;
  materials: string[] | undefined;
}): React.ReactElement {
  const g = React.useMemo(
    () => roundedPlateBuffers(props.w, props.h, props.r),
    [props.w, props.h, props.r]
  );
  return (
    <ViroGeometry
      vertices={g.vertices}
      normals={g.normals}
      texcoords={g.texcoords}
      triangleIndices={g.triangleIndices}
      materials={props.materials}
      position={props.position}
      ignoreEventHandling
    />
  );
}
import { FluentMaterials, registerFluentMaterials } from "./materials";
import { Control3D, type Control3DProps } from "./Control3D";
import { useInsideMovablePanel } from "./MovablePanelContext";

export interface HolographicButtonProps extends Omit<Control3DProps, "children"> {
  /** Alias for onPointerClick — the name every consumer reaches for first. */
  onClick?: () => void;
  text?: string;
  imageUrl?: string;
  tooltipText?: string | null;
  fontColor?: string;
  contentResolution?: number;
  contentScaleRatio?: number;
  widthMeters?: number;
  heightMeters?: number;
  depthMeters?: number;
  /** Babylon prop — material name for the back plate. */
  backMaterial?: string;
  /** Babylon prop — material name for the front plate. */
  frontMaterial?: string;
  /** Babylon prop — material name for the content (text/image) plate. */
  plateMaterial?: string;
  renderingGroupId?: number;
  movable?: boolean;
}

export function HolographicButton(props: HolographicButtonProps): React.ReactElement {
  const {
    text,
    onClick,
    imageUrl,
    tooltipText = defaults.holographicButton.tooltipText,
    fontColor = defaults.button.fontColor,
    contentResolution = defaults.button.contentResolution,
    contentScaleRatio = defaults.button.contentScaleRatio,
    widthMeters = defaults.button.widthMeters,
    heightMeters = defaults.button.heightMeters,
    depthMeters = defaults.button.depthMeters,
    backMaterial,
    frontMaterial,
    plateMaterial,
    renderingGroupId = defaults.holographicButton.renderingGroupId,
    movable,
    position,
    rotation,
    scale,
    visible,
    onPointerEnter,
    onPointerOut,
    onPointerDown,
    onPointerUp,
    onPointerClick,
  } = props;

  const insideMovablePanel = useInsideMovablePanel();
  if (movable && insideMovablePanel && __DEV__) {
    // eslint-disable-next-line no-console
    console.warn("[viro-external/gui] HolographicButton: ignoring `movable` — movable panel ancestor.");
  }

  void contentResolution;
  void contentScaleRatio;
  void imageUrl;
  void renderingGroupId;

  const [hovered, setHovered] = useState(false);

  registerFluentMaterials();
  const backMaterials = [backMaterial ?? FluentMaterials.buttonBack];
  const frontMaterials = [frontMaterial ?? FluentMaterials.buttonGlow];
  const plateMaterials = [
    plateMaterial ?? (hovered ? FluentMaterials.buttonPlateHover : FluentMaterials.buttonPlate),
  ];

  const halfDepth = depthMeters / 2;

  return (
    <Control3D
      position={position}
      rotation={rotation}
      scale={scale}
      visible={visible}
      onPointerEnter={(e) => { setHovered(true); onPointerEnter?.(e); }}
      onPointerOut={() => { setHovered(false); onPointerOut?.(); }}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerClick={(e) => {
        onPointerClick?.(e);
        onClick?.();
      }}
    >
      {/* Back plate: a thin box providing volumetric presence — also the
          button's hit surface (drag bubbles from here to a movable panel). */}
      <ViroBox
        position={[0, 0, -halfDepth] as Vec3}
        width={widthMeters}
        height={heightMeters}
        length={depthMeters}
        materials={backMaterials}
      />
      {/* Content plate (front face) — rounded, fluent, lightens on hover.
          ≥2 mm z-separation everywhere: coplanar plates shimmer. */}
      <RoundedPlate
        w={widthMeters * 0.94}
        h={heightMeters * 0.94}
        r={Math.min(widthMeters, heightMeters) * 0.16}
        position={[0, 0, halfDepth + 0.002] as Vec3}
        materials={plateMaterials}
      />
      {/* Front-plate hover highlight tracking the pointer (glass material). */}
      {hovered && (
        <RoundedPlate
          w={widthMeters * 0.94}
          h={heightMeters * 0.94}
          r={Math.min(widthMeters, heightMeters) * 0.16}
          position={[0, 0, halfDepth + 0.004] as Vec3}
          materials={frontMaterials}
        />
      )}
      {text !== undefined && (
        <Text3D
          text={text}
          color={fontColor}
          width={widthMeters * 0.92}
          height={heightMeters * 0.55}
          fillRatio={0.75}
          fontWeight="600"
          position={[0, 0, halfDepth + 0.006] as Vec3}
        />
      )}
      {hovered && tooltipText && (
        <Text3D
          text={tooltipText}
          color={fontColor}
          width={widthMeters * 2}
          height={heightMeters * 0.4}
          fillRatio={0.9}
          position={[0, heightMeters * 0.7, halfDepth + 0.008] as Vec3}
        />
      )}
    </Control3D>
  );
}
