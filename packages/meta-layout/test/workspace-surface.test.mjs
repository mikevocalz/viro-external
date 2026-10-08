/**
 * Workspace surface contract (@viro-external/xr-contract) and the Meta
 * Horizon resolver (@viro-external/meta-layout).
 *
 * Runs the TypeScript sources the way Metro bundles them:
 *   pnpm test:workspace-surface
 */
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  WORKSPACE_ROLE_TO_SPATIAL_ROLE,
  evaluateWorkspaceRequirement,
  isWorkspaceSurfaceMounted,
  validateWorkspaceDefinition,
} from "@viro-external/xr-contract";
import {
  META_HORIZON_RN_DEFAULT_SLOT_BUDGET,
  MetaHorizonLayoutAdapter,
  resolveMetaWorkspace,
  toMetaPriority,
  toMetaSpatialWindowProps,
} from "../src/index.ts";

const FOCUS_SECONDARY = { focus: "passive", back: "return-to-main" };

const main = {
  id: "map",
  role: "main",
  presentation: { kind: "main" },
  fallback: { kind: "inline", region: "overlay" },
  requires: { kind: "none" },
  focus: { focus: "primary", back: "exit" },
  lifecycle: { owner: "workspace" },
};

const discover = {
  id: "discover",
  role: "discover",
  presentation: {
    kind: "window",
    size: { unit: "dp", width: 360, height: 640 },
    anchor: { side: "start", depth: "near" },
    priority: 20,
  },
  fallback: { kind: "inline", region: "leading" },
  requires: { kind: "none" },
  focus: FOCUS_SECONDARY,
  lifecycle: { owner: "workspace" },
};

const detail = {
  id: "place-detail",
  role: "detail",
  presentation: {
    kind: "window",
    size: { unit: "dp", width: 440, height: 640 },
    anchor: { side: "end" },
    priority: 10,
  },
  fallback: { kind: "inline", region: "trailing" },
  requires: { kind: "none" },
  focus: { focus: "take-on-open", back: "close" },
  lifecycle: { owner: "selection", selectionKey: "place" },
};

const assistant = {
  id: "mights",
  role: "assistant",
  presentation: { kind: "layer", region: "overlay" },
  fallback: { kind: "inline", region: "overlay" },
  requires: { kind: "none" },
  focus: FOCUS_SECONDARY,
  lifecycle: { owner: "user" },
};

const tools = {
  id: "tools",
  role: "tools",
  presentation: {
    kind: "window",
    size: { unit: "percent-of-main", widthPercent: 40, heightPercent: 20 },
    anchor: { side: "bottom", depth: "far" },
    priority: 0,
  },
  fallback: { kind: "drop" },
  requires: { kind: "none" },
  focus: FOCUS_SECONDARY,
  lifecycle: { owner: "workspace" },
};

function workspace(surfaces, extra = {}) {
  return { id: "explore", surfaces, ...extra };
}

const SELECTED = { selections: ["place"], openSurfaceIds: ["mights"] };
const NOTHING_SELECTED = { selections: [], openSurfaceIds: [] };
const HORIZON = { isSpatialAvailable: true };
const FLAT = { isSpatialAvailable: false };

const kinds = (resolution) => resolution.entries.map((e) => `${e.kind}:${e.surface.id}`);
const omittedReasons = (resolution) =>
  Object.fromEntries(resolution.omitted.map((o) => [o.surface.id, o.reason]));

