/**
 * Spatial design tokens and premium component specs for the Lens host.
 *
 * Mirrors viro's `components/Specs/core/tokens.ts` and the `component` and
 * `theme` fields of manifest v2. A scene document carries the tokens in
 * `theme`; the host falls back to {@linkcode VIRO_SPECS_LENS_DEFAULT_THEME}
 * when it is absent. `scripts/experience.test.mjs` checks these defaults
 * against the `theme` block in the gallery fixtures viro compiled, so the two
 * copies cannot drift unnoticed.
 *
 * Units are in the names: `Deg` is angular size at the node's distance,
 * `Meters` a physical offset, `Ms` milliseconds. Colors are `#RRGGBB`.
 *
 * Dependency-free and free of Lens globals.
 */

/** Token groups. Same keys as viro's `ViroSpecsSpatialTokens`. */
export type ViroSpecsSpatialTokens = {
  readonly distance: { readonly minMeters: number; readonly defaultMeters: number; readonly maxMeters: number };
  readonly type: {
    readonly minAngleDeg: number;
    readonly titleDeg: number;
    readonly bodyDeg: number;
    readonly labelDeg: number;
    readonly lineHeight: number;
  };
  readonly color: {
    readonly surface: string;
    readonly surfaceRaised: string;
    readonly surfacePressed: string;
    readonly text: string;
    readonly textMuted: string;
    readonly textDisabled: string;
    readonly border: string;
    readonly borderStrong: string;
    readonly focus: string;
    readonly onFocus: string;
    readonly selectedFill: string;
    readonly error: string;
    readonly errorSurface: string;
    readonly degraded: string;
    readonly degradedSurface: string;
    readonly success: string;
    readonly placeholder: string;
  };
  readonly tint: {
    readonly floor: string;
    readonly table: string;
    readonly wall: string;
    readonly seat: string;
    readonly ceiling: string;
    readonly opacity: number;
  };
  readonly space: { readonly xsDeg: number; readonly smDeg: number; readonly mdDeg: number; readonly lgDeg: number; readonly xlDeg: number };
  readonly shape: {
    readonly borderWidthDeg: number;
    readonly borderWidthFocusDeg: number;
    readonly radiusPanelDeg: number;
    readonly radiusButtonDeg: number;
    readonly radiusCardDeg: number;
  };
  readonly depth: { readonly baseMeters: number; readonly raisedMeters: number; readonly hoverMeters: number; readonly overlayMeters: number };
  readonly motion: {
    readonly fastMs: number;
    readonly baseMs: number;
    readonly slowMs: number;
    readonly maxMs: number;
    readonly progressLoopMs: number;
    readonly appearScaleFrom: number;
    readonly hoverScale: number;
  };
  readonly opacity: { readonly surface: number; readonly placeholder: number; readonly disabledBorder: number };
  readonly input: {
    /** Provisional; see viro `docs/specs-experience.md#gaze-dwell`. */
    readonly gazeDwellMs: number;
    readonly lookAwayCancelMs: number;
    readonly gazeStepMeters: number;
    readonly reticleDeg: number;
  };
};

/** What high-contrast mode replaces. */
export type ViroSpecsHighContrastTokens = {
  readonly color: {
    readonly surface: string;
    readonly text: string;
    readonly textMuted: string;
    readonly border: string;
    readonly focus: string;
  };
  readonly surfaceOpacity: number;
  readonly borderScale: number;
  readonly typeBoostDeg: number;
};

/** Wearer preferences. Snap OS exposes no system setting for either (unverified), so the app sets them. */
export type ViroSpecsExperiencePreferences = {
  readonly highContrast: boolean;
  readonly reducedMotion: boolean;
};

/** The `theme` block of a scene document. */
export type ViroSpecsTheme = {
  readonly version: 1;
  readonly tokens: ViroSpecsSpatialTokens;
  readonly highContrast: ViroSpecsHighContrastTokens;
  readonly preferences: ViroSpecsExperiencePreferences;
};

/** PanelButton states the app sets. */
export type ViroSpecsButtonAuthoredState = "idle" | "selected" | "disabled" | "loading" | "error";

