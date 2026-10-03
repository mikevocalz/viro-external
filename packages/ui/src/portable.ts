/**
 * Maps @viro-external/ui JSX to the portable XR scene, so the same panel tree
 * that renders natively through Viro renders on Specs through Lens Studio.
 *
 * The walk reads elements and props; it never renders, so hooks and native
 * modules do not run. Placement comes from layout.ts and each component's
 * `measure`, the same functions the native components use.
 */
import React from "react";
import { Viro3DObject, ViroImage, ViroNode, ViroPolyline, ViroText } from "@reactvision/react-viro";
import type { PortableXRNode } from "@viro-external/xr-contract";
import {
  PANEL_TYPE,
  panelBody,
  panelHasHeader,
  panelHeader,
  rowLayout,
  stackLayout,
  type PanelTextVariant,
} from "./layout";
import {
  measureElement,
  PanelLabel,
  PanelRow,
  PanelStack,
  PanelSurface,
  type PanelLabelProps,
  type PanelRowProps,
  type PanelStackProps,
  type PanelSurfaceProps,
} from "./PanelLayout";
import {
  barChartLayout,
  PanelBarChart,
  PanelStat,
  type PanelBarChartProps,
  type PanelStatProps,
} from "./PanelData";
import { PanelImage, PanelText, type PanelImageProps, type PanelTextProps } from "./PanelContent";
import { SpatialPanel, type SpatialPanelProps } from "./SpatialPanel";
import { RivePanel, type RivePanelProps } from "./RivePanel";
import { IDENTITY, composeTransform, degreesToQuaternion, transformPoint, type Transform, type Vec3 } from "./transform";
import {
  SpatialVideoPlayerPanel,
  VideoPlayerPanel,
  type VideoPlayerPanelProps,
} from "./VideoPlayerPanel";

type Color = [number, number, number, number];

/** Depth of each layer in front of its parent, in meters. */
const Z = { surface: 0.008, image: 0.01, text: 0.016 } as const;
/** PremiumMaterials header/button/thumb as linear RGBA, for surfaces on Specs. */
const TILE: Color = [0.13, 0.145, 0.19, 0.96];
/** PremiumMaterials.panel (#181B24, 95% alpha); Frame's own chrome draws almost nothing alone. */
const PANEL: Color = [0.094, 0.106, 0.141, 0.95];
const PANEL_CORNER = 0.02;
const BAR: Color = [0.36, 0.62, 0.98, 1];
const BAR_PEAK: Color = [0.98, 0.72, 0.3, 1];

export type PortableSourceKind = "image" | "video" | "model";

/** A ViroAnimations registration: `{ properties, duration, delay, easing }`. */
export type PortableAnimationDefinition = {
  properties?: Record<string, number | string | undefined>;
  duration?: number;
  delay?: number;
  easing?: string;
};

export type ToPortableOptions = {
  /** Parent node id for the top-level elements. */
  parentId?: string;
  /** Turn a native source (`{ uri }`, a string, a Mux source) into a registry id. */
  resolveSource?: (source: unknown, kind: PortableSourceKind) => string | undefined;
  /**
   * The animations the scene registers with ViroAnimations, by name. The
   * mapper reads elements without rendering them, so it cannot see the
   * registry; pass the same object you register.
   */
  animations?: Record<string, PortableAnimationDefinition>;
};

/** A volumetric route line, in world space (Lens `VolumetricLine`). */
export type PortablePolyline = {
  id: string;
  primitive: "volumetric-line";
  backendPackage: "VolumetricLine";
  points: Vec3[];
  radiusMeters: number;
  materialId?: string;
};

/** Hover/select/drag wiring for a node (Lens SIK Interactable). */
export type PortableInteraction = {
  nodeId: string;
  interactable: true;
  manipulation: boolean;
  events: ("hover" | "select" | "drag")[];
};

