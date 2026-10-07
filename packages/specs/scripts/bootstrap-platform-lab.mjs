#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(here, "..");

function readArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const projectArg = readArg("--project");
if (!projectArg) {
  throw new Error(
    "Usage: pnpm specs:bootstrap -- --project /absolute/path/to/LensStudioProject"
  );
}

const project = path.resolve(projectArg);
const syncScript = path.join(here, "sync-lens-runtime.mjs");
const doctorScript = path.join(here, "doctor-lens-project.mjs");
const promptSource = path.join(packageRoot, "doc", "CLADFinishPrompt.md");

const doctor = spawnSync(
  process.execPath,
  [doctorScript, "--project", project],
  { stdio: "inherit" }
);
if (doctor.status !== 0) {
  process.exit(doctor.status ?? 1);
}

const sync = spawnSync(
  process.execPath,
  [syncScript, "--project", project],
  { stdio: "inherit" }
);
if (sync.status !== 0) {
  process.exit(sync.status ?? 1);
}

const prompt = await readFile(promptSource, "utf8");
const destination = path.join(project, "VIRO_SPECS_CLAD_FINISH.md");
await writeFile(destination, prompt, "utf8");

console.log("\nBootstrap complete.");
console.log("CLAD finish prompt:", destination);
console.log("\nNext:");
console.log("  1. Keep this Lens Studio project open.");
console.log("  2. Open a terminal in:", project);
console.log("  3. Start Codex from that folder.");
console.log("  4. Verify /mcp shows lens-studio.");
console.log("  5. Paste the contents of VIRO_SPECS_CLAD_FINISH.md into Codex.");
