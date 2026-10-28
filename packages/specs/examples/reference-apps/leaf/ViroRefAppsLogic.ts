/**
 * State, action handlers and views for the three reference apps when the
 * Lens runs them standalone (no phone). Each view takes the scene document
 * viro compiled (`../scenes/*.scene.json`, embedded for the Lens in
 * `ViroRefAppScenes.ts`) and returns it with the state applied, so the
 * initial state renders the compiled document unchanged and every other
 * state is a patch on the same route.
 *
 * No imports and no Lens globals: the LEAF scenarios use this file inside
 * Lens Studio, and `reference-apps.test.mjs` runs it under Node.
 *
 * The data tables mirror viro `examples/specs-reference-apps/*.tsx`
 * (DASHBOARD_METRICS, DASHBOARD_RANGES, MODEL_SIZE_STEPS, PLACEMENT_PROMPTS).
 * Change both together.
 */

/** A scene protocol 2 document, as loose JSON. */
export type ViroRefSceneDocument = {
  version: 2;
  route?: string;
  nodes: ViroRefNode[];
  [key: string]: unknown;
};

export type ViroRefNode = {
  id: string;
  [key: string]: unknown;
};

/** Payload of a typed action, as the Lens registry hands it over. */
export type ViroRefPayload = Readonly<Record<string, string | number | boolean>>;

/** Handler shape `ViroSpecsActionRegistry.on` accepts. */
export type ViroRefHandler<S> = (state: S, payload: ViroRefPayload) => S;

function clone(doc: ViroRefSceneDocument): ViroRefSceneDocument {
  return JSON.parse(JSON.stringify(doc)) as ViroRefSceneDocument;
}

function node(doc: ViroRefSceneDocument, id: string): ViroRefNode {
  const found = doc.nodes.find((n) => n.id === id);
  if (!found) throw new Error("Reference scene has no node " + id);
  return found;
}

function setVisible(target: ViroRefNode, visible: boolean): void {
  // The compiler writes `visible` only when it is false.
  if (visible) delete target.visible;
  else target.visible = false;
}

const TEXT = "#eef2f0";
const ACCENT = "#f2b544";

// --- Spatial dashboard ---------------------------------------------------------

export type ViroRefDashboardRange = "1h" | "24h" | "7d";

export type ViroRefDashboardState = {
  readonly range: ViroRefDashboardRange;
  readonly refreshes: number;
};

export const VIRO_REF_DASHBOARD_INITIAL: ViroRefDashboardState = { range: "24h", refreshes: 0 };

export const VIRO_REF_DASHBOARD_METRICS: ReadonlyArray<{ id: string; values: Readonly<Record<ViroRefDashboardRange, string>> }> = [
  { id: "temp", values: { "1h": "21.4 °C", "24h": "20.8 °C", "7d": "20.1 °C" } },
  { id: "humidity", values: { "1h": "48 %", "24h": "51 %", "7d": "55 %" } },
  { id: "co2", values: { "1h": "612 ppm", "24h": "580 ppm", "7d": "540 ppm" } },
];

export const VIRO_REF_DASHBOARD_STATUS: Readonly<Record<ViroRefDashboardRange, string>> = {
  "1h": "Averages over the last hour",
  "24h": "Averages over the last 24 hours",
  "7d": "Averages over the last 7 days",
};

const RANGES: readonly ViroRefDashboardRange[] = ["1h", "24h", "7d"];

export const VIRO_REF_DASHBOARD_HANDLERS: Readonly<Record<string, ViroRefHandler<ViroRefDashboardState>>> = {
  "dashboard.set-range": (state, payload) => {
    const range = RANGES.find((r) => r === payload.range);
    return range === undefined || range === state.range ? state : { ...state, range };
  },
  "dashboard.refresh": (state) => ({ ...state, refreshes: state.refreshes + 1 }),
};

/** Status line: the range, plus how often it was refreshed. */
export function viroRefDashboardStatus(state: ViroRefDashboardState): string {
  const base = VIRO_REF_DASHBOARD_STATUS[state.range];
  return state.refreshes === 0 ? base : base + ", refreshed";
}

export function viewViroRefDashboard(base: ViroRefSceneDocument, state: ViroRefDashboardState): ViroRefSceneDocument {
  const doc = clone(base);
  for (const metric of VIRO_REF_DASHBOARD_METRICS) node(doc, "dash-card-" + metric.id + "-value").text = metric.values[state.range];
  for (const range of RANGES) {
    const style = node(doc, "dash-range-" + range).style as Record<string, unknown>;
    style.color = range === state.range ? ACCENT : TEXT;
  }
  node(doc, "dash-status").text = viroRefDashboardStatus(state);
  return doc;
}

// --- Model viewer --------------------------------------------------------------

export type ViroRefModelState = {
  readonly yawDegrees: number;
  readonly sizeStep: number;
};

export const VIRO_REF_MODEL_INITIAL: ViroRefModelState = { yawDegrees: 0, sizeStep: 0 };

/** 60 % to 160 % of the authored scale, 20 % per step. */
export const VIRO_REF_MODEL_SIZE_STEPS = { min: -2, max: 3, percentPerStep: 20 } as const;

