// Pure page builder for SpecsSampleApp. It uses no Lens globals, so Node can
// import and test it (see SpecsSampleLayout.test.ts). Positions are metres,
// UI Kit panel scales are multiples of the 24 x 12 cm BackPlate, image scales
// are about 1 cm per unit, and text sizes are Lens points.
import type { ViroSpecsPresentationSnapshot } from "../ViroSpecs/lens/ViroSpecsPresentationHost";

export type Node = ViroSpecsPresentationSnapshot["scene"]["nodes"][number];
export type Target = ViroSpecsPresentationSnapshot["targets"][number];
export type Color = [number, number, number, number];
export type Item = { id: string; title: string; sub: string; body: string };
export type TabId = "places" | "music";
export type TabStatus = "sample" | "loading" | "live" | "offline";

export type SampleState = {
  tab: TabId;
  selected: string | null;
  items: Record<TabId, Item[]>;
  status: Record<TabId, TabStatus>;
};

export type BuiltPage = {
  snapshot: ViroSpecsPresentationSnapshot;
  /** Height of the scrolling list's content in cm; 0 when the page has no list. */
  listContentCm: number;
};

export const TABS: { id: TabId; label: string }[] = [
  { id: "places", label: "Places" },
  { id: "music", label: "Music" },
];

// Linear RGBA. Black is transparent on the additive display, so text uses
// light colours and the frame supplies the backing.
export const GOLD: Color = [0.973, 0.776, 0.149, 1];
export const IVORY: Color = [0.96, 0.94, 0.89, 1];
export const MUTED: Color = [0.74, 0.7, 0.62, 1];

// The card sits 1.1 m ahead, a little below eye level.
export const ROOT_Y = -0.06;
export const ROOT_Z = -1.1;
// 50 x 50 cm frame centred 4 cm above the root.
const FRAME_SCALE: [number, number, number] = [2.08, 4.17, 1];
const HEADER_Y = 0.24;
const TITLE_Y = 0.16;
const ACTION_Y = -0.168;
// Tab rail: 8.4 x 24 cm frame left of the card, 7 x 7 cm items 7.8 cm apart.
const RAIL_X = -0.3075;
const RAIL_SPACING = 0.078;
const RAIL_FRAME_SCALE: [number, number, number] = [0.35, 2.0, 1];
const RAIL_ITEM_SCALE: [number, number, number] = [0.29, 0.58, 1];
// Two columns of 23 x 12 cm tiles in a 48 x 37 cm scroll window.
const TILE_SCALE: [number, number, number] = [0.96, 1.0, 1];
const TILE_COLUMN_X = 0.12;
const TILE_PITCH = 0.13;
export const LIST_ID = "sample-list";
export const LIST_WINDOW_CM: [number, number] = [48, 37];
const LIST_CENTER_Y = -0.005;
// 23 x 7 cm buttons.
const HALF_BUTTON_SCALE: [number, number, number] = [0.96, 0.58, 1];

/** Name of the SceneObject carrying the list's ScrollWindow. */
export const LIST_SCROLL_OBJECT = "viro-scroll:" + LIST_ID;

/** ScrollWindow scrollPosition.y (cm) that shows the top of content this tall. */
export function listTopEdgeCm(contentCm: number): number {
  return -Math.max(contentCm, LIST_WINDOW_CM[1]) / 2 + LIST_WINDOW_CM[1] / 2;
}

