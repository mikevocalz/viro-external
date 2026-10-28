# Building Spectacles apps with `@viro-external/specs`

A guide for writing your own Lens UI on top of the Viro Specs presentation host. The patterns come from the Harlem Might Specs entry script (`apps/specs/Assets/HarlemMight/Scripts/HarlemMightSpecsEntry.ts` on Harlem Might's `feat/specs-map-places`), which runs in Lens Studio 5.24.1 Preview. A runnable version of most of this is in [`examples/specs-sample/`](../examples/specs-sample/README.md).

Status, as of 2026-10-15:

- Scroll groups (PR #70) and runtime images (PR #69) are on `main` as of 2026-10-15; sync from `main`.
- Everything here ran in Lens Studio Preview. Only the push command was exercised against Spectacles; no page in this guide has recorded on-device evidence. Keep Preview and hardware results apart (see the runbook's [Evidence](./LensStudioRunbook.md#evidence) section).
- Every code block marked `// File:` was typechecked with the TypeScript compiler against Lens Studio 5.24.1's declarations (`Cache/TypeScript/lib/LensifyTS/Declarations`), the Harlem Might project's synced `ViroSpecs/lens` runtime and its installed packages, with that project's own `tsconfig.json` options. That is a compile check, not a Lens Studio compile or a run.

Step-by-step project setup and the known traps are in [LensStudioRunbook.md](./LensStudioRunbook.md). The wire protocol is in [LivePresentation.md](./LivePresentation.md).

## 1. What Viro renders on Specs

Lens Studio draws everything. Your script builds a JSON page of portable nodes and hands it to `ViroSpecsPresentationHost.present()`; the host validates it, tears down the previous page and creates Lens objects:

| Node | Lens object | Notes |
| --- | --- | --- |
| `panel` | instance of the registry's `defaultPanelPrefab` (a UI Kit frame / BackPlate) | `scale` multiplies the 24 x 12 cm BackPlate |
| `text` | `Text` with the registry's `defaultFont` | `textStyle: { size, color }`; 48 pt without it |
| `image` | `Image` with `defaultImageMaterial`, texture looked up by `source` in `ViroSpecsAssetRegistry` | `scale` is about 1 cm per unit |
| `group` | empty `SceneObject` (`viro:<id>`) | parent for layout and the pinch target for buttons |
| `group` + `scroll` | child `viro-scroll:<id>` with a vertical UI Kit `ScrollWindow` | children go into the window's content |
| `model` | instance of a prefab from `modelIds` / `modelPrefabs` | |
| `targets[]` | SIK `Interactable` on the target node (`viro-interactable:<id>`) | `select-end` fires the target's action string |

Build these yourself, outside Viro, as ordinary Lens components:

- **Navigation Kit** (`SpecsNavigationKit.lspkg`): `NavigationDataComponent`, `ARNavigation` arrow, the map component.
- **WebView**: `InternetModule.createWebView`, device-only.
- **Network**: `InternetModule.fetch` for JSON, `RemoteMediaModule` for images.
- Anything else Lens-native: audio, camera, physics, custom materials.

Viro owns one page of nodes under `ViroSpecsRuntimeHost`. Your other components sit beside it in the scene and you position them yourself (section 10).

## 2. Project setup

Short version of the runbook:

1. Copy the Platform Lab project, then sync the runtime into it:

   ```bash
   npx -y pnpm@12.8.1 --filter @viro-external/specs specs:doctor -- --project "/abs/path/MyAppSpecs"
   npx -y pnpm@12.8.1 --filter @viro-external/specs specs:sync -- --project "/abs/path/MyAppSpecs"
   ```

   Resyncing a wired project keeps its `.meta` files and your edits. The doctor fails if a required package is missing or below its minimum; [SyncAndDoctor.md](./SyncAndDoctor.md) lists the checks.

2. Wire the four hosts. In the Platform Lab they sit on `ViroSpecsRuntime` and its children:

   | Component | Inspector inputs |
   | --- | --- |
   | `ViroSpecsAssetRegistry` | `imageIds` / `imageTextures`, `modelIds` / `modelPrefabs` (parallel arrays), `defaultPanelPrefab`, `defaultFont`, `defaultImageMaterial` |
   | `ViroSpecsRuntimeHost` | `assetRegistryObject`; optional `root` |
   | `ViroSpecsInteractionHost` | `runtimeHostObject` |
   | `ViroSpecsPresentationHost` | `runtimeHostObject`, `interactionHostObject` |

3. Fill the registry: `defaultPanelPrefab` = `ViroLabPanel`, `defaultFont` = `SpecsSans-Medium`, and your textures under ids you will use as `source`.

4. Make an image material that works: a new **Unlit** material, Blend Mode **Normal**, Depth Write **off**, Graph Parameters **Base Texture** on. Assign it as `defaultImageMaterial`. The two lab materials render nothing.

5. If you fetch `http://` URLs or use WebView, tick **Project Settings > Experimental API** and save. Lens Studio stores it as `EXPERIMENTAL_API` in `metaInfo.lensDescriptors`; `spkPrivilegeLevel` in the `.esproj` is a different field that the next save overwrites.

## 3. A minimal component

One script with one input. It subscribes to actions and presents a page with a title and a button that counts pinches.

```ts
// File: MinimalSpecsPage.ts
import {
  ViroSpecsPresentationHost,
  type ViroSpecsPresentationSnapshot,
} from "../ViroSpecs/lens/ViroSpecsPresentationHost";

@component
export class MinimalSpecsPage extends BaseScriptComponent {
  @input
  @hint("SceneObject holding ViroSpecsPresentationHost")
  presentationHostObject: SceneObject;

  private host: ViroSpecsPresentationHost | null = null;
  private unsubscribe: (() => void) | null = null;
  private pinches = 0;

  onAwake(): void {
    this.host = this.presentationHostObject.getComponent(
      ViroSpecsPresentationHost.getTypeName()
    ) as ViroSpecsPresentationHost | null;
    if (!this.host) throw new Error("MinimalSpecsPage requires ViroSpecsPresentationHost.");
    // OnStartEvent, not onAwake: the hosts must have initialized first.
    this.createEvent("OnStartEvent").bind(() => {
      this.unsubscribe = this.host!.subscribeAction((action) => {
        if (action === "count") this.pinches++;
        this.render();
      });
      this.render();
    });
    this.createEvent("OnDestroyEvent").bind(() => this.unsubscribe?.());
  }

  private render(): void {
    const page: ViroSpecsPresentationSnapshot = {
      scene: {
        version: 1,
        nodes: [
          { id: "root", kind: "group", position: [0, -0.06, -1.1] },
          { id: "frame", kind: "panel", parentId: "root", position: [0, 0, -0.03], scale: [1.67, 1.67, 1] },
          { id: "title", kind: "text", parentId: "root", text: "Hello, Specs", position: [0, 0.06, 0.01],
            textStyle: { size: 72, color: [0.973, 0.776, 0.149, 1] } },
          { id: "count", kind: "group", parentId: "root", position: [0, -0.06, 0.005] },
          { id: "count-plate", kind: "panel", parentId: "count", scale: [0.96, 0.58, 1] },
          { id: "count-label", kind: "text", parentId: "count", text: "Pinched " + this.pinches,
            position: [0, 0, 0.01], textStyle: { size: 52, color: [0.96, 0.94, 0.89, 1] } },
        ],
      },
      targets: [{ targetId: "count", action: "count" }],
    };
    this.host!.present(page);
  }
}
```

Action listeners run one frame after the pinch ends, so calling `present()` from a listener is safe. Every pinch fires again; debounce in your code if a repeat would hurt.

## 4. Building blocks

Collect node construction in a small builder so pages read as layout, not JSON. This is a trimmed `Layout` from the Harlem Might entry script.

```ts
// File: SpecsBlocks.ts
import type { ViroSpecsPresentationSnapshot } from "../ViroSpecs/lens/ViroSpecsPresentationHost";

export type Node = ViroSpecsPresentationSnapshot["scene"]["nodes"][number];
export type Target = ViroSpecsPresentationSnapshot["targets"][number];
export type Color = [number, number, number, number];
export type Scale = [number, number, number];

export const GOLD: Color = [0.973, 0.776, 0.149, 1];
export const IVORY: Color = [0.96, 0.94, 0.89, 1];
export const MUTED: Color = [0.74, 0.7, 0.62, 1];
export const HALF_BUTTON: Scale = [0.96, 0.58, 1]; // 23 x 7 cm
export const TILE: Scale = [0.96, 1.0, 1]; // 23 x 12 cm

export class Blocks {
  readonly nodes: Node[] = [];
  readonly targets: Target[] = [];

  text(id: string, value: string, x: number, y: number, size: number, color: Color, parentId = "root"): void {
    this.nodes.push({ id, kind: "text", parentId, text: value, position: [x, y, 0.01], textStyle: { size, color } });
  }

  // The group is the target. SIK fits the collider to the first visual under
  // it, the plate, so the whole plate is pinchable. The label is a sibling of
  // the plate, so it doesn't inherit the plate's non-uniform scale.
  button(id: string, label: string, action: string, x: number, y: number, scale: Scale, size = 52,
    parentId = "root"): void {
    this.nodes.push({ id, kind: "group", parentId, position: [x, y, 0.005] });
    this.nodes.push({ id: id + "-plate", kind: "panel", parentId: id, scale });
    this.text(id + "-label", label, 0, 0, size, IVORY, id);
    this.targets.push({ targetId: id, action });
  }

  // `source` must be an id the registry knows, from the Inspector or registerImage().
  image(id: string, source: string, x: number, y: number, widthCm: number, heightCm: number,
    parentId = "root"): void {
    this.nodes.push({ id, kind: "image", parentId, source, position: [x, y, 0.006], scale: [widthCm, heightCm, 1] });
  }

  // A card: plate, optional photo on the left, title and one muted line.
  // The whole tile is one pinch target.
  tile(id: string, title: string, sub: string, photo: string | null, action: string,
    x: number, y: number, parentId = "root"): void {
    this.nodes.push({ id, kind: "group", parentId, position: [x, y, 0.005] });
    this.nodes.push({ id: id + "-plate", kind: "panel", parentId: id, scale: TILE });
    if (photo) this.image(id + "-photo", photo, -0.06, 0, 9, 9, id);
    const textX = photo ? 0.045 : 0;
    this.text(id + "-title", title, textX, 0.018, 42, IVORY, id);
    if (sub) this.text(id + "-sub", sub, textX, -0.035, 34, MUTED, id);
    this.targets.push({ targetId: id, action });
  }

  // Long titles step down a size before they get shortened.
  header(title: string, subtitle: string, y = 0.16): void {
    const size = title.length <= 26 ? 80 : title.length <= 36 ? 64 : 54;
    this.text("title", title, 0, y, size, GOLD);
    if (subtitle) this.text("subtitle", subtitle, 0, y - 0.033, 40, MUTED);
  }

  // Bottom row of a detail page: main action left, Back right.
  actions(primary: { label: string; action: string } | null, y = -0.168): void {
    if (primary) this.button("primary", primary.label, primary.action, -0.12, y, HALF_BUTTON);
    this.button("back", "Back", "back", primary ? 0.12 : 0, y, HALF_BUTTON);
  }

  page(): ViroSpecsPresentationSnapshot {
    return { scene: { version: 1, nodes: this.nodes }, targets: this.targets };
  }
}

// Lens Text doesn't wrap inside a frame. Break copy on word boundaries first.
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
```

Why a button is three nodes: if you put the target on the plate itself, the label becomes the plate's child and inherits its `[0.96, 0.58, 1]` scale, which squashes the text. If you put the target on a group whose only visual is a label, SIK fits the collider to the glyphs and the target shrinks to the word.

## 5. Layout and units

| Quantity | Unit |
| --- | --- |
| node `position` | metres, local to the parent; the page root is local to `ViroSpecsRuntimeHost` |
| `panel` `scale` | multiples of the UI Kit BackPlate, 24 x 12 cm at scale 1 |
| `image` `scale` | about 1 cm per unit, measured in Preview against a 50 cm frame; measure, don't compute |
| `textStyle.size` | Lens text points; one line is roughly 0.052 cm per point (estimate) |
| `scroll` | metres; the ScrollWindow itself works in cm |

Sizes Harlem Might uses at 1.1 m:

- Card root at `[0, -0.06, -1.1]`: 1.1 m out, 6 cm below eye level so the street stays visible above it.
- Frame 50 x 50 cm: `scale [2.08, 4.17, 1]`, centred 4 cm above the root, 3 cm behind it.
- Text: 80 pt titles, 64 and 54 pt for long titles, 52 pt buttons, 40–44 pt body, 34–36 pt secondary lines and tab labels. Nothing below 30 pt. That is the 34–80 pt range in use.
- Pinch targets at least 6.4 cm on the short side: tabs 7 x 7 cm, half buttons 23 x 7 cm, tiles 23 x 12 cm.
- Colours: black is transparent on the additive display, so use light text on the frame. Off-white (`IVORY`) glares less than pure white.

A left tab rail, icons over labels, the active tab in gold with a gold bar on its outer edge:

```ts
// File: SpecsRail.ts
import { Blocks, GOLD, MUTED } from "./SpecsBlocks";

export type Tab = { id: string; label: string };

const RAIL_X = -0.3075; // 8.5 cm wide rail just left of a 50 cm frame
const RAIL_SPACING = 0.078; // 7 cm items, 0.8 cm apart
const RAIL_ITEM: [number, number, number] = [0.29, 0.58, 1]; // 7 x 7 cm
const ICON_CM = 3.2;

export function rail(ui: Blocks, tabs: Tab[], active: string): void {
  ui.nodes.push({ id: "rail", kind: "panel", parentId: "root", position: [RAIL_X, 0.04, -0.03],
    scale: [0.35, (tabs.length * RAIL_SPACING * 100 + 4) / 12, 1] });
  tabs.forEach((tab, index) => {
    const id = "tab-" + tab.id;
    const on = tab.id === active;
    const y = 0.04 + ((tabs.length - 1) / 2 - index) * RAIL_SPACING;
    ui.nodes.push({ id, kind: "group", parentId: "root", position: [RAIL_X, y, 0.005] });
    ui.nodes.push({ id: id + "-plate", kind: "panel", parentId: id, scale: RAIL_ITEM });
    // Two registered textures per tab: "tab-<id>-active" and "tab-<id>-idle".
    ui.image(id + "-icon", "tab-" + tab.id + (on ? "-active" : "-idle"), 0, 0.011, ICON_CM, ICON_CM, id);
    ui.text(id + "-label", tab.label, 0, -0.022, 36, on ? GOLD : MUTED, id);
    ui.targets.push({ targetId: id, action: "tab:" + tab.id });
    if (on) ui.text("tab-bar", "▎", RAIL_X - 0.038, y, 110, GOLD);
  });
}
```

A two-column grid: columns at x = ±0.12 m, rows every 0.13 m (12 cm tile plus 1 cm gap). Inside a scroll group, y counts down from the content top (next section); outside one, offset from wherever the grid starts.

```ts
// File: SpecsGrid.ts
import { Blocks } from "./SpecsBlocks";

export type Card = { id: string; title: string; sub: string; photo: string | null };

export const TILE_PITCH = 0.13;
const COLUMN_X = 0.12;

/** Lays cards out two per row under `parentId`, top row at y = 0. Returns the grid height in metres. */
export function grid(ui: Blocks, cards: Card[], parentId: string): number {
  cards.forEach((card, index) => {
    const x = (index % 2 === 0 ? -1 : 1) * COLUMN_X;
    const y = -(TILE_PITCH / 2 + Math.floor(index / 2) * TILE_PITCH);
    ui.tile("card-" + index, card.title, card.sub, card.photo, "open:" + card.id, x, y, parentId);
  });
  return Math.ceil(cards.length / 2) * TILE_PITCH;
}
```

A detail page is a header at y 0.16 (subtitle 3.3 cm under it), a body between y ≈ 0.11 and -0.13, and the action row at y -0.168. With a long body, make the middle a scroll group (section 6).

## 6. Scrolling

Add `scroll: { width, height, contentHeight }` (metres) to a `group`. The host builds a vertical UI Kit `ScrollWindow` on a child named `viro-scroll:<id>`, calls `initialize()` on it right after creating it, and parents the group's children into the window's content. Children use content coordinates: x = 0 on the window's centre line, y = 0 at the content top, negative downward. Validation rejects `scroll` on non-groups, width or height outside (0, 10] and a negative `contentHeight`. There is no ScrollBar; its inputs are private.

A list of cards in a 48 x 37 cm window:

```ts
// File: SpecsList.ts
import { Blocks } from "./SpecsBlocks";
import { grid, type Card } from "./SpecsGrid";

export const LIST_ID = "list";
export const LIST_WINDOW_CM: [number, number] = [48, 37];

/** Returns the content height in cm, which scroll restoration needs. */
export function list(ui: Blocks, cards: Card[]): number {
  const scroll = { width: LIST_WINDOW_CM[0] / 100, height: LIST_WINDOW_CM[1] / 100, contentHeight: 0 };
  ui.nodes.push({ id: LIST_ID, kind: "group", parentId: "root", position: [0, -0.005, 0.004], scroll });
  // The group must come before its children; set the height once they are laid out.
  scroll.contentHeight = grid(ui, cards, LIST_ID);
  return scroll.contentHeight * 100;
}
```

**Keeping the scroll offset.** Every `present()` builds a new ScrollWindow scrolled to the top. A page that redraws (a photo finished loading, another page of results arrived) jumps back up unless you carry the offset. `ScrollWindow` centres its content on its origin, so `scrollPosition.y` at the top of the content is `-max(content, window) / 2 + window / 2` (cm). Read the offset from that edge before `present()`, write it back after:

```ts
// File: SpecsScrollMemory.ts
import { ScrollWindow } from "SpectaclesUIKit.lspkg/Scripts/Components/ScrollWindow/ScrollWindow";

/** scrollPosition.y (cm) that shows the top of `contentCm` of content in a `windowCm`-tall window. */
export function topEdgeCm(contentCm: number, windowCm: number): number {
  return -Math.max(contentCm, windowCm) / 2 + windowCm / 2;
}

export function findByName(name: string): SceneObject | null {
  const visit = (object: SceneObject): SceneObject | null => {
    if (object.name === name) return object;
    for (let i = 0; i < object.getChildrenCount(); i++) {
      const found = visit(object.getChild(i));
      if (found) return found;
    }
    return null;
  };
  for (let i = 0; i < global.scene.getRootObjectsCount(); i++) {
    const found = visit(global.scene.getRootObject(i));
    if (found) return found;
  }
  return null;
}

export function scrollWindowFor(groupId: string): ScrollWindow | null {
  const object = findByName("viro-scroll:" + groupId);
  return object ? (object.getComponent(ScrollWindow.getTypeName()) as ScrollWindow | null) : null;
}

/** Remembers how far a list is scrolled from its top, across present() calls. */
export class ScrollMemory {
  private fromTopCm = 0;
  private contentCm = 0;

  constructor(private readonly groupId: string, private readonly windowCm: number) {}

  private skipNext = false;

  /** Call before every present(). Does nothing while no list is on screen. */
  remember(): void {
    if (this.skipNext) {
      this.skipNext = false;
      return;
    }
    const window = scrollWindowFor(this.groupId);
    if (window) this.fromTopCm = window.scrollPosition.y - topEdgeCm(this.contentCm, this.windowCm);
  }

  /** Call after present() with the new content height. */
  restore(contentCm: number): ScrollWindow | null {
    this.contentCm = contentCm;
    const window = scrollWindowFor(this.groupId);
    if (!window) return null;
    const max = Math.max(0, contentCm - this.windowCm);
    const fromTop = Math.min(max, Math.max(0, this.fromTopCm));
    window.scrollPosition = new vec2(0, topEdgeCm(contentCm, this.windowCm) + fromTop);
    return window;
  }

  /** Call when switching to a different list; the list still on screen is ignored. */
  reset(): void {
    this.fromTopCm = 0;
    this.skipNext = true;
  }
}
```

Call `remember()` at the start of every render, including one that shows a detail page, so Back returns to the same spot. Call `reset()` when the tab changes, so the old tab's offset isn't carried over.

**Loading more near the bottom.** Subscribe to `onScrollPositionUpdated` on the window you just restored. Harlem Might loads the next page of 24 artists when the list is within 15 cm of its end, or right away when the first page doesn't fill the window:

```ts
// File: SpecsLoadMore.ts
import { ScrollWindow } from "SpectaclesUIKit.lspkg/Scripts/Components/ScrollWindow/ScrollWindow";
import { topEdgeCm } from "./SpecsScrollMemory";

const LOAD_MORE_MARGIN_CM = 15;

export function watchForMore(window: ScrollWindow, contentCm: number, windowCm: number,
  canLoad: () => boolean, loadMore: () => void): void {
  const check = () => {
    if (!canLoad()) return;
    const fromTop = window.scrollPosition.y - topEdgeCm(contentCm, windowCm);
    const scrollable = contentCm - windowCm;
    if (scrollable <= 0 || fromTop >= scrollable - LOAD_MORE_MARGIN_CM) loadMore();
  };
  window.onScrollPositionUpdated.add(check);
  check();
}
```

`canLoad` should be false while a page is in flight and once the server says there are no more pages, or the check fires on every scroll frame. The window is destroyed on the next `present()`, and its listeners with it.

## 7. Navigation and state

Keep all UI state in the component and rebuild the whole page from it. Actions are strings with a prefix; the listener updates state and calls `render()`. Harlem Might uses `preview:tab:<id>`, `preview:open:<id>`, `preview:back`, `preview:walk`, `preview:play`.

```ts
// File: SpecsNavigator.ts
import {
  ViroSpecsPresentationHost,
  type ViroSpecsPresentationSnapshot,
} from "../ViroSpecs/lens/ViroSpecsPresentationHost";
import { Blocks, wrap } from "./SpecsBlocks";
import { rail, type Tab } from "./SpecsRail";
import { list, LIST_ID, LIST_WINDOW_CM } from "./SpecsList";
import { ScrollMemory } from "./SpecsScrollMemory";
import type { Card } from "./SpecsGrid";

type Item = Card & { body: string };

const TABS: Tab[] = [{ id: "places", label: "Places" }, { id: "music", label: "Music" }];

@component
export class SpecsNavigator extends BaseScriptComponent {
  @input
  presentationHostObject: SceneObject;

  private host: ViroSpecsPresentationHost | null = null;
  private tab = "places";
  private selected: string | null = null;
  private readonly items = new Map<string, Item[]>([["places", []], ["music", []]]);
  private readonly scroll = new ScrollMemory(LIST_ID, LIST_WINDOW_CM[1]);

  onAwake(): void {
    this.host = this.presentationHostObject.getComponent(
      ViroSpecsPresentationHost.getTypeName()
    ) as ViroSpecsPresentationHost | null;
    this.createEvent("OnStartEvent").bind(() => {
      this.host!.subscribeAction((action) => this.onAction(action));
      this.render();
    });
  }

  private onAction(action: string): void {
    if (action.startsWith("tab:")) {
      this.tab = action.slice("tab:".length);
      this.selected = null;
      this.scroll.reset();
    } else if (action.startsWith("open:")) {
      this.selected = action.slice("open:".length);
    } else if (action === "back") {
      this.selected = null;
    } else {
      return; // ignore unknown actions, including late ones from an old page
    }
    this.render();
  }

  private render(): void {
    // Before building: the list may still be on screen even if this render shows a detail page.
    this.scroll.remember();
    const ui = new Blocks();
    ui.nodes.push({ id: "root", kind: "group", position: [0, -0.06, -1.1] });
    ui.nodes.push({ id: "frame", kind: "panel", parentId: "root", position: [0, 0.04, -0.03], scale: [2.08, 4.17, 1] });
    rail(ui, TABS, this.tab);
    const items = this.items.get(this.tab) ?? [];
    const item = items.find((i) => i.id === this.selected);
    let contentCm = 0;
    if (item) {
      ui.header(item.title, item.sub);
      ui.text("body", wrap(item.body, 44), 0, 0, 40, [0.96, 0.94, 0.89, 1]);
      ui.actions(null);
    } else {
      contentCm = list(ui, items);
    }
    const page: ViroSpecsPresentationSnapshot = ui.page();
    this.host!.present(page);
    if (!item) this.scroll.restore(contentCm);
  }
}
```

`present()` checks the whole page before it clears the old one and throws on a bad page (unknown parent, target without a node, missing image id). If it throws after that point, the page stays empty; catch the error and present a fallback page.

## 8. Data

`InternetModule.fetch` takes a `Request` and returns a `Response`. Put the fetch behind a function you pass in, so the client logic can run in Node tests (section 11):

```ts
// File: SpecsContent.ts
export type Place = { id: string; name: string; street: string; imageUrl: string | null };
type FetchJson = (url: string) => Promise<any>;

export class SpecsContent {
  // Plain fields, not constructor parameter properties: Node's type stripping rejects those.
  private readonly apiBase: string;
  private readonly fetchJson: FetchJson;

  constructor(apiBase: string, fetchJson: FetchJson) {
    this.apiBase = apiBase;
    this.fetchJson = fetchJson;
  }

  async places(): Promise<Place[]> {
    const body = await this.fetchJson(this.apiBase.replace(/\/$/, "") + "/places?limit=24&sort=name");
    const docs: any[] = Array.isArray(body?.docs) ? body.docs : [];
    return docs.map((doc) => ({
      id: String(doc.id),
      name: String(doc.name ?? ""),
      street: String(doc.street ?? ""),
      imageUrl: typeof doc.imageUrl === "string" ? doc.imageUrl : null,
    }));
  }
}

/** The Lens side of FetchJson. */
export function lensFetchJson(internet: InternetModule): FetchJson {
  return async (url) => {
    const response = await internet.fetch(new Request(url, { method: "GET", headers: { accept: "application/json" } }));
    if (response.status !== 200) throw new Error("HTTP " + response.status + " for " + url);
    return response.json();
  };
}
```

Rules:

- The Lens fetches `https://` only. `http://` fails with "URL is not secure (Experimental API must be enabled to access insecure URLs)" until you enable Experimental API.
- Spectacles can't reach your Mac's `localhost`. Point `apiBase` at the Mac's LAN IP on the same Wi-Fi, or a public `https://` host. Make it an `@input string` so you can switch it in the Inspector.
- Track a status per tab, `loading` / `ready` / `offline`. Load a tab the first time it opens, render "Loading…" while it loads, and on failure show built-in content with a muted "offline" note. Retry the next time the tab opens. Harlem Might's `load(tab)` does exactly this.
- Lens has no `Intl` time zones. `toLocaleString` with a `timeZone` won't do what it does on the phone; port the date formatting to plain arithmetic.

## 9. Runtime images

Textures you download aren't in the Inspector arrays. Load them with `RemoteMediaModule`, register them on the registry under an id, and use that id as an image node's `source`. Cache by URL, and redraw when a load finishes:

```ts
// File: SpecsPhotos.ts
import { ViroSpecsAssetRegistry } from "../ViroSpecs/lens/ViroSpecsAssetRegistry";

/** url -> registry id once loaded; "loading" / "failed" otherwise. */
export class SpecsPhotos {
  private readonly remoteMedia = require("LensStudio:RemoteMediaModule") as RemoteMediaModule;
  private readonly state = new Map<string, string | "loading" | "failed">();

  constructor(
    private readonly internet: InternetModule,
    private readonly registry: ViroSpecsAssetRegistry,
    private readonly onLoaded: () => void,
  ) {}

  /** The registry id for `url` if it is loaded; otherwise starts the load and returns null. */
  idFor(url: string | null): string | null {
    if (!url) return null;
    const current = this.state.get(url);
    if (current === "loading" || current === "failed") return null;
    if (current) return current;
    this.state.set(url, "loading");
    const resource = this.internet.makeResourceFromUrl(url);
    this.remoteMedia.loadResourceAsImageTexture(resource, (texture) => {
      const id = "photo:" + url;
      this.registry.registerImage(id, texture);
      this.state.set(url, id);
      this.onLoaded();
    }, (message) => {
      print("[SpecsPhotos] " + url + ": " + message);
      this.state.set(url, "failed");
    });
    return null;
  }
}
```

Render the tile without a photo while `idFor` returns null; `onLoaded` calls your `render()`, which picks the photo up. Never put an id in `source` before `registerImage` ran for it: `present()` rejects the whole page. Register first, present second.

Fit photos to a box by aspect ratio instead of stretching them. Harlem Might's `fit(image, boxW, boxH)` returns `[w, h]` in cm from the image's pixel size.

## 10. Mixing in non-Viro Lens components

### WebView video screen

A separate component on its own SceneObject, with an `Image` you move over a slot in the Viro page. Condensed from `HarlemMightVideoScreen.ts`:

```ts
// File: SpecsVideoScreen.ts
import { Interactable } from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable";
import { InteractorEvent } from "SpectaclesInteractionKit.lspkg/Core/Interactor/InteractorEvent";

const RESOLUTION = new vec2(1280, 720);

@component
export class SpecsVideoScreen extends BaseScriptComponent {
  @input
  internetModule: InternetModule;

  @input
  @hint("Image that shows the page texture")
  screen: Image;

  private control: WebPageTextureProvider | null = null;
  private ready = false;
  private pendingUrl: string | null = null;

  onAwake(): void {
    // Hide the Image component, never this SceneObject: a disabled object
    // stops this script's DelayedCallbackEvents and WebView callbacks.
    this.screen.enabled = false;
    this.screen.mainMaterial = this.screen.mainMaterial.clone();
    this.wireTouch();
  }

  /** World position and size in cm. */
  place(position: vec3, size: vec2): void {
    const transform = this.getSceneObject().getTransform();
    transform.setWorldPosition(position);
    transform.setWorldScale(new vec3(size.x, size.y, 1));
  }

  load(url: string): void {
    this.pendingUrl = url;
    if (this.ready) {
      this.control!.loadUrl(url);
      this.screen.enabled = true;
      return;
    }
    // Throws unless Project Settings > Experimental API is on.
    const options = InternetModule.createWebViewOptions(RESOLUTION);
    this.internetModule.createWebView(options, (texture) => {
      this.screen.mainPass.baseTex = texture;
      this.control = texture.control as WebPageTextureProvider;
      // onReady may never fire; try the URL shortly after the texture arrives.
      const early = this.createEvent("DelayedCallbackEvent");
      early.bind(() => this.markReady());
      early.reset(1.5);
      this.control.onReady.add(() => this.markReady());
    }, (message) => print("[SpecsVideoScreen] WebView unavailable: " + message));
  }

  private markReady(): void {
    if (this.ready || !this.pendingUrl || !this.control) return;
    try {
      this.control.loadUrl(this.pendingUrl);
      this.ready = true;
      this.screen.enabled = true;
    } catch (error) {
      print("[SpecsVideoScreen] loadUrl not accepted yet: " + error);
    }
  }

  // Forward SIK pinches as WebView touches so the page's own controls work.
  private wireTouch(): void {
    const object = this.getSceneObject();
    const collider = object.createComponent("Physics.ColliderComponent") as ColliderComponent;
    const shape = Shape.createBoxShape();
    shape.size = new vec3(1, 1, 0.02);
    collider.shape = shape;
    collider.fitVisual = false;
    const interactable = object.createComponent(Interactable.getTypeName()) as Interactable;
    const send = (state: TouchState) => (event: InteractorEvent) => {
      const hit = event.interactor.targetHitInfo?.localHitPosition;
      if (!this.ready || !this.control || !hit) return;
      // The Image quad spans -0.5..0.5; WebView pixels start top-left.
      const x = Math.min(1, Math.max(0, hit.x + 0.5)) * RESOLUTION.x;
      const y = Math.min(1, Math.max(0, 0.5 - hit.y)) * RESOLUTION.y;
      this.control.touch(0, state, x, y);
    };
    interactable.onTriggerStart.add(send(TouchState.Began));
    interactable.onTriggerUpdate.add(send(TouchState.Moved));
    interactable.onTriggerEnd.add(send(TouchState.Ended));
    interactable.onTriggerCanceled.add(send(TouchState.Ended));
  }
}
```

Lens Studio Preview creates the texture and accepts `loadUrl` but draws a blank page; only Spectacles render WebView. Harlem Might checks `global.deviceInfoSystem.isEditor()` and shows a text note in the slot instead, so Preview never shows a silent black box. The screen lives at a world position, so when its slot is inside a scroll group, recompute the position from `onScrollPositionUpdated` and hide the Image while the slot is scrolled out of the window (`positionSongScreen` in the entry script).

If the video screen sits lower in the hierarchy than your entry script, it initializes after it and resets any callback field you set in `onAwake`. Set `video.onStatusChanged` in `OnStartEvent`.

### Navigation Kit walk

Navigation Kit points an arrow at a place from the Lens's own location. A straight-line bearing, not a street route:

```ts
// File: SpecsWalk.ts
import { Place } from "SpecsNavigationKit.lspkg/NavigationDataComponent/Place";
import { GeoLocationPlace } from "SpecsNavigationKit.lspkg/NavigationDataComponent/GeoLocationPlace";
import { NavigationDataComponent } from "SpecsNavigationKit.lspkg/NavigationDataComponent/NavigationDataComponent";
import { ARNavigation } from "SpecsNavigationKit.lspkg/ARNavigationComponent/Scripts/ARNavigation";

export type WalkTarget = { name: string; street: string; latitude: number; longitude: number };

export class SpecsWalk {
  private current: { target: Place; owned: boolean } | null = null;

  constructor(
    private readonly navigation: NavigationDataComponent,
    private readonly arrow: ARNavigation,
    private readonly icon: Texture,
  ) {}

  start(place: WalkTarget, onArrive: () => void): void {
    this.end();
    // Reuse the scene's place list entry when there is one, so the map shows one pin.
    let target: Place | undefined = this.navigation.places.find((p) => p.name === place.name);
    const owned = !target;
    if (!target) {
      const geo = GeoPosition.create();
      geo.latitude = place.latitude;
      geo.longitude = place.longitude;
      target = new GeoLocationPlace(geo, 25, place.name, this.icon, place.street, this.navigation.getUserPosition());
    }
    this.current = { target, owned };
    this.navigation.onArrivedAtPlace.add((arrived) => {
      if (this.current && arrived === this.current.target) onArrive();
    });
    this.navigation.navigateToPlace(target);
    this.arrow.setVisible(true);
  }

  end(): void {
    if (!this.current) return;
    this.arrow.setVisible(false);
    this.navigation.stopNavigation();
    if (this.current.owned) this.navigation.removePlace(this.current.target);
    this.current = null;
  }
}
```

In real code, add the `onArrivedAtPlace` listener once in `OnStartEvent` rather than per walk. While walking, Harlem Might shrinks its card and moves it above eye level, so the arrow has the lower view. Set simulated GPS in Preview from the dropdown at the bottom left of the Preview panel.

## 11. Testing

### In Lens Studio, through the MCP

This loop ran against Preview without touching the screen:

1. `RecompileTypeScriptTool`, then read the errors.
2. `RunAndCollectLogsTool` with refresh, to restart Preview and collect the Logger.
3. `QueryRuntimeSceneTool` to find the `viro-interactable:<id>` uniqueIds of your targets and the `viro-scroll:<id>` objects.
4. `PreviewInteractTool`: Pinch on a target; Drag on a `viro-scroll:<id>` uniqueId to scroll.
5. `CapturePanelScreenshotTool` on `Snap.Plugin.Gui.PreviewPanel`, or `CaptureRuntimeViewTool` with isolate.

`ExecuteEditorCode` can set script inputs, create scene objects, instantiate prefabs and save (`project.save()`). It also pushes to a connected pair: get `LensStudio:PushToDevice` (`IPushToDevice`) with `pluginSystem.findInterface`, check `isSpectaclesConnected()`, then `push([PushType.Spectacles])`. `QueryLensStudioKnowledgeBase` needs a Snap login in Lens Studio.

### In Node

Keep page builders and data clients free of Lens globals (`vec2`, `global`, `require("LensStudio:…")`) and use `import type` for Lens-runtime types. Node 22.18 and later strip the types, so `node --test` runs the `.ts` files directly. Type stripping rejects syntax that emits code, such as constructor parameter properties and `enum`, so avoid those in shared files. Harlem Might tests `HarlemMightContent.ts` this way with a fake fetcher:

```ts
// SpecsContent.test.ts, run with: node --test SpecsContent.test.ts
import assert from "node:assert/strict";
import test from "node:test";
import { SpecsContent } from "./SpecsContent.ts";

test("reads places from the API and tolerates missing fields", async () => {
  const urls: string[] = [];
  const content = new SpecsContent("https://example.test/api/", async (url) => {
    urls.push(url);
    return { docs: [{ id: 1, name: "Apollo Theater" }] };
  });
  const [place] = await content.places();
  assert.equal(urls[0], "https://example.test/api/places?limit=24&sort=name");
  assert.deepEqual(place, { id: "1", name: "Apollo Theater", street: "", imageUrl: null });
});
```

Test the page builder the same way: unique node ids, parents before children, every target pointing at a node, scroll content heights. `examples/specs-sample/SpecsSampleLayout.test.ts` does all four. For a stronger check, run the page through `compileSpecsPresentation` from `@viro-external/specs` in a Node test; it applies the same validation as the Lens host.

## 12. Pitfalls

- **No image renders:** the lab's two image materials are broken. Use the Unlit / Normal / Depth Write off / Base Texture material.
- **A new page's buttons ignore pinches:** binding a target in the frame the page appears fits the collider to the label. The host binds one frame later; a custom host must too.
- **The page throws on present:** an image `source` that isn't registered yet, a target id without a node, or a child listed before its parent. The host rejects the page before clearing the old one.
- **Squashed button text:** the label is a child of the scaled plate. Make it a sibling.
- **Tiny pinch target:** the target group's only visual is a text label. Give it a plate.
- **Lists jump to the top:** every `present()` rebuilds the ScrollWindow. Carry the offset (section 6).
- **A callback you set never fires:** the other component sits lower in the hierarchy and initialized after you, overwriting it. Set callbacks in `OnStartEvent`.
- **WebView is blank:** expected in Preview. On device, check Experimental API and load the URL after the texture callback rather than waiting for `onReady`.
- **A hidden component goes quiet:** you disabled the SceneObject that carries the script. Disable the visual component instead.
- **"URL is not secure":** Experimental API is off, or you used `http://`. Spectacles can't see `localhost` either.
- **Dates are wrong:** Lens has no `Intl` time zones.
- **Text runs off the card:** Lens Text doesn't wrap. Wrap and clip strings yourself, and step title sizes down before clipping.
- **Black looks like a hole:** the display is additive. Back text with a frame and use light colours.
- **Stale scripts fail the compile:** `specs:sync` deletes only files its ledger owns and you did not edit. Move other old files out of `Assets/`. A file deleted while Lens Studio runs can stay registered; restore it or install its missing dependency.
- **Demo objects appear:** installing an Asset Library package through the MCP instantiates its demo into the scene. Delete it.
- **`openProject` refuses:** Lens Studio won't reopen the project that is already open. Switch to another project and back.