/** All seven PanelButton visual states. */
export type ViroSpecsButtonVisualState = ViroSpecsButtonAuthoredState | "hover" | "pressed";

/** Premium component carried on a node. */
export type ViroSpecsComponentSpec =
  | { readonly type: "spatial-panel"; readonly title?: string }
  | { readonly type: "panel-text"; readonly role: "title" | "body" | "label"; readonly tone: "default" | "muted" }
  | { readonly type: "panel-button"; readonly state: ViroSpecsButtonAuthoredState; readonly errorMessage?: string }
  | { readonly type: "panel-image" }
  | { readonly type: "scroll-view"; readonly itemHeightMeters: number; readonly initialIndex: number }
  | { readonly type: "model-viewer"; readonly autoRotate: boolean; readonly resettable: boolean };

/** Node kind each component sits on. */
export const VIRO_SPECS_COMPONENT_NODE_KIND = {
  "spatial-panel": "panel",
  "panel-text": "text",
  "panel-button": "panel",
  "panel-image": "image",
  "scroll-view": "group",
  "model-viewer": "model",
} as const;

/** Default tokens, identical to viro's `VIRO_SPECS_SPATIAL_TOKENS`. */
export const VIRO_SPECS_LENS_SPATIAL_TOKENS: ViroSpecsSpatialTokens = {
  distance: { minMeters: 0.6, defaultMeters: 1.5, maxMeters: 3.0 },
  type: { minAngleDeg: 1.2, titleDeg: 2.0, bodyDeg: 1.4, labelDeg: 1.2, lineHeight: 1.3 },
  color: {
    surface: "#1b2630",
    surfaceRaised: "#26343f",
    surfacePressed: "#33444f",
    text: "#eef2f0",
    textMuted: "#a9b6bf",
    textDisabled: "#808d96",
    border: "#6b7d8c",
    borderStrong: "#c4d0d8",
    focus: "#f2b544",
    onFocus: "#14202a",
    selectedFill: "#3b3320",
    error: "#ff8a7a",
    errorSurface: "#3a1f1e",
    degraded: "#9cc8ff",
    degradedSurface: "#1e2c3d",
    success: "#8fd9b6",
    placeholder: "#6b7d8c",
  },
  tint: { floor: "#8fd9b6", table: "#f2b544", wall: "#9cc8ff", seat: "#d9a6f2", ceiling: "#a9b6bf", opacity: 0.35 },
  space: { xsDeg: 0.4, smDeg: 0.8, mdDeg: 1.2, lgDeg: 2.0, xlDeg: 3.2 },
  shape: { borderWidthDeg: 0.15, borderWidthFocusDeg: 0.3, radiusPanelDeg: 1.2, radiusButtonDeg: 0.8, radiusCardDeg: 0.8 },
  depth: { baseMeters: 0, raisedMeters: 0.005, hoverMeters: 0.01, overlayMeters: 0.03 },
  motion: { fastMs: 120, baseMs: 240, slowMs: 400, maxMs: 500, progressLoopMs: 1200, appearScaleFrom: 0.96, hoverScale: 1.04 },
  opacity: { surface: 0.92, placeholder: 0.4, disabledBorder: 0.5 },
  input: { gazeDwellMs: 1000, lookAwayCancelMs: 1500, gazeStepMeters: 0.1, reticleDeg: 2.0 },
};

/**
 * Default high-contrast replacements. SPECS is an additive display, where
 * black adds no light and shows as the room, so the surface is a mid slate
 * (#42525f) rather than black: visible, and white text on it is 8.07:1.
 */
export const VIRO_SPECS_LENS_HIGH_CONTRAST: ViroSpecsHighContrastTokens = {
  color: { surface: "#42525f", text: "#ffffff", textMuted: "#ffffff", border: "#ffffff", focus: "#ffd25e" },
  surfaceOpacity: 1,
  borderScale: 2,
  typeBoostDeg: 0.2,
};

