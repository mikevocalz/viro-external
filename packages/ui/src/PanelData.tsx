import React from "react";
import { ScaledViroText } from "./ScaledViroText";
import { ViroNode, ViroQuad } from "@reactvision/react-viro";
import { PANEL_TYPE } from "./layout";
import type { Measurable } from "./PanelLayout";
import { PremiumMaterials, RenderOrder, registerPremiumMaterials } from "./materials";

export type PanelBarDatum = { label: string; value: number };

export type PanelBarChartProps = {
  data: readonly PanelBarDatum[];
  width: number;
  height: number;
  /** Colour the largest bar with the accent. */
  highlightPeak?: boolean;
};

/** Geometry of every bar, shared by the native chart and the Specs mapper. */
export function barChartLayout({ data, width, height }: PanelBarChartProps) {
  const labelBand = PANEL_TYPE.caption.lineHeight;
  const barMax = height - labelBand * 2 - 0.01;
  const baseline = -height / 2 + labelBand + 0.004;
  const slot = width / Math.max(1, data.length);
  const peak = Math.max(1, ...data.map((d) => d.value));
  return data.map((d, i) => {
    const h = Math.max(0.01, (d.value / peak) * barMax);
    const x = -width / 2 + slot * i + slot / 2;
    return {
      ...d,
      x,
      barWidth: slot * 0.55,
      barHeight: h,
      barY: baseline + h / 2,
      valueY: baseline + h + labelBand / 2,
      labelY: baseline - labelBand / 2 - 0.004,
      isPeak: d.value === peak,
    };
  });
}

export const PanelBarChart: Measurable<PanelBarChartProps> = Object.assign(
  function PanelBarChart(props: PanelBarChartProps) {
    registerPremiumMaterials();
    const bars = barChartLayout(props);
    const font = PANEL_TYPE.caption.fontSize;
    return (
      <ViroNode>
        {bars.map((bar) => (
          <ViroNode key={bar.label}>
            <ViroQuad
              position={[bar.x, bar.barY, 0]}
              renderingOrder={RenderOrder.backing}
              width={bar.barWidth}
              height={bar.barHeight}
              materials={[
                props.highlightPeak !== false && bar.isPeak
                  ? PremiumMaterials.thumb
                  : PremiumMaterials.button,
              ]}
            />
            <ScaledViroText
              text={String(bar.value)}
              position={[bar.x, bar.valueY, 0.002]}
              width={props.width / Math.max(1, props.data.length)}
              height={PANEL_TYPE.caption.lineHeight}
              style={{ fontSize: font, textAlign: "center" }}
            />
            <ScaledViroText
              text={bar.label}
              position={[bar.x, bar.labelY, 0.002]}
              width={props.width / Math.max(1, props.data.length)}
              height={PANEL_TYPE.caption.lineHeight}
              style={{ fontSize: font, textAlign: "center" }}
            />
          </ViroNode>
        ))}
      </ViroNode>
    );
  },
  { measure: ({ width, height }: PanelBarChartProps) => ({ width, height }) }
);

const STAT_INSET = 0.01;
const STAT_HEIGHT = PANEL_TYPE.figure.lineHeight + PANEL_TYPE.caption.lineHeight + STAT_INSET * 2;

export type PanelStatProps = {
  value: string;
  caption: string;
  width: number;
  height?: number;
};

/** A tile with a large figure over a caption. */
export const PanelStat: Measurable<PanelStatProps> = Object.assign(
  function PanelStat({ value, caption, width, height = STAT_HEIGHT }: PanelStatProps) {
    registerPremiumMaterials();
    return (
      <ViroNode>
        <ViroQuad width={width} height={height} materials={[PremiumMaterials.header]} renderingOrder={RenderOrder.backing} />
        <ScaledViroText
          text={value}
          position={[0, height / 2 - STAT_INSET - PANEL_TYPE.figure.lineHeight / 2, 0.004]}
          width={width}
          height={PANEL_TYPE.figure.lineHeight}
          style={{ fontSize: PANEL_TYPE.figure.fontSize, textAlign: "center" }}
        />
        <ScaledViroText
          text={caption}
          position={[0, -height / 2 + STAT_INSET + PANEL_TYPE.caption.lineHeight / 2, 0.004]}
          width={width}
          height={PANEL_TYPE.caption.lineHeight}
          style={{ fontSize: PANEL_TYPE.caption.fontSize, textAlign: "center" }}
        />
      </ViroNode>
    );
  },
  { measure: ({ width, height = STAT_HEIGHT }: PanelStatProps) => ({ width, height }) }
);