/** A Lens AnimationPlayer plan built from a ViroAnimations registration. */
export type PortableAnimation = {
  nodeId: string;
  name: string;
  plan: {
    engine: "AnimationPlayer";
    backendPackage: "AnimationExamples";
    durationSeconds: number;
    delaySeconds: number;
    easing: "linear" | "ease-in" | "ease-out" | "ease-in-out";
    playbackMode: "loop" | "single";
    completionEvent: string;
    tracks: { target: string; from: "current"; to: number }[];
  };
};

/** A Rive panel the build must bake before the scene runs on Specs. */
export type PortableRiveBake = {
  /** The rive node to fill with the baked texture id and clip ranges. */
  nodeId: string;
  file: string;
  artboard?: string;
  clips: { name: string; animation: string; loop: boolean }[];
  resolution?: number;
};

export type PortableSceneResult = {
  nodes: PortableXRNode[];
  riveBakes: PortableRiveBake[];
  polylines: PortablePolyline[];
  interactions: PortableInteraction[];
  animations: PortableAnimation[];
  diagnostics: string[];
};

/** Where an element is being placed: its parent and its centre in that parent. */
type Place = {
  parentId?: string;
  origin: Vec3;
  /** Width available to children that size to their container. */
  width: number;
  /** World transform of the parent node, for content Lens draws in world space. */
  world: Transform;
  /** Inside a panel, which Frame billboards and the user can move. */
  inPanel?: boolean;
};

type Context = PortableSceneResult & {
  ids: Map<string, number>;
  resolveSource: NonNullable<ToPortableOptions["resolveSource"]>;
  animationRegistry: NonNullable<ToPortableOptions["animations"]>;
};

type Mapper<P> = (props: P, place: Place, ctx: Context, element: React.ReactElement) => void;

const MAPPERS = new Map<unknown, Mapper<any>>();

/**
 * Register how a component appears on Specs. Your own components can opt in
 * the same way the built-in ones do below.
 */
export function definePortable<P>(component: unknown, mapper: Mapper<P>): void {
  MAPPERS.set(component, mapper);
}

/** Map a JSX tree (or array of trees) to portable nodes for Specs. */
export function toPortableScene(
  tree: React.ReactNode,
  options: ToPortableOptions = {}
): PortableSceneResult {
  const ctx: Context = {
    nodes: [],
    riveBakes: [],
    polylines: [],
    interactions: [],
    animations: [],
    diagnostics: [],
    ids: new Map(),
    resolveSource: options.resolveSource ?? defaultResolveSource,
    animationRegistry: options.animations ?? {},
  };
  for (const element of elements(tree)) {
    mapElement(
      element,
      { parentId: options.parentId, origin: [0, 0, 0], width: 1, world: IDENTITY },
      ctx
    );
  }
  const { nodes, riveBakes, polylines, interactions, animations, diagnostics } = ctx;
  return { nodes, riveBakes, polylines, interactions, animations, diagnostics };
}

function defaultResolveSource(source: unknown): string | undefined {
  if (typeof source === "string") return source;
  // A bundled `require()` asset, named the way the fork's compiler names it.
  if (typeof source === "number") return "react-native-asset:" + source;
  if (source && typeof source === "object") {
    const s = source as { uri?: string; url?: string; playbackId?: string };
    return s.uri ?? s.url ?? s.playbackId;
  }
  return undefined;
}

function elements(tree: React.ReactNode): React.ReactElement[] {
  return React.Children.toArray(tree).filter(React.isValidElement);
}

function mapElement(element: React.ReactElement, place: Place, ctx: Context): void {
  // Fragments carry no placement of their own.
  if (element.type === React.Fragment) {
    for (const child of elements((element.props as { children?: React.ReactNode }).children)) {
      mapElement(child, place, ctx);
    }
    return;
  }
  const mapper = MAPPERS.get(element.type);
  if (!mapper) {
    const name =
      typeof element.type === "string"
        ? element.type
        : (element.type as { displayName?: string; name?: string }).displayName ??
          (element.type as { name?: string }).name ??
          "anonymous";
    ctx.diagnostics.push("No Specs mapping for <" + name + ">; it is left out of the Specs scene.");
    return;
  }
  mapper(element.props, place, ctx, element);
}

