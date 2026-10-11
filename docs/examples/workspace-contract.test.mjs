import assert from "node:assert/strict";
import { test } from "node:test";
import { exampleWorkspace } from "./workspace-contract.ts";
import {
  validateWorkspaceDefinition, isWorkspaceSurfaceMounted,
} from "../../packages/xr-platform-contract/src/workspaceSurface.ts";

const detail = exampleWorkspace.surfaces.find(surface => surface.id === "detail");
test("example satisfies the real workspace invariants", () => {
  assert.doesNotThrow(() => validateWorkspaceDefinition(exampleWorkspace));
});
test("detail is absent without a selected place", () => {
  assert.equal(isWorkspaceSurfaceMounted(detail, { selections: [], openSurfaceIds: [] }), false);
});
test("detail mounts for the selection key, not a place identifier", () => {
  assert.equal(isWorkspaceSurfaceMounted(detail, { selections: ["place"], openSurfaceIds: [] }), true);
  assert.equal(isWorkspaceSurfaceMounted(detail, { selections: ["place-123"], openSurfaceIds: [] }), false);
});
test("clearing selection unmounts the inspector while main/discover remain", () => {
  const mounted = exampleWorkspace.surfaces.filter(surface =>
    isWorkspaceSurfaceMounted(surface, { selections: [], openSurfaceIds: [] }));
  assert.deepEqual(mounted.map(surface => surface.id), ["main", "discover"]);
});
