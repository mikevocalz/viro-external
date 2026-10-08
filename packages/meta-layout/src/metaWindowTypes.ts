/**
 * Structural mirrors of the `@metavr/layout-window-compat` 1.0.0 public types.
 *
 * This package stays free of the native SDK so it can run in tests, on web
 * and in non-Horizon builds; the app passes these values straight to
 * `<SpatialWindow>`. Each type below names the `.d.ts` symbol it mirrors in
 * the 1.0.0 tarball. Keep them 1:1 with Meta's shapes; do not re-encode.
 */

/** Mirrors `SpatialAnchor.d.ts` `AnchorHorizontal`. `start`/`end` mirror in RTL, `left`/`right` never do. */
export type MetaAnchorHorizontal = "start" | "end" | "left" | "right";

/** Mirrors `SpatialAnchor.d.ts` `AnchorVertical`. */
export type MetaAnchorVertical = "top" | "bottom";

/** Mirrors `SpatialAnchor.d.ts` `AnchorEdge`. */
export type MetaAnchorEdge = MetaAnchorHorizontal | MetaAnchorVertical;

/** Mirrors `SpatialAnchor.d.ts` `AnchorPointSpec`. */
export type MetaAnchorPointSpec = Readonly<{
  horizontal?: MetaAnchorHorizontal | undefined;
  vertical?: MetaAnchorVertical | undefined;
}>;

/** Mirrors `SpatialAnchor.d.ts` `AnchorPoint`. */
export type MetaAnchorPoint = MetaAnchorEdge | "center" | MetaAnchorPointSpec;

/**
 * Mirrors `SpatialAnchor.d.ts` `AnchorPair`: the point on the main window
 * (`parent`) that the point on this window (`child`) is pinned to. Each side
 * is taken literally, with no mirroring.
 */
export type MetaAnchorPair = Readonly<{
  parent: MetaAnchorPoint;
  child: MetaAnchorPoint;
}>;

/** Mirrors `SpatialAnchor.d.ts` `Anchor`, the `anchor` prop of `<SpatialWindow>`. */
export type MetaWindowAnchor = MetaAnchorPoint | MetaAnchorPair;

/** Mirrors `SpatialOffset.d.ts` `OffsetStepValue`. One step is about 8 dp. */
export type MetaOffsetStep = -5 | -4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4 | 5;

/** Mirrors `SpatialOffset.d.ts` `NeutralOffset`. `+y` is up, `+z` is toward the user. */
export type MetaNeutralOffset = Readonly<{
  y?: MetaOffsetStep | undefined;
  z?: MetaOffsetStep | undefined;
}>;

/** Mirrors `SpatialOffset.d.ts` `PhysicalOffset`. `+x` is leftward. */
export type MetaPhysicalOffset = Readonly<Omit<MetaNeutralOffset, "x"> & { x: MetaOffsetStep }>;

/** Mirrors `SpatialOffset.d.ts` `LogicalOffset`. `+start` is toward layout start. */
export type MetaLogicalOffset = Readonly<Omit<MetaNeutralOffset, "start"> & { start: MetaOffsetStep }>;

/** Mirrors `SpatialOffset.d.ts` `Offset`, the `offset` prop of `<SpatialWindow>`. */
export type MetaOffset = MetaNeutralOffset | MetaPhysicalOffset | MetaLogicalOffset;

/**
 * Values of the `SpatialOffset.d.ts` constants `OffsetNone` (0), `OffsetNear`
 * (1), `OffsetMidNear` (2), `OffsetMid` (3), `OffsetMidFar` (4) and
 * `OffsetFar` (5).
 */
export const META_OFFSET_STEPS = {
  none: 0,
  near: 1,
  midNear: 2,
  mid: 3,
  midFar: 4,
  far: 5,
} as const satisfies Record<string, MetaOffsetStep>;

/** Mirrors `SpatialWindowProps.d.ts` `SpatialWindowFallback`. */
export type MetaWindowFallback = "inline" | "drop";

/** Mirrors `SpatialWindowProps.d.ts` `SpatialWindowDimension`: dp, or a percentage of the main window. */
export type MetaWindowDimension = number | `${string}%`;

/** Mirrors `SpatialWindowStateCache.d.ts` `SpatialWindowPlacement`, as returned by `useSpatialWindowState`. */
export type MetaWindowPlacement = "inline" | "spatial" | "pending" | "dropped";

/**
 * The props of `SpatialWindowProps.d.ts` `SpatialWindowProps` without
 * `children`, with every field the resolver decides made explicit. Spread it
 * onto `<SpatialWindow>`. Produced by `resolveMetaWorkspace`.
 */
export type MetaWindowProps = Readonly<{
  label: string;
  windowWidth: MetaWindowDimension;
  windowHeight: MetaWindowDimension;
  priority: number;
  promotable: boolean;
  fallback: MetaWindowFallback;
  anchor: MetaWindowAnchor;
  /** Absent when the surface sits flush with the main window. */
  offset?: MetaOffset;
}>;
