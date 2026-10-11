import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const guides = ["README.md", "docs/README.md", "docs/GETTING_STARTED.md", "docs/LAYOUTS.md", "docs/RIVE.md", "docs/CAPABILITIES.md", "docs/MEDIA_AND_COMPONENTS.md", "docs/examples/README.md"];
let count = 0;
for (const file of guides) {
  const markdown = readFileSync(file, "utf8").replace(/```[\s\S]*?```/g, "");
  for (const match of markdown.matchAll(/\[[^\]]*\]\(([^\s)]+)(?:\s+"[^"\n]*")?\)/g)) {
    const target = match[1];
    if (/^(?:[a-z]+:|#)/i.test(target)) continue;
    const path = decodeURIComponent(target.split("#")[0]);
    if (!existsSync(resolve(dirname(file), path))) throw new Error(`${file}: missing local target ${target}`);
    count++;
  }
}
const ui = readFileSync("packages/ui/src/index.ts", "utf8");
for (const name of ["PanelText", "SpatialPanel", "SpatialWorkspaceFrame", "SpatialWorkspaceOrigin", "createRiveSpatialSurface", "disposeRiveSpatialSurface", "ViroCoreRiveSpatialAdapter", "ViroCoreRiveNativeHost"]) {
  if (!new RegExp(`\\b${name}\\b`).test(ui)) throw new Error(`Documented UI export disappeared: ${name}`);
}
for (const entry of readdirSync("docs/examples")) {
  if (/\.(?:ts|tsx)$/.test(entry) && /\buseState\b/.test(readFileSync(`docs/examples/${entry}`, "utf8"))) {
    throw new Error(`docs/examples/${entry}: keep state in the application's existing store`);
  }
}
console.log(`${guides.length} guides, ${count} local link targets, and named example exports checked. External URLs, anchors, TypeScript semantics and devices are separate checks.`);
