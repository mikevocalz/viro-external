#!/usr/bin/env node
import { readdir, readFile, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

function readArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const projectArg = readArg("--project");
if (!projectArg) {
  throw new Error(
    "Usage: pnpm specs:doctor -- --project /absolute/path/to/LensStudioProject"
  );
}

const project = path.resolve(projectArg);
const assets = path.join(project, "Assets");
const packages = path.join(project, "Packages");

if (!existsSync(project) || !(await stat(project)).isDirectory()) {
  throw new Error("Lens Studio project folder does not exist: " + project);
}

if (!existsSync(assets)) {
  throw new Error("Lens Studio Assets directory is missing: " + assets);
}

const rootEntries = await readdir(project);
const esprojFiles = rootEntries.filter((name) => name.endsWith(".esproj"));

if (esprojFiles.length !== 1) {
  throw new Error(
    "Expected exactly one .esproj file in project root; found " +
      esprojFiles.length
  );
}

const esprojPath = path.join(project, esprojFiles[0]);
const esproj = await readFile(esprojPath, "utf8");

function matchInt(label) {
  const re = new RegExp("^\\s*" + label + ":\\s*(\\d+)\\s*$", "m");
  const match = esproj.match(re);
  return match ? Number(match[1]) : null;
}

const versionBlock = esproj.match(
  /studioVersion:\s*\n([\s\S]*?)(?=\n\S|$)/
)?.[1] ?? "";
const major = Number(versionBlock.match(/major:\s*(\d+)/)?.[1] ?? 0);
const minor = Number(versionBlock.match(/minor:\s*(\d+)/)?.[1] ?? 0);
const patch = Number(versionBlock.match(/patch:\s*(\d+)/)?.[1] ?? 0);
const target = esproj.match(/^targetPlatform:\s*(\S+)/m)?.[1] ?? "unknown";

const errors = [];
const warnings = [];

if (target !== "Spectacles") {
  errors.push(
    "Project targetPlatform is " + target + "; expected Spectacles/SPECS."
  );
}

if (major < 5 || (major === 5 && minor < 22)) {
  errors.push(
    "Lens Studio project version is " +
      [major, minor, patch].join(".") +
      "; SPECS 27 runtime requires 5.22.0+."
  );
}

const requiredPackages = [
  "SpectaclesInteractionKit.lspkg",
  "SpectaclesUIKit.lspkg",
  "SurfacePlacement.lspkg",
  "VolumetricLine.lspkg",
  "SpecsNavigationKit.lspkg",
];

const previewPackages = [
  "Leaf.lspkg",
  "AiPreviewAgentInspect.lspkg",
  "AiPreviewAgentInteract.lspkg",
];

const packageEntries = existsSync(packages) ? await readdir(packages) : [];
for (const name of requiredPackages) {
  if (!packageEntries.includes(name)) {
    warnings.push("Required Lens package not found in Packages/: " + name);
  }
}
for (const name of previewPackages) {
  if (!packageEntries.includes(name)) {
    warnings.push("Preview validation package not found in Packages/: " + name);
  }
}

const runtimeDir = path.join(assets, "ViroSpecs", "lens");
if (!existsSync(runtimeDir)) {
  warnings.push(
    "Viro Specs runtime has not been synced to Assets/ViroSpecs/lens."
  );
}

console.log("Viro Specs Lens project doctor");
console.log("------------------------------");
console.log("Project:", project);
console.log("Project file:", esprojFiles[0]);
console.log("Lens Studio:", [major, minor, patch].join("."));
console.log("Target:", target);
console.log("Packages present:", packageEntries.length);
console.log("Runtime synced:", existsSync(runtimeDir) ? "yes" : "no");

if (warnings.length) {
  console.log("\nWarnings:");
  for (const warning of warnings) console.log(" -", warning);
}

if (errors.length) {
  console.error("\nErrors:");
  for (const error of errors) console.error(" -", error);
  process.exitCode = 1;
} else {
  console.log("\nCore project checks passed.");
}

void matchInt;
