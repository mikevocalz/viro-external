/**
 * Reference flow for typed actions: select a card, see its details, change a
 * setting, see the view update, go back to the list at the scroll position
 * it was left at. Runs standalone in the Lens (no phone, no server).
 *
 * The same flow ships in viro as the React Native Platform Lab screen
 * `SpecsActionsLab` (Zustand store) and as compiled fixtures; IDs, action
 * declarations and node IDs match so either side can drive the other.
 *
 * Dependency-free and free of Lens globals.
 */
import type {
  ViroSpecsActionDeclaration,
  ViroSpecsDocumentInteraction,
  ViroSpecsDocumentNode,
  ViroSpecsSceneDocumentV2,
} from "./ViroSpecsProtocol";
import type { ViroSpecsHostDiagnostics } from "./ViroSpecsHostDiagnostics";
import { ViroSpecsActionRegistry } from "./ViroSpecsActionRuntime";

/** One card in the list. */
export type ViroSpecsReferenceExhibit = { readonly id: string; readonly title: string; readonly distanceMeters: number };

/** Distance unit setting. */
export type ViroSpecsReferenceUnits = "metric" | "imperial";

/** App state of the reference flow. */
export type ViroSpecsReferenceFlowState = {
  readonly route: "list" | "details";
  readonly exhibits: readonly ViroSpecsReferenceExhibit[];
  /** Card shown on the details route and highlighted on the list. */
  readonly selectedId?: string;
  readonly units: ViroSpecsReferenceUnits;
};

/** Action declarations: the contract both the Lens and a phone app use. */
export const VIRO_SPECS_REFERENCE_ACTIONS: ViroSpecsActionDeclaration[] = [
  { id: "exhibit.open", payload: { exhibitId: { type: "string" } } },
  { id: "settings.set-units", payload: { units: { type: "string", enum: ["metric", "imperial"] } } },
  { id: "nav.back" },
];

/** Eight cards, more than the list window shows, so the list scrolls. */
export const VIRO_SPECS_REFERENCE_INITIAL_STATE: ViroSpecsReferenceFlowState = {
  route: "list",
  units: "metric",
  exhibits: [
    { id: "orrery", title: "Orrery", distanceMeters: 12 },
    { id: "pendulum", title: "Foucault Pendulum", distanceMeters: 40 },
    { id: "tesla-coil", title: "Tesla Coil", distanceMeters: 75 },
    { id: "planetarium", title: "Planetarium", distanceMeters: 120 },
    { id: "wind-tunnel", title: "Wind Tunnel", distanceMeters: 160 },
    { id: "seismograph", title: "Seismograph", distanceMeters: 210 },
    { id: "cloud-chamber", title: "Cloud Chamber", distanceMeters: 260 },
    { id: "lighthouse-lens", title: "Lighthouse Lens", distanceMeters: 330 },
  ],
};

const ROW_HEIGHT = 0.07;
const LIST_HEIGHT = 0.28;

/** Pure reducers for the reference actions. */
export function registerViroSpecsReferenceHandlers(registry: ViroSpecsActionRegistry<ViroSpecsReferenceFlowState>): void {
  registry.on("exhibit.open", (state, payload) => {
    const id = String(payload.exhibitId);
    return state.exhibits.some((e) => e.id === id) ? { ...state, route: "details", selectedId: id } : state;
  });
  registry.on("settings.set-units", (state, payload) =>
    payload.units === state.units ? state : { ...state, units: payload.units === "imperial" ? "imperial" : "metric" }
  );
  registry.on("nav.back", (state) => (state.route === "list" ? state : { ...state, route: "list" }));
}

/** Registry with the reference declarations and handlers. */
export function createViroSpecsReferenceRegistry(diagnostics: ViroSpecsHostDiagnostics): ViroSpecsActionRegistry<ViroSpecsReferenceFlowState> {
  const registry = new ViroSpecsActionRegistry<ViroSpecsReferenceFlowState>(VIRO_SPECS_REFERENCE_ACTIONS, diagnostics);
  registerViroSpecsReferenceHandlers(registry);
  return registry;
}

/** Distance label in the chosen units. */
export function formatViroSpecsReferenceDistance(meters: number, units: ViroSpecsReferenceUnits): string {
  return units === "imperial" ? Math.round(meters * 3.28084) + " ft away" : meters + " m away";
}