function nodeId(ctx: Context, element: React.ReactElement, prefix: string): string {
  const props = element.props as { viroTag?: string; tag?: string };
  // Children.toArray rewrites keys: ".$key" for keys the author set, ".0" for
  // positional ones. Only an author's key is a stable id.
  const key = element.key != null ? String(element.key) : undefined;
  const authored = key?.startsWith(".$") ? key.slice(2) : key && !key.startsWith(".") ? key : undefined;
  const explicit = props.viroTag ?? props.tag ?? authored;
  if (explicit) return explicit;
  const n = (ctx.ids.get(prefix) ?? 0) + 1;
  ctx.ids.set(prefix, n);
  return prefix + "-" + n;
}

function at(origin: Vec3, dx: number, dy: number, z: number): Vec3 {
  return [origin[0] + dx, origin[1] + dy, origin[2] + z];
}

function text(
  ctx: Context,
  id: string,
  parentId: string | undefined,
  value: string,
  position: Vec3,
  variant: PanelTextVariant,
  wrapWidthMeters?: number
): void {
  const s = PANEL_TYPE[variant].specsScale;
  ctx.nodes.push({
    id,
    kind: "text",
    text: value,
    position,
    scale: [s, s, s],
    ...(parentId ? { parentId } : {}),
    ...(wrapWidthMeters !== undefined ? { wrapWidthMeters } : {}),
  });
}

function surface(
  ctx: Context,
  id: string,
  parentId: string | undefined,
  position: Vec3,
  size: [number, number],
  tint: Color,
  cornerRadiusMeters: number
): void {
  ctx.nodes.push({
    id,
    kind: "surface",
    position,
    sizeMeters: size,
    tint,
    cornerRadiusMeters,
    ...(parentId ? { parentId } : {}),
  });
}

/** Place a column of children from a top edge; returns the height used. */
function mapColumn(
  items: React.ReactNode,
  place: Place,
  top: number,
  gap: number | undefined,
  ctx: Context
): number {
  const list = elements(items);
  const heights = list.map((child) => measureElement(child, place.width).height);
  const { centers, height } = stackLayout(heights, top, gap);
  list.forEach((child, index) => {
    mapElement(
      child,
      { ...place, origin: [place.origin[0], centers[index] ?? 0, place.origin[2]] },
      ctx
    );
  });
  return height;
}

definePortable<SpatialPanelProps>(SpatialPanel, (props, place, ctx, element) => {
  const width = props.width ?? 1.6;
  const height = props.height ?? 1;
  const id = nodeId(ctx, element, "panel");
  ctx.nodes.push({
    id,
    kind: "panel",
    position: (props.position as Vec3 | undefined) ?? place.origin,
    sizeMeters: [width, height],
    tint: PANEL,
    cornerRadiusMeters: PANEL_CORNER,
    ...(place.parentId ? { parentId: place.parentId } : {}),
  });

  const panelWorld = composeTransform(place.world, {
    position: (props.position as Vec3 | undefined) ?? place.origin,
  });
  const hasHeader = panelHasHeader(props);
  if (hasHeader) {
    const { titleY, subtitleY } = panelHeader(height);
    if (props.title) text(ctx, id + "-title", id, props.title, [0, titleY, Z.text], "title");
    if (props.subtitle) text(ctx, id + "-subtitle", id, props.subtitle, [0, subtitleY, Z.text], "caption");
  }

  const body = panelBody(width, height, hasHeader);
  const children = elements(props.children);
  // A single PanelStack taller than the body scrolls; anything else is placed as is.
  const stack = children.length === 1 && children[0]!.type === PanelStack ? children[0]! : null;
  const scrollbarStrip = 0.04;
  const contentWidth = body.width - scrollbarStrip;
  const contentHeight = stack ? measureElement(stack, contentWidth).height : 0;

  if (stack && contentHeight > body.height) {
    const scrollId = id + "-scroll";
    ctx.nodes.push({
      id: scrollId,
      kind: "scroll",
      parentId: id,
      position: [-scrollbarStrip / 2, body.centerY, 0.004],
      sizeMeters: [contentWidth, body.height],
      contentHeightMeters: contentHeight,
    });
    const stackProps = stack.props as PanelStackProps;
    mapColumn(
      stackProps.children,
      { parentId: scrollId, origin: [0, 0, 0], width: contentWidth, world: panelWorld, inPanel: true },
      contentHeight / 2,
      stackProps.gap,
      ctx
    );
    return;
  }

  const inner: Place = {
    parentId: id,
    origin: [0, body.centerY, 0],
    width: body.width,
    world: panelWorld,
    inPanel: true,
  };
  for (const child of children) {
    if (child.type === PanelStack) {
      const stackProps = child.props as PanelStackProps;
      mapColumn(stackProps.children, inner, body.centerY + body.height / 2, stackProps.gap, ctx);
    } else {
      mapElement(child, inner, ctx);
    }
  }
});

