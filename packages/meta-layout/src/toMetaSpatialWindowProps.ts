import type { SpatialSurfaceIntent } from "@viro-external/xr-contract";
import { spatialPriorityValue } from "@viro-external/xr-contract";

/** Anchor edges `toMetaSpatialWindowProps` can emit. */
export type MetaAnchor =
  | "center"
  | "start"
  | "end"
  | "left"
  | "right"
  | "top"
  | "bottom";

/** Props produced by {@linkcode toMetaSpatialWindowProps}. */
export type MetaSpatialWindowProps = {
  label: string;
  windowWidth: number;
  windowHeight: number;
  priority: number;
  promotable: boolean;
  anchor: MetaAnchor;
  fallback: "inline" | "drop";
};

function anchorFor(intent: SpatialSurfaceIntent): MetaAnchor {
  switch (intent.placement) {
    case "start":
    case "end":
    case "top":
    case "bottom":
    case "center":
      return intent.placement;
    case "user":
      return "center";
    default:
      // Keep slot continuity when no placement is given:
      // master = start, inspector = end, everything else = center.
      if (intent.role === "master") return "start";
      if (intent.role === "inspector") return "end";
      return "center";
  }
}

/**
 * Maps one legacy `SpatialSurfaceIntent` to `<SpatialWindow>` props. It does
 * no arbitration; for a whole workspace use `resolveMetaWorkspace`.
 */
export function toMetaSpatialWindowProps(
  intent: SpatialSurfaceIntent
): MetaSpatialWindowProps {
  const size = intent.preferredSize ?? { width: 360, height: 480 };

  return {
    label: intent.id,
    windowWidth: size.width,
    windowHeight: size.height,
    priority: spatialPriorityValue(intent.priority),
    promotable: intent.promotable ?? true,
    anchor: anchorFor(intent),
    fallback: intent.fallback,
  };
}
