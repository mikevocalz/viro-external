import React from "react";
import { ViroNode, ViroText } from "@reactvision/react-viro";
import type { TextStyle } from "react-native";
import type { Vec3 } from "react-native-viro-mux";

/**
 * World-size-correct text for panels and buttons.
 *
 * ViroText glyphs have ABSOLUTE world size: em height = fontSize ×
 * kTextPointToWorldScale (0.01 m — VROText.h). The width/height props are
 * only a layout box, so raw ViroText can never track panel dimensions — an
 * 18pt default is 0.18 m tall and clips inside a 0.16 m button.
 *
 * Text3D renders ViroText on a fixed logical canvas (width = 1, height =
 * height/width) inside a ViroNode scaled by the requested world width, so
 * `fontSize` reads as "percent of box width per em" and text size tracks the
 * box exactly.
 */
export interface Text3DProps {
  text: string;
  /** World width of the text box, meters. */
  width: number;
  /** World height of the text box, meters. */
  height: number;
  /**
   * Maximum em height as a percentage of `width` (canvas points). With
   * `autoFit` (default) this is a CAP — the effective size is fitted so the
   * longest line fills ~`fillRatio` of the width, then clamped vertically.
   */
  fontSize?: number;
  fontFamily?: string;
  /** Fit the longest line to `fillRatio` of the width. Default true. */
  autoFit?: boolean;
  /** Fraction of the box width a fitted line should fill. Default 0.7. */
  fillRatio?: number;
  color?: string;
  fontWeight?: TextStyle["fontWeight"];
  textAlign?: "left" | "center" | "right";
  textAlignVertical?: "top" | "center" | "bottom";
  maxLines?: number;
  position?: Vec3;
}

/** Average latin glyph advance ≈ 0.55 em — good enough for label fitting. */
const AVG_ADVANCE_EM = 0.55;

export function computeText3DFontSize(opts: {
  text: string;
  width: number;
  height: number;
  fontSize: number;
  autoFit: boolean;
  fillRatio: number;
}): number {
  const { text, width, height, fontSize, autoFit, fillRatio } = opts;
  let size = fontSize;
  if (autoFit) {
    const longest = text
      .split("\n")
      .reduce((m, line) => Math.max(m, line.length), 1);
    // Grow-or-shrink to fill `fillRatio` of the width, capped by `fontSize`.
    size = Math.min(fontSize, (fillRatio * 100) / (AVG_ADVANCE_EM * longest));
  }
  // Never taller than 80% of the box height (em ≤ 0.8 × height).
  size = Math.min(size, (80 * height) / width);
  return Math.max(1, Math.round(size));
}

export function Text3D(props: Text3DProps): React.ReactElement {
  const {
    text,
    width,
    height,
    fontSize = 24,
    fontFamily,
    autoFit = true,
    fillRatio = 0.7,
    color = "#EDEDF2",
    fontWeight = "400",
    textAlign = "center",
    textAlignVertical = "center",
    maxLines,
    position,
  } = props;

  const size = computeText3DFontSize({ text, width, height, fontSize, autoFit, fillRatio });

  // 2× supersample: render glyphs at double point size on a double-width
  // logical canvas, scale down — same world size, denser glyph texture
  // (crisp at slate reading distance instead of soft).
  const K = 2;
  return (
    <ViroNode position={position} scale={[width / K, width / K, 1]}>
      <ViroText
        text={text}
        color={color}
        width={K}
        height={(height / width) * K}
        maxLines={maxLines}
        textClipMode="None"
        style={{ fontSize: size * K, fontWeight, textAlign, textAlignVertical, ...(fontFamily ? { fontFamily } : {}) }}
        ignoreEventHandling
      />
    </ViroNode>
  );
}