definePortable<PanelStackProps>(PanelStack, (props, place, ctx) => {
  const height = measureElement(React.createElement(PanelStack, props), place.width).height;
  mapColumn(props.children, place, place.origin[1] + height / 2, props.gap, ctx);
});

definePortable<PanelRowProps>(PanelRow, (props, place, ctx) => {
  const list = elements(props.children);
  const xs = rowLayout(list.map((child) => measureElement(child, place.width).width), place.width, props.gap);
  list.forEach((child, index) => {
    mapElement(child, { ...place, origin: at(place.origin, xs[index] ?? 0, 0, 0) }, ctx);
  });
});

definePortable<PanelLabelProps>(PanelLabel, (props, place, ctx, element) => {
  const variant = props.variant ?? "label";
  const id = nodeId(ctx, element, "label");
  // A paragraph, or a line given a width, is left-aligned in its box. Lens
  // lays wrapped text from the top-left corner downward.
  if (props.wrap || props.width !== undefined) {
    const { width, height } = PanelLabel.measure(props, place.width);
    text(ctx, id, place.parentId, props.text, at(place.origin, -width / 2, height / 2, Z.text), variant, width);
    return;
  }
  text(ctx, id, place.parentId, props.text, at(place.origin, 0, 0, Z.text), variant);
});

definePortable<PanelTextProps>(PanelText, (props, place, ctx, element) => {
  text(ctx, nodeId(ctx, element, "text"), place.parentId, props.text,
    at(place.origin, props.position?.[0] ?? 0, props.position?.[1] ?? 0, Z.text), "label");
});

definePortable<PanelImageProps>(PanelImage, (props, place, ctx, element) => {
  const id = nodeId(ctx, element, "image");
  const source = ctx.resolveSource(props.source, "image");
  if (!source) {
    ctx.diagnostics.push("PanelImage " + id + " has no Specs source id; pass resolveSource for bundled assets.");
    return;
  }
  ctx.nodes.push({
    id,
    kind: "image",
    source,
    fit: "cover",
    position: at(place.origin, props.position?.[0] ?? 0, props.position?.[1] ?? 0, Z.image),
    sizeMeters: [props.width, props.height],
    ...(place.parentId ? { parentId: place.parentId } : {}),
  });
});

definePortable<PanelSurfaceProps>(PanelSurface, (props, place, ctx, element) => {
  const id = nodeId(ctx, element, "surface");
  surface(ctx, id, place.parentId, at(place.origin, 0, 0, Z.surface), [props.width, props.height], TILE, 0.012);
  for (const child of elements(props.children)) {
    mapElement(child, { ...place, width: props.width }, ctx);
  }
});

