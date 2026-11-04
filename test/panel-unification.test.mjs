import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("premium exposes only the canonical UI, not legacy GUI panel shells", () => {
  const premium = read("packages/premium/src/ui.ts");
  assert.match(premium, /export \* from ["']@viro-external\/ui["']/);
  assert.doesNotMatch(premium, /@viro-external\/gui|HolographicSlate|CylinderPanel|ViroSlate/);
});

test("legacy HolographicSlate forwards one surface to SpatialPanel", () => {
  const source = read("packages/viro-external-gui/src/HolographicSlate.tsx");
  assert.match(source, /@viro-external\/ui/);
  assert.match(source, /<SpatialPanel\b/);
  assert.match(source, /surfaceMaterial=\{contentMaterialName\}/);
  assert.match(source, /snapTo=\{snapTo\}/);
    assert.doesNotMatch(source, /\buseState\s*\(/, path);
});

test("legacy CylinderPanel uses a single canonical panel, keeping only curved child layout", () => {
  const source = read("packages/viro-external-gui/src/CylinderPanel.tsx");
  assert.match(source, /@viro-external\/ui/);
  assert.match(source, /<SpatialPanel\b/);
  assert.match(source, /<Container3D\b/);
  assert.match(source, /surfaceOffset=\{snapTo === undefined/);
  assert.match(source, /const z = radius \* \(Math\.cos\(arcRadians \/ 2\) - Math\.cos\(theta\)\)/);
  assert.doesNotMatch(source, /<MovableNode\b|<PanelHeader3D\b|<ViroGeometry\b|useState\(/);
});

test("canonical SpatialPanel owns shape, snap, header and isolated state", () => {
  const source = read("packages/ui/src/SpatialPanel.tsx");
  assert.match(source, /buildCurvedPanelGeometry/);
  assert.match(source, /nearestWorldSlot/);
  assert.match(source, /createPanelStore/);
  assert.match(source, /<PanelHeader\b/);
  assert.match(source, /surfaceMaterial \?\?/);
});

test("production example uses one snapped, curved panel per workspace slot", () => {
  const source = read("docs/examples/SpatialWorkspaceExample.tsx");
  assert.match(source, /<SpatialWorkspaceFrame\b/);
  assert.equal((source.match(/<SpatialPanel\b/g) ?? []).length, 3);
  for (const slot of ["left", "center", "right"]) {
    assert.match(source, new RegExp(`snapTo=["']${slot}["']`));
  }
  assert.doesNotMatch(source, /<SpatialWorkspaceSlotNode\b|@viro-external\/gui/);
});

test("canonical panel controls do not introduce parallel React useState owners", () => {
  for (const path of [
    "packages/ui/src/SpatialPanel.tsx",
    "packages/ui/src/PanelHeader.tsx",
    "packages/ui/src/PanelButton.tsx",
    "packages/viro-external-gui/src/HolographicSlate.tsx",
    "packages/viro-external-gui/src/CylinderPanel.tsx",
  ]) {
    const source = read(path);
    assert.doesNotMatch(source, /\\buseState\\s*\\(/, path);
  }
  assert.match(read("packages/ui/src/PanelButton.tsx"), /createStore/);
});
