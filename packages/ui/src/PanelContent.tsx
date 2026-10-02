import React from "react";
import {
  ViroImage,
  ViroNode,
  ViroText,
} from "@reactvision/react-viro";
import type { Vec3 } from "@viro-external/core";

export type PanelTextProps = {
  text: string;
  width: number;
  height: number;
  position?: Vec3;
  color?: string;
  align?: "left" | "center" | "right";
  weight?: "normal" | "400" | "500" | "600" | "700" | "bold";
};

export function PanelText({
  text,
  width,
  height,
  position,
  color = "#F7F8FC",
  align = "left",
  weight = "normal",
}: PanelTextProps): React.ReactElement {
  return (
    <ViroText
      text={text}
      color={color}
      width={width}
      height={height}
      position={position}
      style={{
        textAlign: align,
        textAlignVertical: "center",
        fontWeight: weight,
      }}
    />
  );
}

export type PanelImageProps = {
  source: { uri: string } | number;
  width: number;
  height: number;
  position?: Vec3;
};

export function PanelImage({
  source,
  width,
  height,
  position,
}: PanelImageProps): React.ReactElement {
  return (
    <ViroNode position={position}>
      <ViroImage
        source={source}
        width={width}
        height={height}
      />
    </ViroNode>
  );
}