describe("role mapping", () => {
  test("main renders first as the main entry and is never a window", () => {
    const r = resolveMetaWorkspace(
      { definition: workspace([discover, main, detail]), activity: SELECTED },
      HORIZON
    );
    assert.equal(r.entries[0].kind, "main");
    assert.equal(r.entries[0].surface.id, "map");
    assert.ok(!r.entries.some((e) => e.kind === "window" && e.surface.role === "main"));
  });

  test("discover anchors at start, detail at end, as explicit AnchorPairs", () => {
    const r = resolveMetaWorkspace(
      { definition: workspace([main, discover, detail]), activity: SELECTED },
      HORIZON
    );
    const windows = Object.fromEntries(
      r.entries.filter((e) => e.kind === "window").map((e) => [e.surface.role, e.window])
    );
    assert.deepEqual(windows.discover.anchor, { parent: "start", child: "end" });
    assert.deepEqual(windows.detail.anchor, { parent: "end", child: "start" });
  });

  test("depth maps to a neutral +z offset; flush passes no offset", () => {
    const r = resolveMetaWorkspace(
      { definition: workspace([main, discover, detail, tools], { maxPromotedSurfaces: 3 }), activity: SELECTED },
      { isSpatialAvailable: true, maxPromotedWindows: 3 }
    );
    const byId = Object.fromEntries(r.entries.filter((e) => e.kind === "window").map((e) => [e.surface.id, e.window]));
    assert.deepEqual(byId.discover.offset, { z: 1 });
    assert.equal("offset" in byId["place-detail"], false);
    assert.deepEqual(byId.tools.offset, { z: 5 });
    assert.deepEqual(byId.tools.anchor, { parent: "bottom", child: "top" });
  });

  test("percent sizes become Meta percentage strings, dp stay numbers", () => {
    const r = resolveMetaWorkspace(
      { definition: workspace([main, tools]), activity: NOTHING_SELECTED },
      HORIZON
    );
    const win = r.entries.find((e) => e.kind === "window").window;
    assert.equal(win.windowWidth, "40%");
    assert.equal(win.windowHeight, "20%");
  });

  test("assistant layer renders inline in its region and never takes a slot", () => {
    const r = resolveMetaWorkspace(
      { definition: workspace([main, assistant, discover, detail]), activity: SELECTED },
      HORIZON
    );
    const entry = r.entries.find((e) => e.surface.id === "mights");
    assert.deepEqual({ kind: entry.kind, region: entry.region, reason: entry.reason }, {
      kind: "inline",
      region: "overlay",
      reason: "layer",
    });
    assert.equal(r.entries.filter((e) => e.kind === "window").length, 2);
  });

  test("each workspace role has a legacy SpatialSurfaceRole", () => {
    assert.deepEqual(WORKSPACE_ROLE_TO_SPATIAL_ROLE, {
      main: "content",
      discover: "master",
      detail: "inspector",
      assistant: "popup",
      tools: "accessory",
    });
  });
});

describe("priority arbitration", () => {
  test("higher priority wins the slots and is mounted first", () => {
    const r = resolveMetaWorkspace(
      { definition: workspace([main, tools, detail, discover]), activity: SELECTED },
      HORIZON
    );
    assert.deepEqual(kinds(r), ["main:map", "window:discover", "window:place-detail"]);
    assert.equal(omittedReasons(r).tools, "over-capacity");
  });

  test("ties go to declaration order after Meta-style rounding", () => {
    const a = { ...discover, id: "a", presentation: { ...discover.presentation, priority: 10.4 } };
    const b = { ...discover, id: "b", presentation: { ...discover.presentation, priority: 10 } };
    const c = { ...discover, id: "c", presentation: { ...discover.presentation, priority: 9.6 } };
    const r = resolveMetaWorkspace(
      { definition: workspace([main, c, b, a]), activity: NOTHING_SELECTED },
      HORIZON
    );
    assert.deepEqual(kinds(r).slice(1, 3), ["window:c", "window:b"]);
    assert.deepEqual(r.entries.slice(1, 3).map((e) => e.window.priority), [10, 10]);
  });

  test("toMetaPriority rounds, zeroes non-finite values and clamps to int32", () => {
    assert.equal(toMetaPriority(9.5), 10);
    assert.equal(toMetaPriority(Number.NaN), 0);
    assert.equal(toMetaPriority(Number.POSITIVE_INFINITY), 0);
    assert.equal(toMetaPriority(1e12), 2147483647);
    assert.equal(toMetaPriority(-1e12), -2147483648);
  });
});

