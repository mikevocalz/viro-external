import assert from "node:assert/strict";
import { test } from "node:test";
import { PicoWindowContainerHost } from "../src/windowContainerHost.ts";

test("PICO WindowContainer only opens on linked OS 6 bridge", () => {
  const calls = [];
  let linked = false;
  const bridge = {
    getLayoutBridgeStatus: () => ({
      sdkLinked: linked, spatialPlatform: linked, reason: "NOT_READY",
    }),
    openWindowContainer: (id) => { calls.push(["open", id]); return { ok: true }; },
    closeWindowContainer: (id) => { calls.push(["close", id]); return { ok: true }; },
  };
  const host = new PicoWindowContainerHost(bridge);
  assert.deepEqual(host.open("main"), { kind: "fallback", reason: "NOT_READY" });
  assert.equal(calls.length, 0);
  linked = true;
  assert.deepEqual(host.open("main"), { kind: "requested", id: "main" });
  assert.deepEqual(host.open("main"), { kind: "requested", id: "main" });
  assert.deepEqual(host.open("detail"), { kind: "fallback", reason: "ANOTHER_CONTAINER_ACTIVE" });
  assert.deepEqual(calls, [["open", "main"]]);
  assert.equal(host.dispose(), true);
  assert.deepEqual(calls, [["open", "main"], ["close", "main"]]);
  assert.equal(host.dispose(), true);
});

test("native errors remain fallback and rejected close remains owned", () => {
  let failClose = true;
  const bridge = {
    getLayoutBridgeStatus: () => ({ sdkLinked: true, spatialPlatform: true }),
    openWindowContainer: () => ({ ok: true }),
    closeWindowContainer: () => failClose ? { ok: false, reason: "SDK_REJECTED" } : { ok: true },
  };
  const host = new PicoWindowContainerHost(bridge);
  host.open("main");
  assert.equal(host.close(), false);
  assert.deepEqual(host.open("another"), { kind: "fallback", reason: "ANOTHER_CONTAINER_ACTIVE" });
  failClose = false;
  assert.equal(host.dispose(), true);
  assert.deepEqual(host.open("another"), { kind: "requested", id: "another" });
});
