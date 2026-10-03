import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

// Reads the built package; `prepack` builds before it runs the tests.
const { compileSpecsRenderPlan } = createRequire(import.meta.url)("../dist/index.js");

test("panel keeps tint and corner radius, and needs SpectaclesUIKit", () => {
  const plan = compileSpecsRenderPlan([
    { id: "p", kind: "panel", sizeMeters: [0.4, 0.3], tint: [0, 0, 0, 0.8], cornerRadiusMeters: 0.02 },
    { id: "s", kind: "scroll", parentId: "p", sizeMeters: [0.4, 0.2] },
  ]);
  const content = plan.commands.find((c) => c.op === "content" && c.id === "p");
  assert.deepEqual(content.tint, [0, 0, 0, 0.8]);
  assert.equal(content.cornerRadiusMeters, 0.02);
  for (const id of ["p", "s"]) {
    const create = plan.commands.find((c) => c.op === "create" && c.id === id);
    assert.equal(create.backendPackage, "SpectaclesUIKit");
  }
  assert.ok(plan.packages.includes("SpectaclesUIKit"));
});
