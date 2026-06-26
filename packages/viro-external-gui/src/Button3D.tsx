import React, { useMemo } from "react";
import { ViroQuad, ViroText } from "@reactvision/react-viro";
import { createPlaceholderMaterial, type Vec3 } from "react-native-viro-mux";
import defaults from "../config/defaults.json";
import { Control3D, type Control3DProps } from "./Control3D";
import { useInsideMovablePanel } from "./MovablePanelContext";

export interface Button3DProps extends Omit<Control3DProps, "children"> {
  text?: string;
  imageUrl?: string;
  fontColor?: string;
  contentResolution?: number;
  contentScaleRatio?: number;
  widthMeters?: number;
  heightMeters?: number;
  /** Movability — only honored when no movable panel ancestor exists. */
  movable?: boolean;
  /** Named material the content texture renders into. Auto-generated when absent. */
  materialName?: string;
}

let autoMaterialId = 0;

export function Button3D(props: Button3DProps): React.ReactElement {
  const {
    text,
    imageUrl,
    fontColor = defaults.button.fontColor,
    contentResolution = defaults.button.contentResolution,
    contentScaleRatio = defaults.button.contentScaleRatio,
    widthMeters = defaults.button.widthMeters,
    heightMeters = defaults.button.heightMeters,
    movable,
    materialName,
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
    console.warn("[viro-external/gui] Button3D: ignoring `movable` — a movable panel ancestor owns movement.");
  }

  void contentResolution;
  void contentScaleRatio;
  void imageUrl;

  const matName = useMemo(() => materialName ?? `viroGuiButton_${++autoMaterialId}`, [materialName]);
  React.useEffect(() => {
    createPlaceholderMaterial(matName);
  }, [matName]);

  const textNode = text !== undefined ? (
    <ViroText
      text={text}
      color={fontColor}
      width={widthMeters}
      height={heightMeters}
      position={[0, 0, 0.011] as Vec3}
      style={{ textAlign: "center", textAlignVertical: "center", fontWeight: "600" }}
    />
  ) : null;

  return (
    <Control3D
      position={position}
      rotation={rotation}
      scale={scale}
      visible={visible}
      onPointerEnter={onPointerEnter}
      onPointerOut={onPointerOut}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerClick={onPointerClick}
    >
      <ViroQuad width={widthMeters} height={heightMeters} materials={[matName]} />
      {textNode}
    </Control3D>
  );
}
