import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  assertFlatBoard,
  boardDragPlane,
  boardToPage,
  composeNodeWorld,
  invertAffine,
  mapWorldPointToBoard,
  multiplyMat4,
  paperUvToBoard,
  planeHitFromDrag,
  transformPoint,
} from "../src/quickdraw-input/board-geometry.ts";
import { isInsideRoundedPanel, panelCornerRadiiPx, panelCoverage } from "../src/quickdraw-input/panel-coverage.ts";

const near = (actual, expected, eps = 1e-9, what = "") =>
  assert.ok(Math.abs(actual - expected) <= eps, `${what} got ${actual}, expected ${expected}`);

// MoyoLearn's board: 1.2 x 0.75 m quad, 2016 x 1260 px texture, 1008 x 630 units.
const geometry = { widthM: 1.2, heightM: 0.75, widthPx: 2016, heightPx: 1260, boardWidth: 1008, boardHeight: 630, cornerRadiusM: 0 };

describe("panel coverage (port of VROPanelCoverage.h)", () => {
  const w = 2496, h = 1560, r = 64;
  test("centre and straight-edge pixel centres are fully covered", () => {
    assert.equal(panelCoverage(w / 2, h / 2, w, h, r, r), 1);
    assert.equal(panelCoverage(0.5, h / 2, w, h, r, r), 1);
    assert.equal(panelCoverage(w - 0.5, h / 2, w, h, r, r), 1);
    assert.equal(panelCoverage(w / 2, 0.5, w, h, r, r), 1);
    assert.equal(panelCoverage(w / 2, h - 0.5, w, h, r, r), 1);
    assert.equal(panelCoverage(r + 0.5, 0.5, w, h, r, r), 1, "pixel at the arc tangent");
  });

  test("corner pixels are transparent and the four corners mirror to the bit", () => {
    for (const [x, y] of [[0.5, 0.5], [w - 0.5, 0.5], [0.5, h - 0.5], [w - 0.5, h - 0.5]]) {
      assert.equal(panelCoverage(x, y, w, h, r, r), 0);
    }
    const a = panelCoverage(10.5, 20.5, w, h, r, r);
    assert.equal(a, panelCoverage(w - 10.5, 20.5, w, h, r, r));
    assert.equal(a, panelCoverage(10.5, h - 20.5, w, h, r, r));
    assert.equal(a, panelCoverage(w - 10.5, h - 20.5, w, h, r, r));
  });

  test("0.5 on the arc, 1 and 0 half a pixel inside and outside", () => {
    const d = r - r / Math.SQRT2;
    const step = 1 / Math.SQRT2;
    near(panelCoverage(d, d, w, h, r, r), 0.5, 1e-4, "on arc");
    near(panelCoverage(d + 0.5 * step, d + 0.5 * step, w, h, r, r), 1, 1e-4, "inside");
    near(panelCoverage(d - 0.5 * step, d - 0.5 * step, w, h, r, r), 0, 1e-4, "outside");
  });

  test("radius edge cases match the header's tests", () => {
    assert.equal(panelCoverage(0.5, 0.5, 300, 100, 0, 0), 1, "radius 0 keeps the corner pixel");
    assert.equal(panelCoverage(0.5, 0.5, 300, 100, -5, -5), 1, "negative radius is 0");
    near(panelCoverage(50, 0.5, 300, 100, 50, 50), 1, 1e-6, "stadium tangent");
    assert.equal(panelCoverage(-1, 50, 300, 100, 10, 10), 0);
    assert.equal(panelCoverage(150, 101, 300, 100, 10, 10), 0);
  });

  test("pixel radii from metres match VROPanelCornerRadiiPx", () => {
    let radii = panelCornerRadiiPx(0.0381, 1.6, 1.0, 2016, 1260);
    near(radii.x, (0.0381 * 2016) / 1.6, 1e-3);
    near(radii.y, (0.0381 * 1260) / 1.0, 1e-3);
    radii = panelCornerRadiiPx(0.05, 1, 1, 1024, 512);
    near(radii.x, 51.2, 1e-4);
    near(radii.y, 25.6, 1e-4);
    radii = panelCornerRadiiPx(10, 2, 1, 2000, 1000);
    near(radii.x, 500, 1e-3);
    near(radii.y, 500, 1e-3);
    assert.deepEqual(panelCornerRadiiPx(Number.NaN, 1, 1, 100, 100), { x: 0, y: 0 });
    assert.deepEqual(panelCornerRadiiPx(0.1, 0, 1, 100, 100), { x: 0, y: 0 });
  });

  test("a hit inside the transparent corner misses, coverage >= 0.5 hits", () => {
    const radii = { x: 64, y: 64 };
    assert.equal(isInsideRoundedPanel(1, 1, w, h, radii), false);
    assert.equal(isInsideRoundedPanel(w / 2, 1, w, h, radii), true);
    const d = 64 - 64 / Math.SQRT2;
    assert.equal(isInsideRoundedPanel(d + 0.1, d + 0.1, w, h, radii), true);
    assert.equal(isInsideRoundedPanel(d - 0.3, d - 0.3, w, h, radii), false);
    assert.equal(isInsideRoundedPanel(-0.1, 10, w, h, radii), false);
  });
});