describe("capacity", () => {
  test("defaults to two extra windows", () => {
    assert.equal(META_HORIZON_RN_DEFAULT_SLOT_BUDGET, 2);
    const r = resolveMetaWorkspace(
      { definition: workspace([main, discover, detail, tools]), activity: SELECTED },
      HORIZON
    );
    assert.equal(r.windowBudget, 2);
    assert.equal(r.entries.filter((e) => e.kind === "window").length, 2);
  });

  test("runtime capacity limits the windows", () => {
    const r = resolveMetaWorkspace(
      { definition: workspace([main, discover, detail]), activity: SELECTED },
      { isSpatialAvailable: true, maxPromotedWindows: 1 }
    );
    assert.deepEqual(kinds(r), ["main:map", "window:discover", "inline:place-detail"]);
  });

  test("maxPromotedSurfaces caps below the runtime capacity", () => {
    const r = resolveMetaWorkspace(
      { definition: workspace([main, discover, detail], { maxPromotedSurfaces: 1 }), activity: SELECTED },
      { isSpatialAvailable: true, maxPromotedWindows: 4 }
    );
    assert.equal(r.windowBudget, 1);
    assert.deepEqual(kinds(r), ["main:map", "window:discover", "inline:place-detail"]);
  });

  test("maxPromotedSurfaces cannot raise the runtime capacity", () => {
    const r = resolveMetaWorkspace(
      { definition: workspace([main, discover, detail, tools], { maxPromotedSurfaces: 5 }), activity: SELECTED },
      HORIZON
    );
    assert.equal(r.windowBudget, 2);
  });

  test("a zero budget keeps everything in the main window", () => {
    const r = resolveMetaWorkspace(
      { definition: workspace([main, discover, detail], { maxPromotedSurfaces: 0 }), activity: SELECTED },
      HORIZON
    );
    assert.deepEqual(kinds(r), ["main:map", "inline:discover", "inline:place-detail"]);
  });

  test("an invalid runtime capacity throws", () => {
    for (const bad of [-1, 1.5, Number.NaN]) {
      assert.throws(
        () => resolveMetaWorkspace(
          { definition: workspace([main]), activity: NOTHING_SELECTED },
          { isSpatialAvailable: true, maxPromotedWindows: bad }
        ),
        RangeError
      );
    }
  });
});

describe("fallback", () => {
  test("inline fallback renders in its region with the reason", () => {
    const r = resolveMetaWorkspace(
      { definition: workspace([main, discover, detail]), activity: SELECTED },
      { isSpatialAvailable: true, maxPromotedWindows: 1 }
    );
    const entry = r.entries.find((e) => e.surface.id === "place-detail");
    assert.deepEqual({ kind: entry.kind, region: entry.region, reason: entry.reason }, {
      kind: "inline",
      region: "trailing",
      reason: "over-capacity",
    });
  });

  test("drop fallback is omitted, not rendered", () => {
    const r = resolveMetaWorkspace(
      { definition: workspace([main, discover, detail, tools]), activity: SELECTED },
      HORIZON
    );
    assert.equal(r.entries.some((e) => e.surface.id === "tools"), false);
    assert.equal(omittedReasons(r).tools, "over-capacity");
  });

  test("window props carry the surface's fallback kind", () => {
    const r = resolveMetaWorkspace(
      { definition: workspace([main, tools]), activity: NOTHING_SELECTED },
      HORIZON
    );
    assert.equal(r.entries[1].window.fallback, "drop");
    assert.equal(r.entries[1].window.promotable, true);
  });
});

