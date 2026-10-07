#!/usr/bin/env node
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(here, "..");
const sourceLens = path.join(packageRoot, "lens");
const upstreamManifest = path.join(packageRoot, "upstream", "specs-27.json");

function readArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const projectArg = readArg("--project");
const clean = process.argv.includes("--clean");

if (!projectArg) {
  throw new Error(
    "Usage: pnpm specs:sync -- --project /absolute/path/to/LensStudioProject [--clean]"
  );
}

const project = path.resolve(projectArg);
const assets = path.join(project, "Assets");
const destination = path.join(assets, "ViroSpecs");

if (!existsSync(project)) {
  throw new Error("Lens Studio project does not exist: " + project);
}

if (!existsSync(assets)) {
  throw new Error(
    "Expected Lens Studio Assets directory at: " + assets
  );
}

if (clean) {
  await rm(destination, { recursive: true, force: true });
}

await mkdir(destination, { recursive: true });
await cp(sourceLens, path.join(destination, "lens"), {
  recursive: true,
  force: true,
});

const upstream = JSON.parse(await readFile(upstreamManifest, "utf8"));

const dependencies = {
  schemaVersion: 1,
  generatedBy: "@viro-external/specs",
  wireVersion: 1,
  target: upstream.source.target,
  lensStudio: upstream.source.lensStudio,
  upstream: {
    repository: upstream.source.repository,
    commit: upstream.source.commit,
  },
  requiredPackages: [
    "SpectaclesInteractionKit.lspkg",
    "SurfacePlacement.lspkg",
    "VolumetricLine.lspkg",
    "SpecsNavigationKit.lspkg",
  ],
  editorValidationPackages: [
    "Leaf.lspkg",
    "AiPreviewAgentInspect.lspkg",
    "AiPreviewAgentInteract.lspkg",
  ],
  notes: [
    "Install required .lspkg dependencies through Lens Studio Asset Library or project Packages before preview/device builds.",
    "AiPreviewAgent packages are editor-only validation dependencies and remain inert on device.",
  ],
};

await writeFile(
  path.join(destination, "viro-specs.dependencies.json"),
  JSON.stringify(dependencies, null, 2) + "\n",
  "utf8"
);

console.log("Synced Viro Specs Lens runtime to:");
console.log(destination);
console.log("");
console.log("Pinned upstream:", upstream.source.repository, upstream.source.commit);
console.log("Target:", upstream.source.target, "Lens Studio", upstream.source.lensStudio);