definePortable<PanelBarChartProps>(PanelBarChart, (props, place, ctx, element) => {
  const id = nodeId(ctx, element, "chart");
  barChartLayout(props).forEach((bar, i) => {
    const bid = id + "-bar-" + i;
    surface(ctx, bid, place.parentId, at(place.origin, bar.x, bar.barY, Z.image),
      [bar.barWidth, bar.barHeight], props.highlightPeak !== false && bar.isPeak ? BAR_PEAK : BAR, 0.004);
    text(ctx, bid + "-value", place.parentId, String(bar.value), at(place.origin, bar.x, bar.valueY, Z.text), "caption");
    text(ctx, bid + "-label", place.parentId, bar.label, at(place.origin, bar.x, bar.labelY, Z.text), "caption");
  });
});

definePortable<PanelStatProps>(PanelStat, (props, place, ctx, element) => {
  const id = nodeId(ctx, element, "stat");
  const height = props.height ?? 0.11;
  surface(ctx, id, place.parentId, at(place.origin, 0, 0, Z.surface), [props.width, height], TILE, 0.012);
  text(ctx, id + "-value", place.parentId, props.value, at(place.origin, 0, 0.014, Z.text), "figure");
  text(ctx, id + "-caption", place.parentId, props.caption, at(place.origin, 0, -0.03, Z.text), "caption");
});

/**
 * A video panel on Specs: a Frame the video sits in, with the runtime's
 * controls. The video fits its source's aspect inside the box and the panel
 * wraps it, portrait or landscape.
 */
const mapVideoPanel: Mapper<VideoPlayerPanelProps> = (props, place, ctx, element) => {
  const id = nodeId(ctx, element, "video-panel");
  const width = props.width ?? 1.8;
  const height = props.height ?? 1.18;
  const source = ctx.resolveSource(props.source, "video");
  if (!source) {
    ctx.diagnostics.push("Video panel " + id + " has no Specs source id; pass resolveSource for this source.");
    return;
  }
  ctx.nodes.push({
    id,
    kind: "panel",
    position: (props.position as Vec3 | undefined) ?? place.origin,
    sizeMeters: [width, height],
    tint: PANEL,
    cornerRadiusMeters: PANEL_CORNER,
    ...(place.parentId ? { parentId: place.parentId } : {}),
  });
  ctx.nodes.push({
    id: id + "-video",
    kind: "video",
    parentId: id,
    source,
    fit: "contain",
    controls: true,
    position: [0, 0, Z.image],
    sizeMeters: [width, height],
  });
};
definePortable(VideoPlayerPanel, mapVideoPanel);
// The player-driven variant has no source prop; it maps only when given one.
definePortable(SpatialVideoPlayerPanel, mapVideoPanel);

/**
 * Plain Viro primitives. Nodes keep their local transform and a parentId, as
 * the fork's compiler emits them; only polylines are baked to world space,
 * because Lens draws a route line in world space.
 */
type ViroProps = {
  viroTag?: string;
  position?: Vec3;
  rotation?: Vec3;
  scale?: Vec3;
  visible?: boolean;
  text?: string;
  source?: unknown;
  points?: Vec3[];
  thickness?: number;
  materials?: string | string[];
  onHover?: unknown;
  onClick?: unknown;
  onClickState?: unknown;
  onDrag?: unknown;
  animation?: { name?: string; run?: boolean; loop?: boolean; delay?: number };
  children?: React.ReactNode;
};

const EASING: Record<string, PortableAnimation["plan"]["easing"]> = {
  linear: "linear",
  easein: "ease-in",
  "ease-in": "ease-in",
  easeout: "ease-out",
  "ease-out": "ease-out",
  easeineaseout: "ease-in-out",
  "ease-in-out": "ease-in-out",
};

