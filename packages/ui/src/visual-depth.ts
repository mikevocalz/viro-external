export type XRVisualWeight = "subtle" | "standard" | "strong" | "hero";

export type XRVisualDepth = {
  weight?: XRVisualWeight;
  elevation?: number;
  edge?: boolean;
  highlight?: boolean;
  pressedScale?: number;
};

export const XR_VISUAL_WEIGHT: Record<XRVisualWeight, {
  edgeScale: number;
  edgeOffset: number;
  highlightOpacity: number;
}> = {
  subtle: { edgeScale: 1.012, edgeOffset: -0.006, highlightOpacity: 0.18 },
  standard: { edgeScale: 1.022, edgeOffset: -0.008, highlightOpacity: 0.28 },
  strong: { edgeScale: 1.035, edgeOffset: -0.012, highlightOpacity: 0.38 },
  hero: { edgeScale: 1.05, edgeOffset: -0.016, highlightOpacity: 0.5 },
};

export function resolveVisualDepth(depth: XRVisualDepth = {}) {
  const weight = depth.weight ?? "standard";
  return {
    ...XR_VISUAL_WEIGHT[weight],
    elevation: depth.elevation ?? 0.012,
    edge: depth.edge ?? true,
    highlight: depth.highlight ?? true,
    pressedScale: depth.pressedScale ?? 0.97,
  };
}
