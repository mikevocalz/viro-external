import React, { createContext, useContext, useState } from "react";
import { ScaledViroText } from "./ScaledViroText";
import { PanelButton } from "./PanelButton";
import { ViroNode, ViroQuad } from "@reactvision/react-viro";
import {
  PANEL_GAP,
  PANEL_TYPE,
  SCROLLBAR_STRIP,
  paragraphHeight,
  rowLayout,
  stackLayout,
  type PanelBody,
  type PanelTextVariant,
} from "./layout";
import { PremiumMaterials, RenderOrder, registerPremiumMaterials } from "./materials";

/** The content area of the enclosing SpatialPanel, set by the panel. */
export const PanelBodyContext = createContext<PanelBody | null>(null);

/** True inside a PanelStack or PanelRow, whose children are placed by it. */
const NestedStackContext = createContext(false);

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
 * A panel's own stack taller than the body scrolls, as on Specs: same
 * scrollbar strip, same measuring width.
 */
export const PanelStack: Measurable<PanelStackProps> = Object.assign(
  function PanelStack({ children: items, gap = PANEL_GAP }: PanelStackProps) {
    const body = useContext(PanelBodyContext) ?? { centerY: 0, width: 1, height: 1 };
    const nested = useContext(NestedStackContext);
    const list = children(items);
    if (!nested && overflows(list, body, gap)) {
      return <ScrollingStack list={list} body={body} gap={gap} />;
    }
    const sizes = list.map((child) => measureElement(child, body.width));
    const heights = sizes.map((size) => size.height);
    // The panel's own stack starts at the body's top edge. A stack placed by
    // a parent stack or row is centred on its origin, as the Specs mapper does.
    const top = nested ? stackLayout(heights, 0, gap).height / 2 : body.centerY + body.height / 2;
    const { centers } = stackLayout(heights, top, gap);
    return (
      <NestedStackContext.Provider value={true}>
        <ViroNode>
          {list.map((child, index) => (
            <ViroNode key={child.key ?? index} position={[0, centers[index] ?? 0, 0]}>
              {child}
            </ViroNode>
          ))}
        </ViroNode>
      </NestedStackContext.Provider>
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

function overflows(list: React.ReactElement[], body: PanelBody, gap: number): boolean {
  const width = body.width - SCROLLBAR_STRIP;
  const heights = list.map((child) => measureElement(child, width).height);
  return stackLayout(heights, 0, gap).height > body.height + 1e-6;
}

/** How many items from `start` fit in `height`; always at least one. */
function fitCount(heights: readonly number[], start: number, height: number, gap: number): number {
  let used = 0;
  let count = 0;
  for (let i = start; i < heights.length; i += 1) {
    const next = used + (count > 0 ? gap : 0) + heights[i]!;
    if (count > 0 && next > height + 1e-6) break;
    used = next;
    count += 1;
  }
  return count;
}

/**
 * A panel stack taller than its body, scrolled one item per step with up and
 * down buttons and a thumb in a strip on the right.
 * ponytail: items that do not fully fit are hidden, not clipped; Viro has no
 * rect clip. Shader-modifier clipping would allow partial items and smooth
 * drag scrolling.
 */
function ScrollingStack({ list, body, gap }: { list: React.ReactElement[]; body: PanelBody; gap: number }) {
  registerPremiumMaterials();
  const [start, setStart] = useState(0);
  const width = body.width - SCROLLBAR_STRIP;
  const heights = list.map((child) => measureElement(child, width).height);
  const total = stackLayout(heights, 0, gap).height;
  // The first start index from which every remaining item fits.
  let maxStart = 0;
  while (maxStart < list.length - 1 && maxStart + fitCount(heights, maxStart, body.height, gap) < list.length) {
    maxStart += 1;
  }
  const first = Math.min(start, maxStart);
  const count = fitCount(heights, first, body.height, gap);
  const top = body.centerY + body.height / 2;
  const shown = heights.slice(first, first + count);
  const { centers, height: shownHeight } = stackLayout(shown, top, gap);

  const stripX = body.width / 2 - SCROLLBAR_STRIP / 2;
  const button = SCROLLBAR_STRIP;
  const track = Math.max(0.04, body.height - button * 2 - 0.02);
  const thumb = Math.max(0.03, track * Math.min(1, shownHeight / total));
  const progress = maxStart === 0 ? 0 : first / maxStart;
  const thumbY = body.centerY + track / 2 - thumb / 2 - progress * (track - thumb);

  return (
    <NestedStackContext.Provider value={true}>
      <PanelBodyContext.Provider value={{ ...body, width }}>
        <ViroNode position={[-SCROLLBAR_STRIP / 2, 0, 0]}>
          {list.slice(first, first + count).map((child, index) => (
            <ViroNode key={child.key ?? first + index} position={[0, centers[index] ?? 0, 0]}>
              {child}
            </ViroNode>
          ))}
        </ViroNode>
      </PanelBodyContext.Provider>
      <PanelButton
        label="▲"
        width={button}
        height={button}
        position={[stripX, top - button / 2, 0.004]}
        disabled={first === 0}
        onPress={() => setStart(Math.max(0, first - 1))}
      />
      <PanelButton
        label="▼"
        width={button}
        height={button}
        position={[stripX, body.centerY - body.height / 2 + button / 2, 0.004]}
        disabled={first >= maxStart}
        onPress={() => setStart(Math.min(maxStart, first + 1))}
      />
      <ViroQuad
        position={[stripX, body.centerY, 0.002]}
        width={0.012}
        height={track}
        materials={[PremiumMaterials.rail]}
        renderingOrder={RenderOrder.backing}
      />
      <ViroQuad
        position={[stripX, thumbY, 0.004]}
        width={0.022}
        height={thumb}
        materials={[PremiumMaterials.thumb]}
      />
    </NestedStackContext.Provider>
  );
}

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
      <NestedStackContext.Provider value={true}>
        <ViroNode>
          {list.map((child, index) => (
            <ViroNode key={child.key ?? index} position={[xs[index] ?? 0, 0, 0]}>
              {child}
            </ViroNode>
          ))}
        </ViroNode>
      </NestedStackContext.Provider>
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
      <ScaledViroText
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
        <ViroQuad width={width} height={height} materials={[PremiumMaterials.header]} renderingOrder={RenderOrder.backing} />
        <ViroNode position={[0, 0, 0.004]}>{content}</ViroNode>
      </ViroNode>
    );
  },
  { measure: ({ width, height }: PanelSurfaceProps) => ({ width, height }) }
);
