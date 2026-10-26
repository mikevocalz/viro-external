import assert from "node:assert/strict";
import { test } from "node:test";

import { cylinderArcMesh } from "../src/fallback/cylinderArcMesh.ts";
import { quaternionToViroEulerDegrees } from "../src/fallback/quaternionToViroEulerDegrees.ts";

// VROQuaternion::set(x, y, z) from virocore ViroRenderer/VROQuaternion.cpp:
// the conversion Viro applies to a node's `rotation` (radians).
function viroEulerToQuaternion([x, y, z]) {
  const sr = Math.sin(x / 2), cr = Math.cos(x / 2);
  const sp = Math.sin(y / 2), cp = Math.cos(y / 2);
  const sy = Math.sin(z / 2), cy = Math.cos(z / 2);
  const q = [
    sr * cp * cy - cr * sp * sy,
    cr * sp * cy + sr * cp * sy,
    cr * cp * sy - sr * sp * cy,
    cr * cp * cy + sr * sp * sy,
  ];
  const n = Math.hypot(...q);
  return q.map((v) => v / n);
}

function sameRotation(a, b) {
  const dot = Math.abs(a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]);
  return Math.abs(dot - 1) < 1e-6;
}

test("identity and a 90 degree yaw", () => {
  assert.deepEqual(quaternionToViroEulerDegrees([0, 0, 0, 1]).map((v) => Math.round(v * 1e6) / 1e6 + 0), [0, 0, 0]);
  const yaw = quaternionToViroEulerDegrees([0, Math.SQRT1_2, 0, Math.SQRT1_2]);
  assert.ok(Math.abs(yaw[1] - 90) < 1e-4, `yaw ${yaw}`);
});

test("Viro's own conversion of the result gives back the layer quaternion", () => {
  let seed = 7;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647 - 0.5;
  };
  for (let i = 0; i < 500; i += 1) {
    const raw = [random(), random(), random(), random()];
    const n = Math.hypot(...raw);
    const q = raw.map((v) => v / n);
    const degrees = quaternionToViroEulerDegrees(q);
    const back = viroEulerToQuaternion(degrees.map((d) => (d * Math.PI) / 180));
    assert.ok(sameRotation(q, back), `case ${i}: ${q} -> ${degrees} -> ${back}`);
  }
});

test("arc mesh: radius, arc length, height and texture orientation", () => {
  const widthM = 1.2, heightM = 0.8, radiusM = 1.5, segments = 24;
  const mesh = cylinderArcMesh(widthM, heightM, radiusM, segments);
  assert.equal(mesh.vertices.length, 2 * (segments + 1));
  assert.equal(mesh.triangleIndices.length, 2 * segments);
  for (const [x, , z] of mesh.vertices) assert.ok(Math.abs(Math.hypot(x, z) - radiusM) < 1e-9);
  const first = mesh.vertices[0], last = mesh.vertices.at(-2);
  const arc = radiusM * Math.abs(Math.atan2(last[0], -last[2]) - Math.atan2(first[0], -first[2]));
  assert.ok(Math.abs(arc - widthM) < 1e-9, `arc ${arc}`);
  assert.equal(first[1], heightM / 2);
  assert.equal(mesh.vertices[1][1], -heightM / 2);
  // Centre column sits on -Z at the radius; top edge samples v = 1.
  const mid = mesh.vertices[segments];
  assert.ok(Math.abs(mid[0]) < 1e-9 && Math.abs(mid[2] + radiusM) < 1e-9);
  assert.deepEqual(mesh.texcoords[0], [0, 1]);
  assert.deepEqual(mesh.texcoords[1], [0, 0]);
  assert.deepEqual(mesh.texcoords.at(-2), [1, 1]);
  for (const [a, b, c] of mesh.triangleIndices) {
    assert.ok(Math.max(a, b, c) < mesh.vertices.length);
  }
});
