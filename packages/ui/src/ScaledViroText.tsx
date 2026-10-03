import React from "react";
import { ViroText } from "@reactvision/react-viro";
import { PANEL_TYPE } from "./layout";

/**
 * Viro lays text out at 1 cm per font point (VROText.h
 * kTextPointToWorldScale), so a 16 pt label is about 19 cm tall. Panels size
 * text in meters from PANEL_TYPE, so every panel ViroText renders at a tenth:
 * 1 mm per point. width/height stay in meters.
 */
export const TEXT_SCALE = 0.1;

type ScaledViroTextProps = React.ComponentProps<typeof ViroText> & {
  width: number;
  height: number;
};

export function ScaledViroText({ width, height, style, ...rest }: ScaledViroTextProps): React.ReactElement {
  return (
    <ViroText
      {...rest}
      // Viro's own default is 18 pt, under the 1 degree readability floor.
      style={{ fontSize: PANEL_TYPE.body.fontSize, ...(style as object) }}
      textClipMode="ClipToBounds"
      width={width / TEXT_SCALE}
      height={height / TEXT_SCALE}
      scale={[TEXT_SCALE, TEXT_SCALE, TEXT_SCALE]}
    />
  );
}
