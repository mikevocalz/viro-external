#!/usr/bin/env node
/**
 * Bake a Rive file into an animated texture Lens Studio can play.
 *
 * Specs Lenses cannot run Rive: the Lens runtime has no WebAssembly
 * (reports/rive-on-lens-2026-10-03.md). So the clips a scene uses are rendered
 * here, at build time, with Rive's own web runtime in headless Chromium, and
 * written as one GIF plus the frame range of each clip. On Specs the Rive
 * panel plays those ranges and switches clips on tap.
 *
 * ponytail: GIF has 1-bit alpha, so frames are drawn over an opaque
 * background (the panel colour by default). Move to a sprite sheet and an
 * alpha shader if a Rive panel needs to be see-through.
 */
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const require = createRequire(import.meta.url);

/**
 * A Chromium to drive: VIRO_RIVE_CHROMIUM if set, else playwright-core's own
 * build, else the newest Chromium already in Playwright's shared cache (any
 * build renders Rive the same way, and it saves a download).
 */
function chromiumExecutable() {
  if (process.env.VIRO_RIVE_CHROMIUM) return process.env.VIRO_RIVE_CHROMIUM;
  const { chromium } = require("playwright-core");
  const own = chromium.executablePath();
  if (existsSync(own)) return own;
  const cache = path.join(os.homedir(), "Library", "Caches", "ms-playwright");
  const relative = path.relative(path.join(cache, path.basename(path.dirname(path.dirname(path.dirname(path.dirname(path.dirname(own))))))), own);
  const builds = existsSync(cache)
    ? readdirSync(cache).filter((name) => /^chromium-\d+$/.test(name)).sort().reverse()
    : [];
  for (const build of builds) {
    const candidate = path.join(cache, build, relative);
    if (existsSync(candidate)) return candidate;
  }
  throw new Error("No Chromium found. Run `npx playwright-core install chromium` or set VIRO_RIVE_CHROMIUM.");
}

/**
 * @param {object} options
 * @param {string} options.riv            path to the .riv file
 * @param {{ name: string, animation: string, loop?: boolean }[]} options.clips
 * @param {string} options.out            output .gif path
 * @param {number} [options.width]        frame width in pixels
 * @param {number} [options.fps]
 * @param {string} [options.background]   CSS colour behind the art
 * @param {string} [options.artboard]
 * @returns {Promise<{ frames: number, fps: number, width: number, height: number,
 *   clips: Record<string, { start: number, end: number, loop: boolean }> }>}
 */
/**
 * Serve the Rive web runtime and one .riv to a headless Chromium page and
 * run `use(page)` against it.
 */
