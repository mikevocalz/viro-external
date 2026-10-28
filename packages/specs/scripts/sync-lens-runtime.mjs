#!/usr/bin/env node
import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
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
const kitArg = readArg("--interaction-kit");

/**
 * Interaction Kit package names by Asset Library line. 2.x ships
 * SpectaclesInteractionKit.lspkg; 4.0.0 renamed it InteractionKit.lspkg.
 * Only lens/ViroSpecsInteractionKit.ts imports the kit, so switching lines
 * rewrites that one file's package prefix in the synced copy.
 */
const INTERACTION_KIT_PACKAGES = { 2: "SpectaclesInteractionKit.lspkg", 4: "InteractionKit.lspkg" };
const SEAM = "ViroSpecsInteractionKit.ts";

if (!projectArg) {
  throw new Error(
    "Usage: pnpm specs:sync -- --project /absolute/path/to/LensStudioProject [--clean] [--interaction-kit 2|4]"
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

// Pick the kit line: explicit flag, else what the project has installed,
// else the validated 2.x line.
const packagesDir = path.join(project, "Packages");
const installed = existsSync(packagesDir) ? await readdir(packagesDir) : [];
let kitLine;
if (kitArg !== undefined) {
  if (kitArg !== "2" && kitArg !== "4") throw new Error("--interaction-kit must be 2 or 4, got " + kitArg);
  kitLine = Number(kitArg);
} else if (installed.includes(INTERACTION_KIT_PACKAGES[4]) && !installed.includes(INTERACTION_KIT_PACKAGES[2])) {
  kitLine = 4;
} else {
  kitLine = 2;
}
const kitPackage = INTERACTION_KIT_PACKAGES[kitLine];

await mkdir(destination, { recursive: true });
await cp(sourceLens, path.join(destination, "lens"), {
  recursive: true,
  force: true,
});
if (kitLine !== 2) {
  const seamPath = path.join(destination, "lens", SEAM);
  const seam = await readFile(seamPath, "utf8");
  await writeFile(seamPath, seam.split('"' + INTERACTION_KIT_PACKAGES[2] + "/").join('"' + kitPackage + "/"), "utf8");
}

const upstream = JSON.parse(await readFile(upstreamManifest, "utf8"));

const dependencies = {
  schemaVersion: 1,
  generatedBy: "@viro-external/specs",
  wireVersion: 1,
  sceneProtocols: [1, 2],
  interactionKit: { line: kitLine, package: kitPackage },
  target: upstream.source.target,
  lensStudio: upstream.source.lensStudio,
  upstream: {
    repository: upstream.source.repository,
    commit: upstream.source.commit,
  },
  requiredPackages: [
    kitPackage,
    // ScrollWindow for scroll groups (ViroSpecsSceneRuntime).
    "SpectaclesUIKit.lspkg",
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
console.log("Interaction Kit:", kitPackage, "(line " + kitLine + (kitArg ? ", from --interaction-kit" : ", detected") + ")");
