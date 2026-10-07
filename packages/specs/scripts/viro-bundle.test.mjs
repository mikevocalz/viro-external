import test from "node:test";
import assert from "node:assert/strict";
import {
  compileViroBundleForSpecs,
} from "../dist/viro-bundle.js";

test("resolves nested Viro polyline transforms into SPECS world meters", () => {
  const compiled = compileViroBundleForSpecs({
    version: 1,
    scene: {
      version: 1,
      nodes: [
        {
          id: "root",
          kind: "group",
          position: [0, 0, -1.5],
          rotation: [0, 0, 0, 1],
          scale: [2, 2, 2],
        },
      ],
    },
    polylines: [
      {
        id: "route",
        parentId: "root",
        points: [
          [0, 0, 0],
          [0.5, 0, 0],
        ],
        position: [0.1, 0.2, 0.3],
        widthMeters: 0.01,
      },
    ],
  });

  assert.deepEqual(compiled.polylines[0].plan.points, [
    [0.2, 0.4, -0.9],
    [1.2, 0.4, -0.9],
  ]);
  assert.equal(compiled.polylines[0].plan.radiusMeters, 0.01);
});

test("rejects parent cycles instead of looping", () => {
  assert.throws(
    () =>
      compileViroBundleForSpecs({
        version: 1,
        scene: {
          version: 1,
          nodes: [
            { id: "a", kind: "group", parentId: "b" },
            { id: "b", kind: "group", parentId: "a" },
          ],
        },
        polylines: [
          {
            id: "line",
            parentId: "a",
            points: [
              [0, 0, 0],
              [1, 0, 0],
            ],
            widthMeters: 0.01,
          },
        ],
      }),
    /parent cycle/
  );
});
