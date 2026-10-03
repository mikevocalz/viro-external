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

function PanelTextView({
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

function PanelImageView({
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

/** Fixed-size text box; measurable so it can sit in a PanelStack or PanelRow. */
export const PanelText = Object.assign(PanelTextView, {
  measure: ({ width, height }: PanelTextProps) => ({ width, height }),
});

/** Fixed-size image; measurable so it can sit in a PanelStack or PanelRow. */
export const PanelImage = Object.assign(PanelImageView, {
  measure: ({ width, height }: PanelImageProps) => ({ width, height }),
});