export function buildPage(state: SampleState, headerImageId: string | null): BuiltPage {
  const ui = new PageBuilder();
  ui.nodes.push({ id: "root", kind: "group", position: [0, ROOT_Y, ROOT_Z] });
  ui.nodes.push({ id: "frame", kind: "panel", parentId: "root", position: [0, 0.04, -0.03], scale: FRAME_SCALE });
  if (headerImageId) {
    ui.nodes.push({ id: "header-image", kind: "image", parentId: "root", source: headerImageId,
      position: [-0.19, HEADER_Y, 0.01], scale: [6, 6, 1] });
  }
  ui.text("header", "Specs Sample", 0, HEADER_Y, 64, GOLD);
  renderRail(ui, state.tab);

  const items = state.items[state.tab];
  const selected = state.selected ? items.find((item) => item.id === state.selected) : undefined;
  let listContentCm = 0;
  if (state.status[state.tab] === "loading") {
    ui.text("loading", "Loading…", 0, 0.04, 44, MUTED);
  } else if (selected) {
    ui.text("title", clip(selected.title, 26), 0, TITLE_Y, 64, GOLD);
    ui.text("sub", clip(selected.sub, 60), 0, TITLE_Y - 0.035, 40, MUTED);
    ui.text("body", wrap(selected.body, 44), 0, 0, 40, IVORY);
    ui.button("back", "Back", "back", 0, ACTION_Y, HALF_BUTTON_SCALE, 52);
  } else {
    listContentCm = renderList(ui, items);
    if (state.status[state.tab] === "offline") {
      ui.text("offline", "Offline: showing sample data", 0, -0.2, 30, MUTED);
    }
  }
  return { snapshot: { scene: { version: 1, nodes: ui.nodes }, targets: ui.targets }, listContentCm };
}

function renderRail(ui: PageBuilder, active: TabId): void {
  ui.nodes.push({ id: "rail", kind: "panel", parentId: "root", position: [RAIL_X, 0.04, -0.03], scale: RAIL_FRAME_SCALE });
  TABS.forEach((tab, index) => {
    const id = "tab-" + tab.id;
    const y = 0.04 + ((TABS.length - 1) / 2 - index) * RAIL_SPACING;
    const isActive = tab.id === active;
    ui.nodes.push({ id, kind: "group", parentId: "root", position: [RAIL_X, y, 0.005] });
    ui.nodes.push({ id: id + "-plate", kind: "panel", parentId: id, scale: RAIL_ITEM_SCALE });
    ui.text(id + "-label", tab.label, 0, 0, 36, isActive ? GOLD : MUTED, id);
    ui.targets.push({ targetId: id, action: "tab:" + tab.id });
    // A gold bar on the active tab's outer edge.
    if (isActive) ui.text("tab-bar", "▎", RAIL_X - 0.038, y, 110, GOLD);
  });
}

// Returns the list's content height in cm.
function renderList(ui: PageBuilder, items: Item[]): number {
  if (items.length === 0) {
    ui.text("empty", "Nothing here yet.", 0, 0.04, 44, MUTED);
    return 0;
  }
  const rows = Math.ceil(items.length / 2);
  const contentM = rows * TILE_PITCH;
  ui.nodes.push({ id: LIST_ID, kind: "group", parentId: "root", position: [0, LIST_CENTER_Y, 0.004],
    scroll: { width: LIST_WINDOW_CM[0] / 100, height: LIST_WINDOW_CM[1] / 100, contentHeight: contentM } });
  items.forEach((item, index) => {
    const id = "item-" + index;
    // Content coordinates: y = 0 is the top of the list, negative downward.
    const x = (index % 2 === 0 ? -1 : 1) * TILE_COLUMN_X;
    const y = -(TILE_PITCH / 2 + Math.floor(index / 2) * TILE_PITCH);
    ui.nodes.push({ id, kind: "group", parentId: LIST_ID, position: [x, y, 0.005] });
    ui.nodes.push({ id: id + "-plate", kind: "panel", parentId: id, scale: TILE_SCALE });
    ui.text(id + "-title", wrap(clip(item.title, 42), 22), 0, 0.018, 42, IVORY, id);
    ui.text(id + "-sub", clip(item.sub, 28), 0, -0.035, 34, MUTED, id);
    ui.targets.push({ targetId: id, action: "open:" + item.id });
  });
  return contentM * 100;
}

class PageBuilder {
  readonly nodes: Node[] = [];
  readonly targets: Target[] = [];

  text(id: string, value: string, x: number, y: number, size: number, color: Color, parentId = "root"): void {
    this.nodes.push({ id, kind: "text", parentId, text: value, position: [x, y, 0.01], textStyle: { size, color } });
  }

