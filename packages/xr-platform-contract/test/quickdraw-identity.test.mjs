import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  ESIKU_QUICKDRAW_IDENTITY,
  VIRO_NATIVE_QUICKDRAW_IDENTITY,
  WEBVIEW_QUICKDRAW_IDENTITY,
  resolveQuickDrawSurfaceIdentity,
} from "../src/quickdrawIdentity.ts";
import { toQuickDrawSpatialPointer } from "../src/quickdraw.ts";

describe("QuickDraw surface identity", () => {
  test("a renderer-only adapter keeps resolving to ESIKU", () => {
    assert.deepEqual(resolveQuickDrawSurfaceIdentity({ renderer: "esiku" }), ESIKU_QUICKDRAW_IDENTITY);
  });

  test("an explicit identity is returned as declared", () => {
    assert.equal(resolveQuickDrawSurfaceIdentity({ identity: WEBVIEW_QUICKDRAW_IDENTITY }), WEBVIEW_QUICKDRAW_IDENTITY);
    assert.equal(
      resolveQuickDrawSurfaceIdentity({ identity: VIRO_NATIVE_QUICKDRAW_IDENTITY }),
      VIRO_NATIVE_QUICKDRAW_IDENTITY,
    );
  });

  test("renderer esiku with a non-ESIKU host is rejected", () => {
    assert.throws(
      () => resolveQuickDrawSurfaceIdentity({ renderer: "esiku", identity: WEBVIEW_QUICKDRAW_IDENTITY }),
      RangeError,
    );
    assert.throws(
      () =>
        resolveQuickDrawSurfaceIdentity({
          renderer: "esiku",
          identity: { ...ESIKU_QUICKDRAW_IDENTITY, backend: "android-hwui-canvas" },
        }),
      RangeError,
    );
  });

  test("renderer esiku agrees with an ESIKU identity", () => {
    assert.equal(
      resolveQuickDrawSurfaceIdentity({ renderer: "esiku", identity: ESIKU_QUICKDRAW_IDENTITY }),
      ESIKU_QUICKDRAW_IDENTITY,
    );
  });

  test("missing or unknown declarations throw TypeError", () => {
    assert.throws(() => resolveQuickDrawSurfaceIdentity({}), TypeError);
    assert.throws(() => resolveQuickDrawSurfaceIdentity({ renderer: "skia" }), TypeError);
    assert.throws(
      () => resolveQuickDrawSurfaceIdentity({ identity: { ...WEBVIEW_QUICKDRAW_IDENTITY, host: "unity" } }),
      TypeError,
    );
    assert.throws(
      () => resolveQuickDrawSurfaceIdentity({ identity: { ...WEBVIEW_QUICKDRAW_IDENTITY, editorAuthority: "figcraft" } }),
      TypeError,
    );
  });
});

describe("deprecated QuickDrawSpatialPointer conversion", () => {
  test("maps phases, drops pointerId, keeps pressure only when present", () => {
    const base = { pointerId: 3, source: "controller", uv: [0.25, 0.75], timestampMs: 120 };
    assert.deepEqual(toQuickDrawSpatialPointer({ ...base, phase: "hover" }), {
      phase: "move", source: "controller", uv: [0.25, 0.75], timestamp: 120,
    });
    assert.equal(toQuickDrawSpatialPointer({ ...base, phase: "leave" }).phase, "exit");
    assert.equal(toQuickDrawSpatialPointer({ ...base, phase: "down", pressure: 0 }).pressure, 0);
    assert.equal("pressure" in toQuickDrawSpatialPointer({ ...base, phase: "up" }), false);
  });
});