/** Theme used when a document has none. */
export const VIRO_SPECS_LENS_DEFAULT_THEME: ViroSpecsTheme = {
  version: 1,
  tokens: VIRO_SPECS_LENS_SPATIAL_TOKENS,
  highContrast: VIRO_SPECS_LENS_HIGH_CONTRAST,
  preferences: { highContrast: false, reducedMotion: false },
};

/**
 * Applies preferences: high contrast swaps colors, makes the surface opaque,
 * scales borders and boosts type; reduced motion removes every scale change.
 * Same rules as viro's `resolveSpecsTokens`.
 */
export function resolveViroSpecsTokens(
  theme: ViroSpecsTheme,
  preferences: ViroSpecsExperiencePreferences = theme.preferences
): ViroSpecsSpatialTokens {
  const base = theme.tokens;
  const hc = theme.highContrast;
  const boost = preferences.highContrast ? hc.typeBoostDeg : 0;
  const borderScale = preferences.highContrast ? hc.borderScale : 1;
  return {
    ...base,
    color: preferences.highContrast ? { ...base.color, ...hc.color } : base.color,
    type: {
      ...base.type,
      titleDeg: base.type.titleDeg + boost,
      bodyDeg: base.type.bodyDeg + boost,
      labelDeg: base.type.labelDeg + boost,
    },
    shape: {
      ...base.shape,
      borderWidthDeg: base.shape.borderWidthDeg * borderScale,
      borderWidthFocusDeg: base.shape.borderWidthFocusDeg * borderScale,
    },
    opacity: preferences.highContrast ? { ...base.opacity, surface: hc.surfaceOpacity } : base.opacity,
    motion: preferences.reducedMotion ? { ...base.motion, appearScaleFrom: 1, hoverScale: 1 } : base.motion,
  };
}

/** Meters that subtend `angleDeg` at `distanceMeters`. */
export function viroSpecsAngleToMeters(angleDeg: number, distanceMeters: number): number {
  return 2 * distanceMeters * Math.tan(((angleDeg / 2) * Math.PI) / 180);
}

/** Angle in degrees `sizeMeters` subtends at `distanceMeters`. */
export function viroSpecsMetersToAngle(sizeMeters: number, distanceMeters: number): number {
  if (distanceMeters <= 0) return 180;
  return (2 * Math.atan(sizeMeters / (2 * distanceMeters)) * 180) / Math.PI;
}

/**
 * Lens Text em-square height per Lens size unit, in meters: a size of 43.886
 * draws a 1 cm em (CLAD specs-build-ui type scale). The host passes Viro
 * `fontSize` through as Lens size, so this is also meters per Viro point.
 */
export const VIRO_SPECS_LENS_TEXT_EM_METERS_PER_SIZE = 0.01 / 43.886;

