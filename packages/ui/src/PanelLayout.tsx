import React, { createContext, useContext } from "react";
import { ViroNode, ViroQuad, ViroText } from "@reactvision/react-viro";
import {
  PANEL_GAP,
  PANEL_TYPE,
  paragraphHeight,
  rowLayout,
  stackLayout,
  type PanelBody,
  type PanelTextVariant,
} from "./layout";
import { PremiumMaterials, registerPremiumMaterials } from "./materials";

/** The content area of the enclosing SpatialPanel, set by the panel. */
export const PanelBodyContext = createContext<PanelBody | null>(null);

export type PanelSize = { width: number; height: number };

/**
 * A component that can sit in a PanelStack or PanelRow reports its size from
 * its props. The native renderer and the Specs mapper both read it, so items
 * land in the same place on every host.
 */
export type Measurable<P> = ((props: P) => React.ReactElement) & {
  measure: (props: P, available: number) => PanelSize;
};

/** Size of any child element; unmeasurable children take no space. */
export function measureElement(element: React.ReactNode, available: number): PanelSize {
  if (!React.isValidElement(element)) return { width: 0, height: 0 };
  const type = element.type as Partial<Measurable<unknown>>;
  return type.measure
    ? type.measure(element.props, available)
    : { width: 0, height: 0 };
}

function children(nodes: React.ReactNode): React.ReactElement[] {
  return React.Children.toArray(nodes).filter(React.isValidElement);
}

export type PanelStackProps = {
  children: React.ReactNode;
  gap?: number;
};

/**
 * A top-down column filling the panel body. Items are placed by their
 * measured heights from the body's top edge.
 * ponytail: native overflow is not clipped or scrolled yet; on Specs a stack
 * taller than the body becomes a scroll region. Use SpatialScrollView for
 * native scrolling until the native side gets the same treatment.
 */
export const PanelStack: Measurable<PanelStackProps> = Object.assign(
  function PanelStack({ children: items, gap = PANEL_GAP }: PanelStackProps) {
    const body = useContext(PanelBodyContext) ?? { centerY: 0, width: 1, height: 1 };
    const list = children(items);
    const sizes = list.map((child) => measureElement(child, body.width));
    const { centers } = stackLayout(
      sizes.map((size) => size.height),
      body.centerY + body.height / 2,
      gap
    );
    return (
      <ViroNode>
        {list.map((child, index) => (
          <ViroNode key={child.key ?? index} position={[0, centers[index] ?? 0, 0]}>
            {child}
          </ViroNode>
        ))}
      </ViroNode>
    );
  },
  {
    measure: ({ children: items, gap = PANEL_GAP }: PanelStackProps, available: number) => {
      const sizes = children(items).map((child) => measureElement(child, available));
      // As wide as its widest item, so a stack can sit in a row.
      const width = Math.min(available, Math.max(0, ...sizes.map((size) => size.width)));
      return { width, height: stackLayout(sizes.map((size) => size.height), 0, gap).height };
    },
  }
);

export type PanelRowProps = {
  children: React.ReactNode;
  gap?: number;
};

/** Items side by side, centred, sharing the row's height. */
export const PanelRow: Measurable<PanelRowProps> = Object.assign(
  function PanelRow({ children: items, gap = PANEL_GAP }: PanelRowProps) {
    const body = useContext(PanelBodyContext);
    const width = body?.width ?? 1;
    const list = children(items);
    const xs = rowLayout(list.map((child) => measureElement(child, width).width), width, gap);
    return (
      <ViroNode>
        {list.map((child, index) => (
          <ViroNode key={child.key ?? index} position={[xs[index] ?? 0, 0, 0]}>
            {child}
          </ViroNode>
        ))}
      </ViroNode>
    );
  },
  {
    measure: ({ children: items }: PanelRowProps, available: number) => ({
      width: available,
      height: Math.max(0, ...children(items).map((child) => measureElement(child, available).height)),
    }),
  }
);

export type PanelLabelProps = {
  text: string;
  variant?: PanelTextVariant;
  /** Wrap into a paragraph this wide; defaults to the available width. */
  wrap?: boolean;
  width?: number;
  color?: string;
};

/** A line or paragraph of text sized by variant. */
export const PanelLabel: Measurable<PanelLabelProps> = Object.assign(
  function PanelLabel({ text, variant = "label", wrap = false, width, color = "#F7F8FC" }: PanelLabelProps) {
    const body = useContext(PanelBodyContext);
    const w = width ?? body?.width ?? 0.8;
    const h = wrap ? paragraphHeight(text, w, variant) : PANEL_TYPE[variant].lineHeight;
    return (
      <ViroText
        text={text}
        width={w}
        height={h}
        color={color}
        style={{
          fontSize: PANEL_TYPE[variant].fontSize,
          textAlign: wrap || width !== undefined ? "left" : "center",
          textAlignVertical: "top",
        }}
      />
    );
  },
  {
    measure: ({ text, variant = "label", wrap = false, width }: PanelLabelProps, available: number) => {
      const w = width ?? available;
      return {
        // A single line without a set width does not widen its container.
        width: width ?? (wrap ? available : 0),
        height: wrap ? paragraphHeight(text, w, variant) : PANEL_TYPE[variant].lineHeight,
      };
    },
  }
);

export type PanelSurfaceProps = {
  width: number;
  height: number;
  children?: React.ReactNode;
};

/** A raised tile with content centred on it. */
export const PanelSurface: Measurable<PanelSurfaceProps> = Object.assign(
  function PanelSurface({ width, height, children: content }: PanelSurfaceProps) {
    registerPremiumMaterials();
    return (
      <ViroNode>
        <ViroQuad width={width} height={height} materials={[PremiumMaterials.header]} />
        <ViroNode position={[0, 0, 0.004]}>{content}</ViroNode>
      </ViroNode>
    );
  },
  { measure: ({ width, height }: PanelSurfaceProps) => ({ width, height }) }
);