describe("stable ids", () => {
  test("labels are the surface ids", () => {
    const r = resolveMetaWorkspace(
      { definition: workspace([main, discover, detail]), activity: SELECTED },
      HORIZON
    );
    for (const e of r.entries.filter((x) => x.kind === "window")) {
      assert.equal(e.window.label, e.surface.id);
    }
  });

  test("the same input resolves to the same output", () => {
    const intent = { definition: workspace([main, assistant, discover, detail, tools]), activity: SELECTED };
    assert.deepEqual(resolveMetaWorkspace(intent, HORIZON), resolveMetaWorkspace(intent, HORIZON));
  });

  test("a surface keeps its label when another surface mounts", () => {
    const before = resolveMetaWorkspace(
      { definition: workspace([main, discover, detail]), activity: NOTHING_SELECTED },
      HORIZON
    );
    const after = resolveMetaWorkspace(
      { definition: workspace([main, discover, detail]), activity: SELECTED },
      HORIZON
    );
    const label = (r) => r.entries.find((e) => e.surface.id === "discover").window.label;
    assert.equal(label(before), "discover");
    assert.equal(label(after), "discover");
  });

  test("duplicate and empty ids throw", () => {
    assert.throws(() => validateWorkspaceDefinition(workspace([main, discover, { ...detail, id: "discover" }])), /duplicate surface id "discover"/);
    assert.throws(() => validateWorkspaceDefinition(workspace([main, { ...discover, id: "  " }])), /empty id/);
  });
});

describe("capability gating", () => {
  test("a non-Horizon runtime renders no SpatialWindow", () => {
    const r = resolveMetaWorkspace(
      { definition: workspace([main, assistant, discover, detail, tools]), activity: SELECTED },
      FLAT
    );
    assert.deepEqual(kinds(r), ["main:map", "inline:mights", "inline:discover", "inline:place-detail"]);
    assert.ok(r.entries.filter((e) => e.kind === "inline" && e.reason !== "layer").every((e) => e.reason === "no-spatial-runtime"));
    assert.equal(omittedReasons(r).tools, "no-spatial-runtime");
  });

  test("an unmet requirement takes the fallback and lists what is missing", () => {
    const needsHands = { ...discover, requires: { kind: "all-of", capabilities: ["hand-tracking", "multi-window"] } };
    const r = resolveMetaWorkspace(
      { definition: workspace([main, needsHands, detail]), activity: SELECTED },
      { isSpatialAvailable: true, capabilities: { "multi-window": "supported", "hand-tracking": "unverified" } }
    );
    const entry = r.entries.find((e) => e.surface.id === "discover");
    assert.equal(entry.kind, "inline");
    assert.equal(entry.reason, "capability-unmet");
    assert.deepEqual(kinds(r).slice(0, 2), ["main:map", "window:place-detail"]);
  });

  test("a dropped surface with an unmet requirement reports the missing capabilities", () => {
    const needsPassthrough = { ...tools, requires: { kind: "all-of", capabilities: ["passthrough"] } };
    const r = resolveMetaWorkspace(
      { definition: workspace([main, needsPassthrough]), activity: NOTHING_SELECTED },
      HORIZON
    );
    assert.deepEqual(r.omitted, [{ surface: needsPassthrough, reason: "capability-unmet", missing: ["passthrough"] }]);
  });

  test("evaluateWorkspaceRequirement: only 'supported' counts", () => {
    const report = { "multi-window": "supported", "hand-tracking": "unverified" };
    assert.deepEqual(evaluateWorkspaceRequirement({ kind: "none" }, {}), { kind: "met" });
    assert.deepEqual(
      evaluateWorkspaceRequirement({ kind: "all-of", capabilities: ["multi-window", "hand-tracking"] }, report),
      { kind: "unmet", missing: ["hand-tracking"] }
    );
    assert.deepEqual(
      evaluateWorkspaceRequirement({ kind: "any-of", capabilities: ["hand-tracking", "multi-window"] }, report),
      { kind: "met" }
    );
    assert.deepEqual(
      evaluateWorkspaceRequirement({ kind: "any-of", capabilities: [] }, report),
      { kind: "unmet", missing: [] }
    );
  });
});