const ANIMATION_TARGET: Record<string, string> = {
  positionX: "transform.position.x",
  positionY: "transform.position.y",
  positionZ: "transform.position.z",
  scaleX: "transform.scale.x",
  scaleY: "transform.scale.y",
  scaleZ: "transform.scale.z",
  rotateX: "transform.rotation.x",
  rotateY: "transform.rotation.y",
  rotateZ: "transform.rotation.z",
  opacity: "material.opacity",
};

function viroPlacement(props: ViroProps, place: Place) {
  const rotation = degreesToQuaternion(props.rotation);
  return {
    // Inside a panel layout, a primitive without its own position sits where
    // the layout put it.
    position: props.position ?? (place.inPanel ? place.origin : undefined),
    ...(rotation ? { rotation } : {}),
    ...(props.scale ? { scale: props.scale } : {}),
    ...(props.visible !== undefined ? { visible: props.visible } : {}),
    ...(place.parentId ? { parentId: place.parentId } : {}),
  };
}

function collectBehaviour(id: string, props: ViroProps, ctx: Context): void {
  const hover = Boolean(props.onHover);
  const select = Boolean(props.onClick || props.onClickState);
  const drag = Boolean(props.onDrag);
  if (hover || select || drag) {
    ctx.interactions.push({
      nodeId: id,
      interactable: true,
      manipulation: drag,
      events: [
        ...(hover ? (["hover"] as const) : []),
        ...(select ? (["select"] as const) : []),
        ...(drag ? (["drag"] as const) : []),
      ],
    });
  }

  const animation = props.animation;
  if (!animation?.name || animation.run === false) return;
  const registered = ctx.animationRegistry[animation.name];
  if (!registered) {
    ctx.diagnostics.push(
      "Animation " + animation.name + " on " + id + " is not in the `animations` passed to the mapper."
    );
    return;
  }
  const easing = EASING[String(registered.easing ?? "linear").toLowerCase()];
  if (!easing) {
    ctx.diagnostics.push("Animation " + animation.name + " uses easing " + registered.easing + ", which Specs does not have.");
    return;
  }
  const tracks: PortableAnimation["plan"]["tracks"] = [];
  for (const [property, value] of Object.entries(registered.properties ?? {})) {
    if (value === undefined) continue;
    const target = ANIMATION_TARGET[property];
    if (!target) {
      ctx.diagnostics.push("Animation " + animation.name + " property " + property + " has no Specs equivalent.");
      continue;
    }
    // ponytail: absolute values only; "+=0.1" style values need the node's
    // current value, which the fork's static compiler resolves. Add it here if
    // a scene needs relative tracks.
    if (typeof value !== "number") {
      ctx.diagnostics.push("Animation " + animation.name + " property " + property + " is relative (" + value + "); use an absolute value for Specs.");
      continue;
    }
    tracks.push({ target, from: "current", to: value });
  }
  if (!tracks.length) return;
  ctx.animations.push({
    nodeId: id,
    name: animation.name,
    plan: {
      engine: "AnimationPlayer",
      backendPackage: "AnimationExamples",
      durationSeconds: (registered.duration ?? 0) / 1000,
      delaySeconds: ((registered.delay ?? 0) + (animation.delay ?? 0)) / 1000,
      easing,
      playbackMode: animation.loop ? "loop" : "single",
      completionEvent: "viro-animation-complete:" + id + ":" + animation.name,
      tracks,
    },
  });
}

function mapViro(kind: "group" | "text" | "image" | "model"): Mapper<ViroProps> {
  return (props, place, ctx, element) => {
    const id = nodeId(ctx, element, "viro-" + kind);
    const base = { id, ...viroPlacement(props, place) };
    if (kind === "text") {
      ctx.nodes.push({ ...base, kind, text: props.text ?? "" });
    } else if (kind === "image" || kind === "model") {
      const source = ctx.resolveSource(props.source, kind);
      if (!source) {
        ctx.diagnostics.push("<Viro" + (kind === "image" ? "Image" : "3DObject") + "> " + id + " has no Specs source id; pass resolveSource.");
        return;
      }
      ctx.nodes.push({ ...base, kind, source });
    } else {
      ctx.nodes.push({ ...base, kind });
    }
    collectBehaviour(id, props, ctx);

    const world = composeTransform(place.world, props);
    for (const child of elements(props.children)) {
      mapElement(child, { parentId: id, origin: [0, 0, 0], width: place.width, world }, ctx);
    }
  };
}

