#!/usr/bin/env node
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { existsSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(here, "..");
const sourceLens = path.join(packageRoot, "lens");

function readArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const projectArg = readArg("--project");

if (!projectArg) {
  throw new Error(
    "Usage: pnpm specs:typecheck-lens -- --project /absolute/path/to/LensStudioProject"
  );
}

const project = path.resolve(projectArg);
const viroSpecs = path.join(project, "Assets", "ViroSpecs");
const studioLib = path.join(project, "Cache", "StudioLib", "StudioLib.d.ts");
const declarations = path.join(
  project,
  "Cache",
  "TypeScript",
  "lib",
  "LensifyTS",
  "Declarations"
);
const packageSources = path.join(project, "Cache", "TypeScript", "Src", "Packages");

for (const [label, target] of [
  ["Lens Studio project", project],
  ["synced Viro runtime", viroSpecs],
  ["Lens Studio API declarations", studioLib],
  ["LensifyTS declarations", declarations],
  ["unpacked .lspkg sources", packageSources],
]) {
  if (!existsSync(target)) {
    throw new Error(
      "Missing " +
        label +
        " at: " +
        target +
        "\nOpen the project in Lens Studio once so it writes Cache/ before typechecking."
    );
  }
}

// The project copy is what Lens Studio compiles, so the gate only means something
// while it still matches the repository. Compare before trusting the result.
const divergent = [];
for (const file of readdirSync(sourceLens).filter((entry) => entry.endsWith(".ts"))) {
  const mirrored = path.join(viroSpecs, "lens", file);
  if (!existsSync(mirrored)) {
    divergent.push(file + " (missing from project)");
    continue;
  }
  const [a, b] = await Promise.all([
    readFile(path.join(sourceLens, file), "utf8"),
    readFile(mirrored, "utf8"),
  ]);
  if (a !== b) {
    divergent.push(file + " (content differs)");
  }
}

if (divergent.length > 0) {
  throw new Error(
    "Lens project is out of sync with packages/specs/lens:\n" +
      divergent.map((entry) => " - " + entry).join("\n") +
      "\nRun pnpm specs:sync -- --project '" + project + "' first."
  );
}

// Mirrors the project's own tsconfig: non-strict, no DOM, .lspkg resolved through
// Assets/Packages/unpacked sources. Node16/Bundler resolution replaces the removed
// classic lookup; module shape is irrelevant to a noEmit type gate.
const scratch = await mkdtemp(path.join(tmpdir(), "viro-specs-lens-"));
const configPath = path.join(scratch, "tsconfig.json");

await writeFile(
  configPath,
  JSON.stringify(
    {
      compilerOptions: {
        allowJs: true,
        lib: ["es2021"],
        module: "preserve",
        moduleResolution: "bundler",
        noEmit: true,
        paths: {
          "*": [
            path.join(project, "Assets", "*"),
            path.join(project, "Packages", "*"),
            path.join(packageSources, "*"),
          ],
        },
        skipLibCheck: true,
        strict: false,
        target: "es2021",
        types: [],
      },
      include: [
        studioLib,
        path.join(declarations, "**", "*.d.ts"),
        path.join(viroSpecs, "**", "*.ts"),
      ],
    },
    null,
    2
  ),
  "utf8"
);

const tsc = path.join(packageRoot, "node_modules", ".bin", "tsc");
const result = spawnSync(tsc, ["-p", configPath, "--listFiles", "--pretty", "false"], {
  cwd: packageRoot,
  encoding: "utf8",
});

if (result.error) {
  throw result.error;
}

// tsc prints file lists absolute but diagnostics relative to cwd, so resolve both
// before deciding what belongs to Viro.
const lines = (result.stdout || "").split("\n");
const underViroSpecs = (file) =>
  path.resolve(packageRoot, file).startsWith(viroSpecs + path.sep);

const checked = lines.filter(
  (line) => line.endsWith(".ts") && underViroSpecs(line)
);

// A vendored .lspkg that does not typecheck under its own settings is Snap's
// problem, not a Viro regression. Only Viro sources gate this script.
const diagnostics = lines.filter((line) => /\(\d+,\d+\): error TS/.test(line));
const viroDiagnostics = diagnostics.filter((line) =>
  underViroSpecs(line.replace(/\(\d+,\d+\): error TS[\s\S]*$/, ""))
);

if (viroDiagnostics.length > 0) {
  throw new Error(
    "Lens runtime typecheck failed:\n" + viroDiagnostics.join("\n")
  );
}

if (result.status !== 0 && diagnostics.length === 0) {
  process.stderr.write(result.stderr || "");
  throw new Error("Lens runtime typecheck could not run:\n" + result.stdout);
}

if (diagnostics.length > 0) {
  console.warn(
    "Ignoring",
    diagnostics.length,
    "typecheck errors from vendored .lspkg sources outside Assets/ViroSpecs."
  );
}

console.log(
  "Lens runtime typecheck passed:",
  checked.length,
  "Viro sources against Lens Studio declarations; project matches packages/specs/lens."
);
