import assert from "node:assert/strict";
import { test } from "node:test";
import { buildCurvedPanelGeometry, curvedPanelPoseAtX } from "../src/geometry.ts";

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);

test("header chrome poses sit on the same geometric arc as the body", () => {
  const width = 1.6;
  const curvature = 0.28;
  const mesh = buildCurvedPanelGeometry(width, 0.12, curvature, 37);
  for (let i = 0; i < 37; i += 1) {
    const vertex = mesh.vertices[i];
    const { position, rotation } = curvedPanelPoseAtX(width, curvature, vertex[0]);
    near(position[0], vertex[0]);
    near(position[2], vertex[2]);
    near(rotation[1], -Math.asin(vertex[0] / (width / (2 * Math.sin(curvature * Math.PI / 3)))) * 180 / Math.PI);
  }
});

test("left and right chrome controls have mirrored tangent rotations", () => {
  const left = curvedPanelPoseAtX(1.4, 0.5, -0.45);
  const right = curvedPanelPoseAtX(1.4, 0.5, 0.45);
  near(left.position[2], right.position[2]);
  near(left.rotation[1], -right.rotation[1]);
  near(curvedPanelPoseAtX(1.4, 0.5, 0).rotation[1], 0);
});

test("out-of-bounds curved header poses fail rather than render invisible input", () => {
  assert.throws(() => curvedPanelPoseAtX(1.2, 0.4, 0.8), RangeError);
  assert.throws(() => curvedPanelPoseAtX(1.2, 0, 0), RangeError);
  assert.throws(() => curvedPanelPoseAtX(-1.2, 0.4, 0), RangeError);
});