const mapPolyline: Mapper<ViroProps> = (props, place, ctx, element) => {
  const id = nodeId(ctx, element, "viro-polyline");
  if (place.inPanel) {
    ctx.diagnostics.push("<ViroPolyline> " + id + " is inside a panel; Lens draws route lines in world space, so it would not follow the panel. Left out.");
    return;
  }
  const world = composeTransform(place.world, props);
  const scale = Math.max(...world.scale.map(Math.abs));
  const material = Array.isArray(props.materials) ? props.materials[0] : props.materials;
  ctx.polylines.push({
    id,
    primitive: "volumetric-line",
    backendPackage: "VolumetricLine",
    points: (props.points ?? []).map((point) => transformPoint(world, point)),
    radiusMeters: ((props.thickness ?? 0.01) / 2) * scale,
    ...(material ? { materialId: material } : {}),
  });
};

definePortable(ViroNode, mapViro("group"));
definePortable(ViroText, mapViro("text"));
definePortable(ViroImage, mapViro("image"));
definePortable(Viro3DObject, mapViro("model"));
definePortable(ViroPolyline, mapPolyline);

/**
 * A Rive panel on Specs: a Frame (for grab and resize) filled by the baked
 * Rive art, with no header of its own, since the Rive file draws it. The
 * mapper records what to bake; `pnpm specs:scene` renders the clips and fills
 * in the texture id, frame ranges and frame count. Without `specs`, the panel
 * is left out.
 */
definePortable<RivePanelProps>(RivePanel, (props, place, ctx, element) => {
  const id = nodeId(ctx, element, "rive-panel");
  const specs = props.specs;
  if (!specs) {
    ctx.diagnostics.push("RivePanel " + id + " has no `specs` clips, so it is left out of the Specs scene.");
    return;
  }
  const width = props.width ?? 1.2;
  const height = props.height ?? 0.75;
  ctx.nodes.push({
    id,
    kind: "panel",
    position: (props.position as Vec3 | undefined) ?? place.origin,
    sizeMeters: [width, height],
    ...(place.parentId ? { parentId: place.parentId } : {}),
  });
  const [artW, artH] = specs.artboardSize;
  const riveId = id + "-rive";
  ctx.nodes.push({
    id: riveId,
    kind: "rive",
    parentId: id,
    source: "rive/" + riveId,
    position: [0, 0, Z.image],
    sizeMeters: [width, height],
    clips: {},
    clip: specs.play,
    ...(specs.next ? { next: specs.next } : {}),
    ...(specs.onSelect ? { onSelect: specs.onSelect } : {}),
    ...(specs.buttons?.length
      ? {
          buttons: specs.buttons.map((b) => ({
            id: b.id,
            label: b.label,
            rect: [b.rect[0] / artW, b.rect[1] / artH, b.rect[2] / artW, b.rect[3] / artH] as [number, number, number, number],
            ...(b.play ? { play: b.play } : {}),
          })),
        }
      : {}),
  });
  for (const b of specs.buttons ?? []) {
    if (b.play && !specs.clips[b.play]) {
      ctx.diagnostics.push("Rive button " + b.id + " plays " + b.play + ", which is not one of the panel's clips.");
    }
  }
  ctx.riveBakes.push({
    nodeId: riveId,
    file: specs.file,
    artboard: specs.artboard,
    resolution: specs.resolution,
    clips: Object.entries(specs.clips).map(([name, clip]) =>
      typeof clip === "string"
        ? { name, animation: clip, loop: false }
        : { name, animation: clip.animation, loop: clip.loop ?? false }
    ),
  });
});
