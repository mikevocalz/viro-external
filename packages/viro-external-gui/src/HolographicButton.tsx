import React, { useState } from "react";
import { ViroBox, ViroQuad, ViroText } from "@reactvision/react-viro";
import type { Vec3 } from "react-native-viro-mux";
import defaults from "../config/defaults.json";
import { Control3D, type Control3DProps } from "./Control3D";
import { useInsideMovablePanel } from "./MovablePanelContext";

export interface HolographicButtonProps extends Omit<Control3DProps, "children"> {
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

  const backMaterials = backMaterial ? [backMaterial] : undefined;
  const frontMaterials = frontMaterial ? [frontMaterial] : undefined;
  const plateMaterials = plateMaterial ? [plateMaterial] : undefined;

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
      onPointerClick={onPointerClick}
    >
      {/* Back plate: a thin box providing volumetric presence. */}
      <ViroBox
        position={[0, 0, -halfDepth] as Vec3}
        width={widthMeters}
        height={heightMeters}
        length={depthMeters}
        materials={backMaterials}
      />
      {/* Content plate (front face). */}
      <ViroQuad
        position={[0, 0, halfDepth + 0.001] as Vec3}
        width={widthMeters * 0.92}
        height={heightMeters * 0.92}
        materials={plateMaterials}
      />
      {/* Front-plate hover highlight tracking the pointer (glass material). */}
      {hovered && (
        <ViroQuad
          position={[0, 0, halfDepth + 0.002] as Vec3}
          width={widthMeters}
          height={heightMeters}
          materials={frontMaterials}
        />
      )}
      {text !== undefined && (
        <ViroText
          text={text}
          color={fontColor}
          width={widthMeters}
          height={heightMeters}
          position={[0, 0, halfDepth + 0.003] as Vec3}
          style={{ textAlign: "center", textAlignVertical: "center", fontWeight: "600" }}
        />
      )}
      {hovered && tooltipText && (
        <ViroText
          text={tooltipText}
          color={fontColor}
          width={widthMeters * 2}
          height={heightMeters * 0.4}
          position={[0, heightMeters * 0.7, halfDepth + 0.005] as Vec3}
          style={{ textAlign: "center", textAlignVertical: "center", fontSize: 18 }}
        />
      )}
    </Control3D>
  );
}