/** Scene for `state`. Pure: same state, same document. */
export function viewViroSpecsReferenceFlow(state: ViroSpecsReferenceFlowState): ViroSpecsSceneDocumentV2 {
  const nodes: ViroSpecsDocumentNode[] = [
    { id: "flow-panel", kind: "panel", position: [0, 0, -1.2], extents: { width: 0.5, height: 0.42 }, materialId: "surface" },
  ];
  const interactions: ViroSpecsDocumentInteraction[] = [];
  const selected = state.exhibits.find((e) => e.id === state.selectedId);

  if (state.route === "list" || !selected) {
    nodes.push(
      { id: "list-title", kind: "text", parentId: "flow-panel", text: "Exhibits", position: [0, 0.17, 0.01],
        style: { fontSize: 28, fontWeight: "bold", color: "#f2f2f2" }, extents: { width: 0.44, height: 0.05 } },
      { id: "exhibit-list", kind: "group", parentId: "flow-panel", position: [0, -0.02, 0.01],
        scroll: { width: 0.44, height: LIST_HEIGHT, contentHeight: state.exhibits.length * ROW_HEIGHT } }
    );
    state.exhibits.forEach((exhibit, index) => {
      const cardId = "card-" + exhibit.id;
      nodes.push(
        { id: cardId, kind: "panel", parentId: "exhibit-list", position: [0, LIST_HEIGHT / 2 - ROW_HEIGHT * (index + 0.5), 0],
          extents: { width: 0.42, height: ROW_HEIGHT - 0.008 }, materialId: exhibit.id === state.selectedId ? "card-selected" : "card" },
        { id: cardId + "-label", kind: "text", parentId: cardId, text: exhibit.title, position: [0, 0, 0.005],
          style: { fontSize: 22, color: "#f2f2f2", textAlign: "left" }, extents: { width: 0.38, height: 0.04 } }
      );
      interactions.push({
        nodeId: cardId, interactable: true, manipulation: false, events: ["hover", "select"],
        triggers: [{ on: "select", actionId: "exhibit.open", payload: { exhibitId: exhibit.id } }],
      });
    });
  } else {
    const nextUnits = state.units === "metric" ? "imperial" : "metric";
    nodes.push(
      { id: "details-title", kind: "text", parentId: "flow-panel", text: selected.title, position: [0, 0.15, 0.01],
        style: { fontSize: 28, fontWeight: "bold", color: "#f2f2f2" }, extents: { width: 0.44, height: 0.05 } },
      { id: "details-distance", kind: "text", parentId: "flow-panel", text: formatViroSpecsReferenceDistance(selected.distanceMeters, state.units),
        position: [0, 0.07, 0.01], style: { fontSize: 22, color: "#d0d0d0" }, extents: { width: 0.44, height: 0.04 } },
      { id: "units-toggle", kind: "panel", parentId: "flow-panel", position: [0, -0.04, 0.01],
        extents: { width: 0.3, height: 0.06 }, materialId: "button" },
      { id: "units-toggle-label", kind: "text", parentId: "units-toggle", position: [0, 0, 0.005],
        text: nextUnits === "imperial" ? "Show feet" : "Show meters", style: { fontSize: 20, color: "#ffffff", textAlign: "center" },
        extents: { width: 0.28, height: 0.04 } },
      { id: "back-button", kind: "panel", parentId: "flow-panel", position: [0, -0.14, 0.01],
        extents: { width: 0.3, height: 0.06 }, materialId: "button" },
      { id: "back-button-label", kind: "text", parentId: "back-button", position: [0, 0, 0.005], text: "Back to exhibits",
        style: { fontSize: 20, color: "#ffffff", textAlign: "center" }, extents: { width: 0.28, height: 0.04 } }
    );
    interactions.push(
      { nodeId: "units-toggle", interactable: true, manipulation: false, events: ["hover", "select"],
        triggers: [{ on: "select", actionId: "settings.set-units", payload: { units: nextUnits } }] },
      { nodeId: "back-button", interactable: true, manipulation: false, events: ["hover", "select"],
        triggers: [{ on: "select", actionId: "nav.back" }] }
    );
  }

  return {
    version: 2,
    route: state.route === "list" || !selected ? "list" : "details",
    actions: VIRO_SPECS_REFERENCE_ACTIONS,
    nodes,
    materials: [
      { id: "surface", color: "#1c1f26", opacity: 0.92 },
      { id: "card", color: "#2b303b" },
      { id: "card-selected", color: "#3d6ee8" },
      { id: "button", color: "#3d6ee8" },
    ],
    interactions,
  };
}