type Report = (path: string, message: string) => void;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Checks one token group against the defaults: same keys, numbers and colors in place. */
function checkGroup(value: unknown, reference: Record<string, unknown>, path: string, fail: Report): void {
  if (!isRecord(value)) {
    fail(path, "Expected an object.");
    return;
  }
  for (const key of Object.keys(value)) {
    if (!(key in reference)) fail(path + "/" + key, "Unknown field `" + key + "`.");
  }
  for (const key of Object.keys(reference)) {
    const expected = reference[key];
    const actual = value[key];
    const at = path + "/" + key;
    if (actual === undefined) fail(at, "Missing token `" + key + "`.");
    else if (typeof expected === "number") {
      if (typeof actual !== "number" || !Number.isFinite(actual) || actual < 0) fail(at, "Expected a finite number >= 0.");
    } else if (typeof expected === "string") {
      // Same rule as viro's validator and schema: #RRGGBB or #RRGGBBAA.
      if (typeof actual !== "string" || !/^#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(actual)) fail(at, "Expected #RRGGBB or #RRGGBBAA.");
    } else if (isRecord(expected)) {
      checkGroup(actual, expected, at, fail);
    }
  }
}

/** Validates a document `theme` block; reports through `fail` and never throws. */
export function checkViroSpecsTheme(value: unknown, path: string, fail: Report): void {
  if (!isRecord(value)) {
    fail(path, "Expected an object.");
    return;
  }
  for (const key of Object.keys(value)) {
    if (!["version", "tokens", "highContrast", "preferences"].includes(key)) fail(path + "/" + key, "Unknown field `" + key + "`.");
  }
  if (value.version !== 1) fail(path + "/version", "Expected 1.");
  checkGroup(value.tokens, VIRO_SPECS_LENS_SPATIAL_TOKENS, path + "/tokens", fail);
  checkGroup(value.highContrast, VIRO_SPECS_LENS_HIGH_CONTRAST, path + "/highContrast", fail);
  const prefs = value.preferences;
  if (!isRecord(prefs)) {
    fail(path + "/preferences", "Expected an object.");
    return;
  }
  for (const key of Object.keys(prefs)) {
    if (key !== "highContrast" && key !== "reducedMotion") fail(path + "/preferences/" + key, "Unknown field `" + key + "`.");
  }
  if (typeof prefs.highContrast !== "boolean") fail(path + "/preferences/highContrast", "Expected a boolean.");
  if (typeof prefs.reducedMotion !== "boolean") fail(path + "/preferences/reducedMotion", "Expected a boolean.");
}

const COMPONENT_FIELDS: Record<string, readonly string[]> = {
  "spatial-panel": ["type", "title"],
  "panel-text": ["type", "role", "tone"],
  "panel-button": ["type", "state", "errorMessage"],
  "panel-image": ["type"],
  "scroll-view": ["type", "itemHeightMeters", "initialIndex"],
  "model-viewer": ["type", "autoRotate", "resettable"],
};

/** Validates a node `component` against its node kind; reports through `fail`. */
export function checkViroSpecsComponent(value: unknown, kind: string, path: string, fail: Report): void {
  if (!isRecord(value)) {
    fail(path, "Expected an object.");
    return;
  }
  const type = value.type;
  const fields = typeof type === "string" ? COMPONENT_FIELDS[type] : undefined;
  if (typeof type !== "string" || fields === undefined) {
    fail(path + "/type", "Expected one of: " + Object.keys(COMPONENT_FIELDS).join(", ") + ".");
    return;
  }
  const expectedKind = VIRO_SPECS_COMPONENT_NODE_KIND[type as keyof typeof VIRO_SPECS_COMPONENT_NODE_KIND];
  if (expectedKind !== kind) fail(path + "/type", type + " needs a " + expectedKind + " node, not " + kind + ".");
  for (const key of Object.keys(value)) {
    if (!fields.includes(key)) fail(path + "/" + key, "Unknown field `" + key + "`.");
  }
  const oneOf = (key: string, allowed: readonly string[], required: boolean): void => {
    const v = value[key];
    if (v === undefined && !required) return;
    if (typeof v !== "string" || !allowed.includes(v)) fail(path + "/" + key, "Expected one of: " + allowed.join(", ") + ".");
  };
  const bool = (key: string): void => {
    if (typeof value[key] !== "boolean") fail(path + "/" + key, "Expected a boolean.");
  };
  const str = (key: string): void => {
    const v = value[key];
    if (v !== undefined && (typeof v !== "string" || v.length === 0)) fail(path + "/" + key, "Expected a non-empty string.");
  };
  switch (type) {
    case "spatial-panel":
      str("title");
      return;
    case "panel-text":
      oneOf("role", ["title", "body", "label"], true);
      oneOf("tone", ["default", "muted"], true);
      return;
    case "panel-button":
      oneOf("state", ["idle", "selected", "disabled", "loading", "error"], true);
      str("errorMessage");
      return;
    case "scroll-view": {
      const h = value.itemHeightMeters;
      if (typeof h !== "number" || !Number.isFinite(h) || h <= 0) fail(path + "/itemHeightMeters", "Expected a finite number > 0.");
      const i = value.initialIndex;
      if (typeof i !== "number" || !Number.isInteger(i) || i < 0) fail(path + "/initialIndex", "Expected an integer >= 0.");
      return;
    }
    case "model-viewer":
      bool("autoRotate");
      bool("resettable");
      return;
  }
}
