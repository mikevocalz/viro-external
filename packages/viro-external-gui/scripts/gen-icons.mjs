// Rasterize a curated Lucide set → white PNGs for ViroImage.
// Run: node scripts/gen-icons.mjs  (regenerates assets/icons/*.png)
import { readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import sharp from "sharp";

const require = createRequire(import.meta.url);
const ICONS = ["x", "pin", "pin-off", "chevron-up", "chevron-down", "play", "pause", "volume-2", "volume-x", "menu", "globe", "mic", "video", "image", "settings", "message-square", "eye"];
const SIZE = 128;

for (const name of ICONS) {
  const svgPath = require.resolve(`lucide-static/icons/${name}.svg`);
  let svg = await readFile(svgPath, "utf8");
  // Lucide strokes are currentColor — force white for dark chrome.
  svg = svg.replace('stroke="currentColor"', 'stroke="#FFFFFF"');
  const png = await sharp(Buffer.from(svg), { density: 300 })
    .resize(SIZE, SIZE, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  await writeFile(new URL(`../assets/icons/${name}.png`, import.meta.url), png);
  console.log(`icons/${name}.png (${png.length}b)`);
}