  // The group is the pinch target. SIK fits its collider to the first visual
  // inside it, the plate, so the whole plate is pinchable. The label is the
  // plate's sibling so it doesn't inherit the plate's non-uniform scale.
  button(id: string, label: string, action: string, x: number, y: number,
    scale: [number, number, number], size: number): void {
    this.nodes.push({ id, kind: "group", parentId: "root", position: [x, y, 0.005] });
    this.nodes.push({ id: id + "-plate", kind: "panel", parentId: id, scale });
    this.text(id + "-label", label, 0, 0, size, IVORY, id);
    this.targets.push({ targetId: id, action });
  }
}

/** Accepts `{ places?: Item[], music?: Item[] }` and drops malformed entries. */
export function parseItems(json: unknown): Partial<Record<TabId, Item[]>> {
  const out: Partial<Record<TabId, Item[]>> = {};
  if (!json || typeof json !== "object") return out;
  for (const tab of TABS) {
    const list = (json as Record<string, unknown>)[tab.id];
    if (!Array.isArray(list)) continue;
    out[tab.id] = list
      .filter((raw): raw is Record<string, unknown> => !!raw && typeof raw === "object")
      .filter((raw) => typeof raw.id === "string" && typeof raw.title === "string")
      .map((raw) => ({
        id: raw.id as string,
        title: raw.title as string,
        sub: typeof raw.sub === "string" ? raw.sub : "",
        body: typeof raw.body === "string" ? raw.body : "",
      }));
  }
  return out;
}

// Shorten to fit a label, on a word boundary when one is close.
export function clip(value: string, max: number): string {
  if (value.length <= max) return value;
  const cut = value.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return (space > max * 0.6 ? cut.slice(0, space) : cut) + "…";
}

// Lens Text doesn't wrap inside a frame; break long copy before rendering.
export function wrap(value: string, width: number): string {
  const lines: string[] = [];
  let line = "";
  for (const word of value.split(" ")) {
    if (line && line.length + 1 + word.length > width) {
      lines.push(line);
      line = word;
    } else {
      line = line ? line + " " + word : word;
    }
  }
  if (line) lines.push(line);
  return lines.join("\n");
}

export const SAMPLE_ITEMS: Record<TabId, Item[]> = {
  places: [
    { id: "apollo", title: "Apollo Theater", sub: "253 West 125th Street",
      body: "A performing-arts landmark on 125th Street, home of Amateur Night since 1934." },
    { id: "schomburg", title: "Schomburg Center", sub: "515 Malcolm X Boulevard",
      body: "A research library of the New York Public Library for Black history and culture." },
    { id: "studio-museum", title: "The Studio Museum", sub: "144 West 125th Street",
      body: "A museum for artists of African descent, founded in 1968." },
    { id: "marcus-garvey-park", title: "Marcus Garvey Park", sub: "Madison Avenue at 120th Street",
      body: "A park around a rock outcrop, with a cast-iron fire watchtower at the top." },
    { id: "abyssinian", title: "Abyssinian Baptist Church", sub: "132 Odell Clark Place",
      body: "A congregation founded in 1808; the current building dates from 1923." },
    { id: "savoy-site", title: "Savoy Ballroom site", sub: "Lenox Avenue at 140th Street",
      body: "The Savoy ran from 1926 to 1958. A plaque marks the block." },
  ],
  music: [
    { id: "fats-waller", title: "Fats Waller", sub: "Jazz · 1920s–1940s",
      body: "Stride pianist and songwriter of Ain't Misbehavin'." },
    { id: "frankie-lymon", title: "Frankie Lymon", sub: "Doo-wop · 1950s",
      body: "Lead singer of the Teenagers, who recorded Why Do Fools Fall in Love at 13." },
    { id: "big-l", title: "Big L", sub: "Hip-hop · 1990s",
      body: "Rapper from 139th Street and Lenox Avenue." },
  ],
};
