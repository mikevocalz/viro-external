import { ViroSpecsPresentationHost } from "../ViroSpecs/lens/ViroSpecsPresentationHost";
import { ViroSpecsAssetRegistry } from "../ViroSpecs/lens/ViroSpecsAssetRegistry";
import { ScrollWindow } from "../ViroSpecs/lens/ViroSpecsUIKit";
import {
  buildPage, listTopEdgeCm, parseItems, LIST_SCROLL_OBJECT, LIST_WINDOW_CM, SAMPLE_ITEMS, TABS,
  type SampleState, type TabId,
} from "./SpecsSampleLayout";

/**
 * A two-tab Specs page built on ViroSpecsPresentationHost: a header with one
 * registry image, a left tab rail, a scrolling two-column list of cards and a
 * detail page with Back. Runs on built-in sample data; set internetModule and
 * dataUrl to load `{ places, music }` JSON instead.
 */
@component
export class SpecsSampleApp extends BaseScriptComponent {
  @input
  @hint("SceneObject holding ViroSpecsPresentationHost")
  presentationHostObject: SceneObject;

  @input
  @allowUndefined
  @hint("SceneObject holding ViroSpecsAssetRegistry; needed for the header image")
  assetRegistryObject: SceneObject;

  @input
  @hint("Image id from the registry's imageIds, drawn in the header. Leave empty for none")
  headerImageId: string = "sample-logo";

  @input
  @allowUndefined
  @hint("Internet Module asset; only needed with dataUrl")
  internetModule: InternetModule;

  @input
  @hint("Optional JSON endpoint returning { places: Item[], music: Item[] }. http:// needs Experimental API")
  dataUrl: string = "";

  private presentation: ViroSpecsPresentationHost | null = null;
  private registry: ViroSpecsAssetRegistry | null = null;
  private unsubscribe: (() => void) | null = null;
  private state: SampleState = {
    tab: "places",
    selected: null,
    items: { places: SAMPLE_ITEMS.places, music: SAMPLE_ITEMS.music },
    status: { places: "sample", music: "sample" },
  };
  // Scroll offset from the top of the list in cm, carried across present().
  private listFromTopCm = 0;
  private listContentCm = 0;
  private listShownFor: TabId | null = null;

  onAwake(): void {
    this.presentation = this.presentationHostObject.getComponent(
      ViroSpecsPresentationHost.getTypeName()
    ) as ViroSpecsPresentationHost | null;
    if (!this.presentation) throw new Error("SpecsSampleApp requires ViroSpecsPresentationHost.");
    this.registry = (this.assetRegistryObject?.getComponent(
      ViroSpecsAssetRegistry.getTypeName()
    ) as ViroSpecsAssetRegistry | null) ?? null;
    // Wire callbacks at start, not awake: hosts lower in the hierarchy
    // initialize after this script.
    this.createEvent("OnStartEvent").bind(() => {
      this.unsubscribe = this.presentation!.subscribeAction((action) => this.onAction(action));
      this.load();
      this.render();
    });
    this.createEvent("OnDestroyEvent").bind(() => {
      this.unsubscribe?.();
      this.unsubscribe = null;
    });
  }

  private onAction(action: string): void {
    if (action.startsWith("tab:")) {
      const tab = action.slice(4) as TabId;
      if (!TABS.some((t) => t.id === tab)) return;
      this.state.tab = tab;
      this.state.selected = null;
      this.listFromTopCm = 0;
    } else if (action.startsWith("open:")) {
      this.state.selected = action.slice(5);
    } else if (action === "back") {
      this.state.selected = null;
    } else {
      return;
    }
    this.render();
  }

  private load(): void {
    if (!this.internetModule || !this.dataUrl) return;
    this.state.status = { places: "loading", music: "loading" };
    this.internetModule.fetch(new Request(this.dataUrl, { method: "GET", headers: { accept: "application/json" } }))
      .then((response) => {
        if (response.status !== 200) throw new Error("HTTP " + response.status);
        return response.json();
      })
      .then((json) => {
        const items = parseItems(json);
        for (const tab of TABS) {
          const list = items[tab.id];
          if (list) this.state.items[tab.id] = list;
          this.state.status[tab.id] = list ? "live" : "offline";
        }
        this.render();
      }, (error) => {
        print("[SpecsSampleApp] " + this.dataUrl + " failed: " + error);
        this.state.status = { places: "offline", music: "offline" };
        this.render();
      });
  }

  private render(): void {
    if (!this.presentation) return;
    this.rememberListScroll();
    const imageId = this.headerImageId && this.registry?.resolveImage(this.headerImageId) ? this.headerImageId : null;
    const page = buildPage(this.state, imageId);
    this.presentation.present(page.snapshot);
    this.listContentCm = page.listContentCm;
    this.restoreListScroll();
  }

  // present() rebuilds the ScrollWindow at the top, so read the offset of the
  // list on screen before replacing it.
  private rememberListScroll(): void {
    if (this.listShownFor !== this.state.tab) return;
    const window = this.listWindow();
    if (window) this.listFromTopCm = window.scrollPosition.y - listTopEdgeCm(this.listContentCm);
  }

  private restoreListScroll(): void {
    const window = this.state.selected ? null : this.listWindow();
    this.listShownFor = window ? this.state.tab : null;
    if (!window) return;
    const max = Math.max(0, this.listContentCm - LIST_WINDOW_CM[1]);
    const fromTop = Math.min(max, Math.max(0, this.listFromTopCm));
    window.scrollPosition = new vec2(0, listTopEdgeCm(this.listContentCm) + fromTop);
  }

  private listWindow(): ScrollWindow | null {
    const object = findByName(LIST_SCROLL_OBJECT);
    return object ? (object.getComponent(ScrollWindow.getTypeName()) as ScrollWindow | null) : null;
  }
}

function findByName(name: string): SceneObject | null {
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
