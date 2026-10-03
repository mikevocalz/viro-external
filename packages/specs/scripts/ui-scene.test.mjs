import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { mkdtemp, mkdir, writeFile, readdir, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { compileUiScene, hostModule } from "./compile-ui-scene.mjs";

const example = fileURLToPath(new URL("../examples/harlem-courts.tsx", import.meta.url));

test("the example maps to a scrolling panel and a video panel", () => {
  const { nodes, diagnostics } = compileUiScene(example);
  assert.deepEqual(diagnostics, []);

  const ids = nodes.map((n) => n.id);
  assert.equal(new Set(ids).size, ids.length, "node ids are unique");

  const panel = nodes.find((n) => n.id === "platform-lab-panel");
  assert.equal(panel.kind, "panel");
  assert.equal(panel.parentId, "platform-lab-root");

  // The stack is taller than the body, so it scrolls and opens at its top.
  const scroll = nodes.find((n) => n.kind === "scroll");
  assert.equal(scroll.parentId, "platform-lab-panel");
  assert.ok(scroll.contentHeightMeters > scroll.sizeMeters[1]);
  const inScroll = nodes.filter((n) => n.parentId === scroll.id);
  for (const n of inScroll) {
    assert.ok(n.position[1] <= scroll.contentHeightMeters / 2 + 1e-9, n.id + " is inside the content");
  }

  // Seven bars, the peak highlighted, and a wrapped paragraph.
  const bars = nodes.filter((n) => /-bar-\d+$/.test(n.id));
  assert.equal(bars.length, 7);
  assert.equal(bars.filter((b) => b.tint[0] > 0.9).length, 1);
  assert.ok(nodes.some((n) => n.kind === "text" && n.wrapWidthMeters > 0.5));

  const video = nodes.find((n) => n.kind === "video");
  assert.equal(video.parentId, "platform-lab-video-panel");
  assert.equal(video.controls, true);
  assert.equal(video.source, "media/demo");
});

test("Viro primitives map with their interactions, route and animation", () => {
  const result = compileUiScene(example);
  const root = result.nodes.find((n) => n.id === "platform-lab-root");
  assert.deepEqual(root.position, [0, 0, -1.5]);
  const model = result.nodes.find((n) => n.id === "platform-lab-model");
  assert.equal(model.kind, "model");
  assert.deepEqual(model.position, [-0.2, -0.3, 0]);

  // Frame and ScrollWindow wire their own input; only the model needs an entry.
  assert.deepEqual(result.interactions, [
    { nodeId: "platform-lab-model", interactable: true, manipulation: true, events: ["select", "drag"] },
  ]);

  // Route points are baked to world space under the root at z -1.5.
  const [route] = result.polylines;
  assert.deepEqual(route.points[0].map((v) => +v.toFixed(6)), [-0.7, -0.32, -1.38]);
  assert.equal(route.radiusMeters, 0.004);

  const [pulse] = result.animations;
  assert.equal(pulse.nodeId, "platform-lab-title");
  assert.equal(pulse.plan.easing, "ease-in-out");
  assert.equal(pulse.plan.playbackMode, "loop");
  assert.equal(pulse.plan.durationSeconds, 0.5);
  assert.equal(pulse.plan.tracks.length, 4);
});

test("the generated host carries all four tables and the host class", () => {
  const host = hostModule(compileUiScene(example), "examples/harlem-courts.tsx");
  for (const table of ["GENERATED_SCENE", "GENERATED_POLYLINES", "GENERATED_INTERACTIONS", "GENERATED_ANIMATIONS"]) {
    assert.match(host, new RegExp("const " + table + ": any"));
  }
  assert.match(host, /export class ViroGeneratedSceneHost extends BaseScriptComponent/);
  assert.doesNotMatch(host, /ViroUIScene/);
});

test("sync --clean keeps .meta files and everything outside lens/", async () => {
  const project = await mkdtemp(path.join(os.tmpdir(), "viro-sync-"));
  const specs = path.join(project, "Assets", "ViroSpecs");
  for (const dir of ["generated", "Media", "ArchivedTemplate", "lens"]) await mkdir(path.join(specs, dir), { recursive: true });
  await writeFile(path.join(specs, "generated", "ViroGeneratedSceneHost.ts"), "host");
  await writeFile(path.join(specs, "generated", "ViroGeneratedSceneHost.ts.meta"), "meta");
  await writeFile(path.join(specs, "Media", "clip.mp4"), "video");
  await writeFile(path.join(specs, "lens", "Stale.ts"), "old");
  await writeFile(path.join(specs, "lens", "ViroSpecsSceneRuntime.ts.meta"), "meta");

  const script = new URL("./sync-lens-runtime.mjs", import.meta.url).pathname;
  const run = spawnSync(process.execPath, [script, "--project", project, "--clean"], { encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr);

  assert.ok(existsSync(path.join(specs, "generated", "ViroGeneratedSceneHost.ts")));
  assert.ok(existsSync(path.join(specs, "generated", "ViroGeneratedSceneHost.ts.meta")));
  assert.ok(existsSync(path.join(specs, "Media", "clip.mp4")));
  assert.ok(existsSync(path.join(specs, "ArchivedTemplate")));
  assert.ok(existsSync(path.join(specs, "lens", "ViroSpecsSceneRuntime.ts.meta")));
  assert.ok(!existsSync(path.join(specs, "lens", "Stale.ts")), "stale runtime file removed");
  assert.ok((await readdir(path.join(specs, "lens"))).includes("ViroSpecsSceneRuntime.ts"));
  await rm(project, { recursive: true, force: true });
});