export const VIRO_REF_MODEL_HANDLERS: Readonly<Record<string, ViroRefHandler<ViroRefModelState>>> = {
  "model.turn": (state, payload) => {
    const degrees = typeof payload.degrees === "number" ? payload.degrees : 0;
    return { ...state, yawDegrees: (((state.yawDegrees + degrees) % 360) + 360) % 360 };
  },
  "model.resize": (state, payload) => {
    const step = typeof payload.step === "number" ? payload.step : 0;
    const sizeStep = Math.min(VIRO_REF_MODEL_SIZE_STEPS.max, Math.max(VIRO_REF_MODEL_SIZE_STEPS.min, state.sizeStep + step));
    return sizeStep === state.sizeStep ? state : { ...state, sizeStep };
  },
  "model.reset": (state) => (state.yawDegrees === 0 && state.sizeStep === 0 ? state : VIRO_REF_MODEL_INITIAL),
};

export function viroRefModelStatus(state: ViroRefModelState): string {
  const facing = state.yawDegrees === 0 ? "Facing front" : "Turned " + state.yawDegrees + "°";
  return facing + ", size " + (100 + state.sizeStep * VIRO_REF_MODEL_SIZE_STEPS.percentPerStep) + " %";
}

/** Unit quaternion `[x, y, z, w]` for a turn about the vertical axis. */
export function viroRefYawQuaternion(degrees: number): [number, number, number, number] {
  const half = (degrees * Math.PI) / 360;
  return [0, Math.sin(half), 0, Math.cos(half)];
}

export function viewViroRefModel(base: ViroRefSceneDocument, state: ViroRefModelState): ViroRefSceneDocument {
  const doc = clone(base);
  const model = node(doc, "mv-model");
  const authored = node(base, "mv-model").scale as [number, number, number];
  const factor = 1 + (state.sizeStep * VIRO_REF_MODEL_SIZE_STEPS.percentPerStep) / 100;
  model.scale = [authored[0] * factor, authored[1] * factor, authored[2] * factor];
  if (state.yawDegrees === 0) delete model.rotation;
  else model.rotation = viroRefYawQuaternion(state.yawDegrees);
  node(doc, "mv-status").text = viroRefModelStatus(state);
  return doc;
}

// --- World-placed info -----------------------------------------------------------

export type ViroRefPlacementPhase = "idle" | "placing" | "placed";

export type ViroRefPlacementState = {
  readonly phase: ViroRefPlacementPhase;
  readonly position?: readonly [number, number, number];
};

export const VIRO_REF_PLACEMENT_INITIAL: ViroRefPlacementState = { phase: "idle" };

export const VIRO_REF_PLACEMENT_PROMPTS: Readonly<Record<ViroRefPlacementPhase, string>> = {
  idle: "Pinch Place card, then look at a table or the floor.",
  placing: "Look at a table or the floor, then pinch to place.",
  placed: "Card placed. Pinch Move card to place it again.",
};

export const VIRO_REF_PLACEMENT_HANDLERS: Readonly<Record<string, ViroRefHandler<ViroRefPlacementState>>> = {
  "placement.start": (state) => (state.phase === "placing" ? state : { ...state, phase: "placing" }),
  "placement.cancel": (state) =>
    state.phase !== "placing" ? state : state.position !== undefined ? { ...state, phase: "placed" } : { phase: "idle" },
  "placement.confirm": (state, payload) => {
    if (state.phase !== "placing") return state;
    const { x, y, z } = payload;
    if (typeof x !== "number" || typeof y !== "number" || typeof z !== "number") return state;
    return { phase: "placed", position: [x, y, z] };
  },
};

/** Yaw that turns a panel's front (+Z) toward a wearer at the origin. */
export function viroRefFacingWearer(position: readonly [number, number, number]): [number, number, number, number] {
  const degrees = (Math.atan2(-position[0], -position[2]) * 180) / Math.PI;
  return viroRefYawQuaternion(degrees);
}

export function viewViroRefPlacement(base: ViroRefSceneDocument, state: ViroRefPlacementState): ViroRefSceneDocument {
  const doc = clone(base);
  const card = node(doc, "wpi-card");
  if (state.position !== undefined) {
    card.position = [state.position[0], state.position[1], state.position[2]];
    card.rotation = viroRefFacingWearer(state.position);
  }
  setVisible(card, state.position !== undefined);
  node(doc, "wpi-prompt").text = VIRO_REF_PLACEMENT_PROMPTS[state.phase];
  node(doc, "wpi-place").text = state.phase === "idle" ? "Place card" : "Move card";
  setVisible(node(doc, "wpi-cancel"), state.phase === "placing");
  return doc;
}

/** Every node ID the LEAF scenarios and the Node test name, per app. */
export const VIRO_REF_NODE_IDS = {
  dashboard: {
    panel: "dash-panel",
    title: "dash-title",
    values: ["dash-card-temp-value", "dash-card-humidity-value", "dash-card-co2-value"],
    ranges: ["dash-range-1h", "dash-range-24h", "dash-range-7d"],
    refresh: "dash-refresh",
    status: "dash-status",
  },
  model: {
    model: "mv-model",
    panel: "mv-panel",
    status: "mv-status",
    turnLeft: "mv-turn-left",
    turnRight: "mv-turn-right",
    smaller: "mv-smaller",
    larger: "mv-larger",
    reset: "mv-reset",
  },
  placement: {
    card: "wpi-card",
    cardTitle: "wpi-card-title",
    controls: "wpi-controls",
    prompt: "wpi-prompt",
    place: "wpi-place",
    cancel: "wpi-cancel",
  },
} as const;
