import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { attachedWindowFrame } from "../src/geometry/attachedWindowFrame.ts";
import {
  PANEL_WIDTH_RANGE_DP,
  RAIL_WINDOW_LABEL,
  createSpatialShellGeometry,
} from "../src/geometry/createSpatialShellGeometry.ts";
import { fitMainContent } from "../src/geometry/fitMainContent.ts";
import { DEFAULT_SPATIAL_SHELL_TOKENS } from "../src/geometry/SpatialShellTokens.ts";
import { detailPanelCommand, detailPanelStatusAfter } from "../src/detail/detailPanelRules.ts";

describe("createSpatialShellGeometry", () => {
  test("defaults are the sizes expo-pico #45 ran on Quest 3S and PICO 4 Ultra", () => {
    const geometry = createSpatialShellGeometry();
    assert.deepEqual(geometry.tokens, DEFAULT_SPATIAL_SHELL_TOKENS);
    assert.equal(geometry.mainContentAspectRatio, 1.6);
    assert.deepEqual(geometry.detailPanelSizeDp, { widthDp: 420, heightDp: 600 });
    assert.equal(geometry.railStripWidthDp, 96);
  });

  test("the rail window is flush outside the main window's physical left edge", () => {
    const rail = createSpatialShellGeometry().railWindow(3, "#131316");
    assert.deepEqual(rail, {
      label: RAIL_WINDOW_LABEL,
      windowWidth: 96,
      windowHeight: 3 * 72 + 2 * 12,
      priority: 20,
      promotable: true,
      fallback: "drop",
      anchor: { parent: "left", child: "right" },
      windowBackgroundColor: "#131316",
    });
    assert.equal("offset" in rail, false);
  });

  test("the rail window has no background key when none is given", () => {
    assert.equal("windowBackgroundColor" in createSpatialShellGeometry().railWindow(1), false);
  });

  test("the rail is shorter than the main panel for a realistic destination count", () => {
    const geometry = createSpatialShellGeometry();
    for (let count = 1; count <= 8; count += 1) {
      assert.ok(geometry.railHeightDp(count) < geometry.tokens.mainHeightDp);
    }
  });

  test("overrides replace single tokens and keep the rest", () => {
    const geometry = createSpatialShellGeometry({ railWidthDp: 104, detailWidthDp: 480 });
    assert.equal(geometry.tokens.railWidthDp, 104);
    assert.equal(geometry.tokens.railItemDp, 72);
    assert.equal(geometry.railWindow(2).windowWidth, 104);
    assert.equal(geometry.detailPanelSizeDp.widthDp, 480);
  });

  test("rejects non-positive tokens, out-of-range or square detail panels, and empty rails", () => {
    assert.throws(() => createSpatialShellGeometry({ railItemDp: 0 }), RangeError);
    assert.throws(() => createSpatialShellGeometry({ railWidthDp: Number.NaN }), RangeError);
    assert.throws(() => createSpatialShellGeometry({ detailWidthDp: PANEL_WIDTH_RANGE_DP.min - 1 }), /panel range/);
    assert.throws(() => createSpatialShellGeometry({ detailWidthDp: PANEL_WIDTH_RANGE_DP.max + 1 }), /panel range/);
    assert.throws(() => createSpatialShellGeometry({ detailWidthDp: 600, detailHeightDp: 600 }), /square/);
    const geometry = createSpatialShellGeometry();
    assert.throws(() => geometry.railHeightDp(0), RangeError);
    assert.throws(() => geometry.railWindow(1.5), RangeError);
  });

  test("tokens are frozen", () => {
    assert.ok(Object.isFrozen(createSpatialShellGeometry().tokens));
    assert.ok(Object.isFrozen(DEFAULT_SPATIAL_SHELL_TOKENS));
  });
});

describe("fitMainContent", () => {
  test("a wider host letterboxes left and right", () => {
    assert.deepEqual(fitMainContent(2000, 800, 1.6), { width: 1280, height: 800, left: 360, top: 0 });
  });

  test("a taller host letterboxes top and bottom", () => {
    assert.deepEqual(fitMainContent(1280, 1200, 1.6), { width: 1280, height: 800, left: 0, top: 200 });
  });

  test("a host at the launch aspect fills exactly", () => {
    assert.deepEqual(createSpatialShellGeometry().fitMainContent(1280, 800), {
      width: 1280,
      height: 800,
      left: 0,
      top: 0,
    });
  });

  test("an unmeasured host has no frame", () => {
    assert.equal(fitMainContent(0, 800, 1.6), undefined);
    assert.equal(fitMainContent(1280, Number.NaN, 1.6), undefined);
  });

  test("rejects a bad aspect ratio", () => {
    assert.throws(() => fitMainContent(100, 100, 0), RangeError);
    assert.throws(() => fitMainContent(100, 100, Number.POSITIVE_INFINITY), RangeError);
  });
});

describe("attachedWindowFrame", () => {
  const rail = createSpatialShellGeometry().railWindow(3);

  test("the rail window becomes a strip frame at its own size", () => {
    assert.deepEqual(attachedWindowFrame(rail), { widthDp: 96, heightDp: 240, gapDp: 0 });
  });

  test("other anchors, offsets and percentage sizes are not strip windows", () => {
    assert.equal(attachedWindowFrame({ ...rail, anchor: { parent: "end", child: "start" } }), undefined);
    assert.equal(attachedWindowFrame({ ...rail, anchor: "left" }), undefined);
    assert.equal(attachedWindowFrame({ ...rail, offset: { z: 1 } }), undefined);
    assert.equal(attachedWindowFrame({ ...rail, windowWidth: "20%" }), undefined);
  });

  test("anchor point specs with horizontal edges count", () => {
    const spec = { ...rail, anchor: { parent: { horizontal: "left" }, child: { horizontal: "right", vertical: "top" } } };
    assert.deepEqual(attachedWindowFrame(spec), { widthDp: 96, heightDp: 240, gapDp: 0 });
  });
});

describe("detail panel rules", () => {
  test("a selection opens a closed panel once a host exists", () => {
    assert.equal(detailPanelCommand({ selectedId: "a", status: "closed", isAvailable: true }), "open");
    assert.equal(detailPanelCommand({ selectedId: "a", status: "closed", isAvailable: false }), undefined);
  });

  test("a failed launch is not retried for the same selection", () => {
    assert.equal(detailPanelCommand({ selectedId: "a", status: "failed", isAvailable: true }), undefined);
  });

  test("clearing the selection closes an opening or open panel", () => {
    assert.equal(detailPanelCommand({ selectedId: undefined, status: "opening", isAvailable: true }), "close");
    assert.equal(detailPanelCommand({ selectedId: undefined, status: "open", isAvailable: true }), "close");
    assert.equal(detailPanelCommand({ selectedId: undefined, status: "closed", isAvailable: true }), undefined);
  });

  test("events map to statuses", () => {
    assert.equal(detailPanelStatusAfter({ type: "requested" }), "opening");
    assert.equal(detailPanelStatusAfter({ type: "opened" }), "open");
    assert.equal(detailPanelStatusAfter({ type: "failed" }), "failed");
    assert.equal(detailPanelStatusAfter({ type: "closed" }), "closed");
  });
});