describe("world hit to board units", () => {
  test("identity pose: centre, corners and the single Y flip", () => {
    const world = composeNodeWorld({});
    const centre = mapWorldPointToBoard([0, 0, 0], world, geometry);
    assert.equal(centre.kind, "on-plane");
    assert.deepEqual(centre.paperUv, [0.5, 0.5]);
    const topLeft = mapWorldPointToBoard([-0.6, 0.375, 0], world, geometry);
    assert.deepEqual(topLeft.paperUv, [0, 0], "world +Y up is board y = 0");
    const p = paperUvToBoard(mapWorldPointToBoard([0.3, -0.1875, 0], world, geometry).paperUv, geometry);
    near(p.x, 756, 1e-9);
    near(p.y, 472.5, 1e-9);
  });

  test("translation, yaw, pitch and non-uniform scale round-trip", () => {
    const world = composeNodeWorld({ position: [0.4, 1.2, -2.6], rotation: [-12, 37, 5], scale: [1.5, 0.8, 1] });
    for (const [lx, ly] of [[0, 0], [0.25, -0.1], [-0.59, 0.37]]) {
      const w = transformPoint(world, [lx, ly, 0]);
      const hit = mapWorldPointToBoard(w, world, geometry);
      assert.equal(hit.kind, "on-plane");
      near(hit.local[0], lx, 1e-9, "local x");
      near(hit.local[1], ly, 1e-9, "local y");
      near(hit.paperUv[0], lx / 1.2 + 0.5, 1e-9);
      near(hit.paperUv[1], 0.5 - ly / 0.75, 1e-9);
    }
  });

  test("Viro yaw convention: rotation [0, 90, 0] turns local +X to world -Z", () => {
    const world = composeNodeWorld({ rotation: [0, 90, 0] });
    const x = transformPoint(world, [1, 0, 0]);
    near(x[0], 0, 1e-12);
    near(x[2], -1, 1e-12);
  });

  test("a parent transform composes before the node", () => {
    const parent = composeNodeWorld({ position: [0, 0, -1], rotation: [0, 45, 0] });
    const world = composeNodeWorld({ position: [0, 0, -1] }, parent);
    assert.deepEqual(world, multiplyMat4(parent, composeNodeWorld({ position: [0, 0, -1] })));
    const hit = mapWorldPointToBoard(transformPoint(world, [0.1, 0.2, 0]), world, geometry);
    near(hit.local[0], 0.1, 1e-9);
    near(hit.local[1], 0.2, 1e-9);
  });

  test("points off the plane beyond the tolerance are rejected in world metres", () => {
    const world = composeNodeWorld({ scale: [1, 1, 4] });
    const off = mapWorldPointToBoard([0, 0, 0.02], world, geometry);
    assert.equal(off.kind, "off-plane");
    near(off.distanceM, 0.02, 1e-12);
    assert.equal(mapWorldPointToBoard([0, 0, 0.005], world, geometry).kind, "on-plane");
  });

  test("rounded corners are part of the hit test", () => {
    const rounded = { ...geometry, cornerRadiusM: 0.0381 };
    const world = composeNodeWorld({});
    assert.equal(mapWorldPointToBoard([-0.5995, 0.3745, 0], world, rounded).isOnPaper, false, "inside the corner");
    assert.equal(mapWorldPointToBoard([-0.5995, 0.3745, 0], world, geometry).isOnPaper, true, "square board");
    assert.equal(mapWorldPointToBoard([0, 0.3745, 0], world, rounded).isOnPaper, true, "top edge middle");
  });

  test("contain letterboxes a 16:10 board on a square quad; margins are off the paper", () => {
    const square = { ...geometry, widthM: 1, heightM: 1, widthPx: 1000, heightPx: 1000 };
    const world = composeNodeWorld({});
    const top = mapWorldPointToBoard([0, 0.3125, 0], world, square);
    near(top.paperUv[1], 0, 1e-9, "paper top edge");
    assert.equal(mapWorldPointToBoard([0, 0.45, 0], world, square).isOnPaper, false, "margin");
    const fill = mapWorldPointToBoard([0, 0.45, 0], world, { ...square, fit: "fill" });
    near(fill.paperUv[1], 0.05, 1e-9);
  });

  test("zoom and pan are the board camera, applied after board units", () => {
    assert.deepEqual(boardToPage({ x: 504, y: 315 }, { x: 0, y: 0, z: 1 }), { x: 504, y: 315 });
    assert.deepEqual(boardToPage({ x: 504, y: 315 }, { x: 100, y: -50, z: 2 }), { x: 152, y: 207.5 });
  });

  test("curved boards are refused, not flattened", () => {
    assert.throws(() => assertFlatBoard(0.32), RangeError);
    assertFlatBoard(0);
    assertFlatBoard(undefined);
  });

  test("drag reports recover the live plane hit", () => {
    // ViroCore: dragTo = origin + (hitNow - hitAtStart). With the start hit equal to the press hit:
    const origin = [0, 1, -2];
    const press = [0.1, 1.05, -2];
    const hitNow = [0.3, 0.9, -2];
    const dragTo = origin.map((o, i) => o + hitNow[i] - press[i]);
    const recovered = planeHitFromDrag(dragTo, origin, press);
    recovered.forEach((v, i) => near(v, hitNow[i], 1e-12));
  });

  test("the drag plane is the quad's own plane, normal through rotation and scale", () => {
    const world = composeNodeWorld({ position: [1, 2, 3], rotation: [0, 90, 0], scale: [2, 3, 1] });
    const plane = boardDragPlane(world);
    assert.deepEqual(plane.planePoint, [1, 2, 3]);
    near(plane.planeNormal[0], 1, 1e-12);
    near(plane.planeNormal[2], 0, 1e-12);
  });

  test("a singular matrix has no inverse", () => {
    assert.equal(invertAffine(composeNodeWorld({ scale: [0, 1, 1] })), undefined);
  });
});