describe("selection-owned detail", () => {
  test("detail is not rendered while nothing is selected", () => {
    const r = resolveMetaWorkspace(
      { definition: workspace([main, discover, detail]), activity: NOTHING_SELECTED },
      HORIZON
    );
    assert.deepEqual(kinds(r), ["main:map", "window:discover"]);
    assert.equal(omittedReasons(r)["place-detail"], "not-mounted");
  });

  test("detail gets a window once a place is selected", () => {
    const r = resolveMetaWorkspace(
      { definition: workspace([main, discover, detail]), activity: SELECTED },
      HORIZON
    );
    assert.ok(kinds(r).includes("window:place-detail"));
  });

  test("an unselected detail frees its slot for the next surface", () => {
    const r = resolveMetaWorkspace(
      { definition: workspace([main, discover, detail, tools]), activity: NOTHING_SELECTED },
      HORIZON
    );
    assert.deepEqual(kinds(r), ["main:map", "window:discover", "window:tools"]);
  });

  test("isWorkspaceSurfaceMounted follows each lifecycle owner", () => {
    assert.equal(isWorkspaceSurfaceMounted(main, NOTHING_SELECTED), true);
    assert.equal(isWorkspaceSurfaceMounted(detail, NOTHING_SELECTED), false);
    assert.equal(isWorkspaceSurfaceMounted(detail, SELECTED), true);
    assert.equal(isWorkspaceSurfaceMounted(assistant, NOTHING_SELECTED), false);
    assert.equal(isWorkspaceSurfaceMounted(assistant, SELECTED), true);
  });
});

describe("definition validation", () => {
  test("requires exactly one main surface", () => {
    assert.throws(() => validateWorkspaceDefinition(workspace([discover])), /exactly one main surface, found 0/);
    assert.throws(() => validateWorkspaceDefinition(workspace([main, { ...main, id: "map-2" }])), /found 2/);
  });

  test("role main and presentation main go together", () => {
    assert.throws(() => validateWorkspaceDefinition(workspace([main, { ...discover, role: "main" }])), /go together/);
    assert.throws(() => validateWorkspaceDefinition(workspace([{ ...main, role: "discover" }])), /go together/);
  });

  test("main must be workspace-owned", () => {
    assert.throws(
      () => validateWorkspaceDefinition(workspace([{ ...main, lifecycle: { owner: "selection", selectionKey: "place" } }])),
      /must be workspace-owned/
    );
  });

  test("maxPromotedSurfaces must be a non-negative integer", () => {
    assert.throws(() => validateWorkspaceDefinition(workspace([main], { maxPromotedSurfaces: -1 })), RangeError);
    assert.throws(() => validateWorkspaceDefinition(workspace([main], { maxPromotedSurfaces: 1.5 })), RangeError);
  });

  test("a bad window size throws on every runtime, not only on a headset", () => {
    const bad = { ...discover, presentation: { ...discover.presentation, size: { unit: "dp", width: 0, height: 100 } } };
    for (const runtime of [HORIZON, FLAT]) {
      assert.throws(
        () => resolveMetaWorkspace({ definition: workspace([main, bad]), activity: NOTHING_SELECTED }, runtime),
        /finite and positive dp/
      );
    }
    const pct = { ...tools, presentation: { ...tools.presentation, size: { unit: "percent-of-main", widthPercent: 120, heightPercent: 20 } } };
    assert.throws(
      () => resolveMetaWorkspace({ definition: workspace([main, pct]), activity: NOTHING_SELECTED }, HORIZON),
      /\(0, 100\]/
    );
  });
});

describe("backward compatibility", () => {
  test("toMetaSpatialWindowProps still maps a legacy SpatialSurfaceIntent", () => {
    assert.deepEqual(
      toMetaSpatialWindowProps({
        id: "navigation",
        role: "master",
        preferredPresentation: "system-window",
        fallback: "inline",
        priority: "permanent",
      }),
      {
        label: "navigation",
        windowWidth: 360,
        windowHeight: 480,
        priority: 4,
        promotable: true,
        anchor: "start",
        fallback: "inline",
      }
    );
  });

  test("MetaHorizonLayoutAdapter still reports from its runtime", () => {
    const adapter = new MetaHorizonLayoutAdapter();
    assert.equal(adapter.getCapabilities()["multi-window"], "unsupported");
    adapter.setRuntime({ isSpatialAvailable: true });
    assert.equal(adapter.getCapabilities()["multi-window"], "unverified");
  });
});
