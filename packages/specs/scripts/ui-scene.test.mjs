import { test } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { compileUiScene } from "./compile-ui-scene.mjs";

const example = fileURLToPath(new URL("../examples/harlem-courts.tsx", import.meta.url));

test("the example maps to a scrolling panel and a video panel", () => {
  const { nodes, diagnostics } = compileUiScene(example, { parentId: "root" });
  assert.deepEqual(diagnostics, []);

  const ids = nodes.map((n) => n.id);
  assert.equal(new Set(ids).size, ids.length, "node ids are unique");

  const panel = nodes.find((n) => n.id === "platform-lab-panel");
  assert.equal(panel.kind, "panel");
  assert.equal(panel.parentId, "root");

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
