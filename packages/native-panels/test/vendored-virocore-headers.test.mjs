import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

// The Rive HybridObjects compile against copies of two virocore headers
// (android/src/main/cpp/vendor/virocore/PROVENANCE.txt). With VIROCORE_ROOT
// set, they must match that checkout byte for byte.
const vendor = fileURLToPath(new URL("../android/src/main/cpp/vendor/virocore/", import.meta.url));
const headers = {
  "VRORivePanel.h": "android/sharedCode/src/main/cpp/VRORivePanel.h",
  "VROPanelCoverage.h": "ViroRenderer/VROPanelCoverage.h",
};
const root = process.env.VIROCORE_ROOT;

test("vendored virocore headers match VIROCORE_ROOT", { skip: root ? false : "VIROCORE_ROOT is not set" }, () => {
  for (const [name, path] of Object.entries(headers)) {
    assert.equal(readFileSync(join(vendor, name), "utf8"), readFileSync(join(root, path), "utf8"), `${name} differs from ${path}`);
  }
});

test("PROVENANCE.txt names both vendored headers", () => {
  const provenance = readFileSync(join(vendor, "PROVENANCE.txt"), "utf8");
  for (const name of Object.keys(headers)) assert.ok(provenance.includes(name), `PROVENANCE.txt lacks ${name}`);
});