async function withRivePage(riv, use, background = "#181B24") {
  const runtime = path.dirname(require.resolve("@rive-app/webgl2"));
  const files = {
    "/rive.js": [path.join(runtime, "rive.js"), "text/javascript"],
    "/rive.wasm": [path.join(runtime, "rive.wasm"), "application/wasm"],
    "/scene.riv": [path.resolve(riv), "application/octet-stream"],
  };
  const server = createServer(async (req, res) => {
    if (req.url === "/") {
      res.writeHead(200, { "content-type": "text/html" });
      res.end(`<body style="margin:0;background:${background}"><canvas id="c"></canvas><script src="/rive.js"></script></body>`);
      return;
    }
    const file = files[req.url ?? ""];
    if (!file) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "content-type": file[1] });
    res.end(await readFile(file[0]));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = /** @type {import("node:net").AddressInfo} */ (server.address()).port;
  const { chromium } = require("playwright-core");
  const browser = await chromium.launch({
    executablePath: chromiumExecutable(),
    // Software GL, so baking does not depend on the machine's GPU.
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  });
  try {
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${port}/`);
    return await use(page);
  } finally {
    await browser.close();
    server.close();
  }
}

export async function bakeRive({ riv, clips, out, width = 640, fps = 25, background = "#181B24", artboard }) {
  const frameDir = await mkdtemp(path.join(os.tmpdir(), "viro-rive-"));
  try {
    return await withRivePage(riv, async (page) => {
    const size = await page.evaluate(async ({ artboard }) => {
      const canvas = document.getElementById("c");
      await new Promise((resolve, reject) => {
        window.__rive = new rive.Rive({
          src: "/scene.riv",
          canvas,
          artboard,
          autoplay: false,
          onLoad: resolve,
          onLoadError: reject,
        });
      });
      const ab = window.__rive.artboard;
      return { width: ab.width, height: ab.height };
    }, { artboard });

    const height = Math.round((width * size.height) / size.width);
    await page.setViewportSize({ width, height });
    await page.evaluate(({ width, height }) => {
      const canvas = document.getElementById("c");
      canvas.width = width;
      canvas.height = height;
      canvas.style.width = width + "px";
      canvas.style.height = height + "px";
      window.__rive.resizeDrawingSurfaceToCanvas();
    }, { width, height });

    const manifest = { frames: 0, fps, width, height, clips: {} };
    const canvas = page.locator("#c");
    for (const clip of clips) {
      const duration = await page.evaluate((name) => {
        const a = window.__rive.artboard.animationByName(name);
        if (!a) throw new Error("No animation named " + name);
        return a.duration / a.fps;
      }, clip.animation);
      const count = Math.max(1, Math.round(duration * fps));
      const start = manifest.frames;
      for (let i = 0; i < count; i++) {
        const time = count === 1 ? 0 : (i / count) * duration;
        await page.evaluate(([name, t]) => new Promise((resolve) => {
          window.__rive.scrub(name, t);
          // scrub draws on the next animation frame.
          requestAnimationFrame(() => requestAnimationFrame(resolve));
        }), [clip.animation, time]);
        const index = String(manifest.frames).padStart(5, "0");
        await canvas.screenshot({ path: path.join(frameDir, `f${index}.png`) });
        manifest.frames += 1;
      }
      manifest.clips[clip.name] = { start, end: manifest.frames - 1, loop: clip.loop ?? false };
    }

    // One palette for the whole sheet keeps colours stable across clips.
    const ffmpeg = spawnSync("ffmpeg", [
      "-y", "-loglevel", "error", "-framerate", String(fps),
      "-i", path.join(frameDir, "f%05d.png"),
      "-filter_complex", "[0:v]split[a][b];[a]palettegen=stats_mode=full[p];[b][p]paletteuse=dither=sierra2_4a",
      "-loop", "0", path.resolve(out),
    ], { encoding: "utf8" });
    if (ffmpeg.status !== 0) throw new Error("ffmpeg failed: " + ffmpeg.stderr);
    return manifest;
    }, background);
  } finally {
    await rm(frameDir, { recursive: true, force: true });
  }
}

/**
 * What a .riv contains, read through Rive's runtime: artboard size and every
 * animation with its length and loop mode. Works for any .riv, however it
 * was made.
 */
export async function discoverRive({ riv, artboard }) {
  return withRivePage(riv, async (page) =>
    page.evaluate(async ({ artboard }) => {
      await new Promise((resolve, reject) => {
        window.__rive = new rive.Rive({
          src: "/scene.riv", canvas: document.getElementById("c"), artboard,
          autoplay: false, onLoad: resolve, onLoadError: reject,
        });
      });
      const r = window.__rive;
      const ab = r.artboard;
      const board = r.contents.artboards.find((a) => a.name === (artboard ?? ab.name)) ?? r.contents.artboards[0];
      return {
        artboard: board.name,
        size: [ab.width, ab.height],
        stateMachines: board.stateMachines.map((m) => m.name),
        animations: board.animations.map((name) => {
          const a = ab.animationByName(name);
          // Rive loop values: 0 one-shot, 1 loop, 2 ping-pong.
          return { name, frames: a.duration, fps: a.fps, loop: a.loopValue !== 0 };
        }),
      };
    }, { artboard })
  );
}

/**
 * The buttons a Rive file draws, from its RML project: every shape a
 * state-machine listener targets with a pointer down or up, as a rect in
 * artboard pixels, labelled from the shape name ("Btn hit SUBMIT" → "Submit").
 * `inspect` is the JSON `rive inspect --json` prints; pass a saved copy, or
 * use riveInspect() to run the CLI on a project directory.
 */
export function riveButtons(inspect, artboardName) {
  const board =
    inspect.artboards.find((a) => a.name === (artboardName ?? inspect.defaultArtboard)) ?? inspect.artboards[0];
  const shapes = new Map();
  const listeners = [];
  const walk = (node, origin) => {
    if (!node || typeof node !== "object") return;
    const here = [origin[0] + (node.x && node.type !== "Rectangle" ? node.x : 0), origin[1] + (node.y && node.type !== "Rectangle" ? node.y : 0)];
    if (node.type === "Shape" && node.id) shapes.set(node.id, { node, origin: here });
    if (typeof node.type === "string" && node.type.startsWith("StateMachineListener")) listeners.push(node);
    for (const child of node.children ?? []) walk(child, node.type === "Shape" || node.type === "Node" ? here : origin);
  };
  walk(board, [0, 0]);

  const POINTER = new Set([2, 3]); // down, up
  const seen = new Set();
  const buttons = [];
  for (const listener of listeners) {
    if (!POINTER.has(listener.listenerTypeValue) || seen.has(listener.targetId)) continue;
    const shape = shapes.get(listener.targetId);
    const rect = shape?.node.children?.find((c) => c.type === "Rectangle");
    if (!rect) continue;
    seen.add(listener.targetId);
    const name = String(shape.node.name ?? listener.targetId);
    const raw = name.replace(/^(btn\s*)?hit\s*/i, "").trim() || name;
    const label = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
    const x = shape.origin[0] + rect.x - rect.width * (rect.originX ?? 0.5);
    const y = shape.origin[1] + rect.y - rect.height * (rect.originY ?? 0.5);
    buttons.push({ id: raw.toLowerCase().replace(/\s+/g, "-"), label, rect: [x, y, rect.width, rect.height] });
  }
  return { size: [board.width, board.height], buttons };
}

/** Run `rive inspect --json` on an RML project directory. */
export function riveInspect(projectDir) {
  const run = spawnSync("rive", ["inspect", projectDir, "--json"], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  if (run.status !== 0) throw new Error("rive inspect failed: " + (run.stderr || run.error));
  return JSON.parse(run.stdout);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = (name) => {
    const index = process.argv.indexOf(name);
    return index >= 0 ? process.argv[index + 1] : undefined;
  };
  const riv = arg("--riv");
  const out = arg("--out");
  const clips = arg("--clips");
  if (!riv || !out || !clips) {
    console.error('Usage: pnpm specs:bake-rive -- --riv file.riv --out file.gif --clips "Name=Animation[:loop],..." [--width 640]');
    process.exit(1);
  }
  const manifest = await bakeRive({
    riv,
    out,
    width: Number(arg("--width") ?? 640),
    clips: clips.split(",").map((entry) => {
      const [name, rest] = entry.split("=");
      const [animation, loop] = (rest ?? name).split(":");
      return { name, animation, loop: loop === "loop" };
    }),
  });
  await writeFile(out.replace(/\.gif$/, ".json"), JSON.stringify(manifest, null, 2));
  console.log(`Baked ${manifest.frames} frames (${Object.keys(manifest.clips).join(", ")}) to ${out}`);
}
