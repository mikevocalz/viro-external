#!/usr/bin/env node
// Embeds the three reference-app scene documents (scenes/*.scene.json, copied
// from viro __test__/fixtures/specs/reference-apps/<app>/scene.json) in
// leaf/ViroRefAppScenes.ts, because the LEAF scenarios load them inside Lens
// Studio, where a script cannot read a JSON file from the project.
//
//   node examples/reference-apps/gen-lens-scenes.mjs          write the file
//   node examples/reference-apps/gen-lens-scenes.mjs --check  exit 1 when it is stale
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const VIRO_REF_APPS = ["dashboard", "model-viewer", "world-placed-info"];

const here = new URL(".", import.meta.url);
const target = new URL("./leaf/ViroRefAppScenes.ts", here);

/** The TypeScript module for the current scene documents. */
export function renderViroRefAppScenes() {
  const entries = VIRO_REF_APPS.map((name) => {
    const doc = JSON.parse(readFileSync(new URL("./scenes/" + name + ".scene.json", here), "utf8"));
    return "  " + JSON.stringify(name) + ": " + JSON.stringify(JSON.stringify(doc)) + ",";
  });
  return [
    "// Written by examples/reference-apps/gen-lens-scenes.mjs from scenes/*.scene.json.",
    "// Do not edit; change the viro app, refresh the goldens, copy them, and rerun.",
    "",
    "/** The three reference apps. */",
    'export type ViroRefAppName = "dashboard" | "model-viewer" | "world-placed-info";',
    "",
    "const SCENES: Record<ViroRefAppName, string> = {",
    ...entries,
    "};",
    "",
    "/** A fresh copy of one reference app's scene document (scene protocol 2). */",
    "export function viroRefAppScene(name: ViroRefAppName): { version: 2; route?: string; nodes: Array<{ id: string; [key: string]: unknown }>; [key: string]: unknown } {",
    "  return JSON.parse(SCENES[name]);",
    "}",
    "",
  ].join("\n");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const next = renderViroRefAppScenes();
  if (process.argv.includes("--check")) {
    let current = "";
    try {
      current = readFileSync(target, "utf8");
    } catch {
      // Missing counts as stale.
    }
    if (current !== next) {
      console.error("leaf/ViroRefAppScenes.ts is stale. Run node examples/reference-apps/gen-lens-scenes.mjs");
      process.exit(1);
    }
    console.log("leaf/ViroRefAppScenes.ts is current.");
  } else {
    writeFileSync(target, next);
    console.log("Wrote " + fileURLToPath(target));
  }
}
