#!/usr/bin/env node
// Packs @viro-external/xr-contract and @viro-external/specs, installs the two
// tarballs into a throwaway consumer project with npm (no workspace links,
// strict peer resolution) and checks what a developer actually gets:
//
//   - both packages land as real directories, not symlinks into the repo
//   - nothing pulls in React, React Native or a Viro package
//   - ESM import and CommonJS require load and expose the same names
//   - the types, import, require and react-native targets in the packed
//     package.json all point at files that exist
//   - a strict TypeScript consumer type-checks against the packed .d.ts
//   - no file under lens/ or dist/ imports React, React Native or Viro
//   - the installed validate, sync and doctor scripts run against a Lens
//     project with the validated packages, and sync copies exactly the
//     production files listed in lens-runtime.json
//
// Usage:
//   node scripts/check-packed-consumer.mjs [--tarballs <dir>] [--keep]
// Without --tarballs it runs `pnpm pack` for both packages first.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, lstatSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { lensProject } from "./support/lens-project-fixture.mjs";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspaceRoot = path.resolve(packageRoot, "..", "..");
const FORBIDDEN = /(?:from\s*|import\s*\(\s*|require\s*\(\s*)["'](react|react-native|react-dom|@reactvision\/[^"']*|@react-native\/[^"']*)(?:\/[^"']*)?["']/;

const args = process.argv.slice(2);
const keep = args.includes("--keep");
const tarballIndex = args.indexOf("--tarballs");
let tarballDir = tarballIndex >= 0 ? path.resolve(args[tarballIndex + 1] ?? "") : "";

const results = [];
function check(name, fn) {
  try {
    const detail = fn();
    results.push({ name, ok: true, detail: detail ?? "" });
  } catch (error) {
    results.push({ name, ok: false, detail: error instanceof Error ? error.message : String(error) });
  }
}
function assert(condition, message) {
  if (!condition) throw new Error(message);
}
function run(command, commandArgs, cwd) {
  return execFileSync(command, commandArgs, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}
function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

if (!tarballDir) {
  tarballDir = mkdtempSync(path.join(tmpdir(), "viro-specs-pack-"));
  for (const name of ["@viro-external/xr-contract", "@viro-external/specs"]) {
    run("pnpm", ["--filter", name, "pack", "--pack-destination", tarballDir], workspaceRoot);
  }
}
const tarballs = readdirSync(tarballDir).filter((file) => file.endsWith(".tgz"));
const contractTgz = tarballs.find((file) => file.startsWith("viro-external-xr-contract-"));
const specsTgz = tarballs.find((file) => file.startsWith("viro-external-specs-"));
if (!contractTgz || !specsTgz) {
  console.error(`Expected viro-external-xr-contract-*.tgz and viro-external-specs-*.tgz in ${tarballDir}, found: ${tarballs.join(", ") || "nothing"}`);
  process.exit(1);
}

const consumer = mkdtempSync(path.join(tmpdir(), "viro-specs-consumer-"));
writeFileSync(path.join(consumer, "package.json"), JSON.stringify({ name: "viro-specs-consumer-fixture", private: true, type: "module" }, null, 2) + "\n");
const install = spawnSync(
  "npm",
  ["install", "--strict-peer-deps", "--ignore-scripts", "--no-audit", "--no-fund", path.join(tarballDir, contractTgz), path.join(tarballDir, specsTgz)],
  { cwd: consumer, encoding: "utf8" },
);
console.log(`consumer: ${consumer}`);
console.log(`npm install exit ${install.status}`);
process.stdout.write(install.stdout);
if (install.status !== 0) {
  process.stderr.write(install.stderr);
  process.exit(1);
}

const modules = path.join(consumer, "node_modules");
const specsDir = path.join(modules, "@viro-external", "specs");
const contractDir = path.join(modules, "@viro-external", "xr-contract");
const specsManifest = JSON.parse(readFileSync(path.join(specsDir, "package.json"), "utf8"));

check("packages are installed copies, not workspace links", () => {
  for (const dir of [specsDir, contractDir]) assert(!lstatSync(dir).isSymbolicLink(), `${dir} is a symlink`);
  const manifests = [specsManifest, JSON.parse(readFileSync(path.join(contractDir, "package.json"), "utf8"))];
  for (const manifest of manifests) {
    for (const field of ["dependencies", "peerDependencies", "optionalDependencies"]) {
      for (const [name, range] of Object.entries(manifest[field] ?? {})) {
        assert(!String(range).startsWith("workspace:"), `${manifest.name} ${field}.${name} is ${range}`);
      }
    }
  }
  return `${specsManifest.name}@${specsManifest.version}`;
});

check("no React, React Native or Viro package is installed", () => {
  const installed = readdirSync(modules).flatMap((name) =>
    name.startsWith("@") ? readdirSync(path.join(modules, name)).map((scoped) => `${name}/${scoped}`) : [name],
  ).filter((name) => !name.startsWith("."));
  const forbidden = installed.filter((name) => /^(react|react-native|react-dom|@reactvision\/.*|@react-native\/.*)$/.test(name));
  assert(forbidden.length === 0, `installed: ${forbidden.join(", ")}`);
  return installed.join(", ");
});

check("every export target in the packed package.json exists", () => {
  const targets = [specsManifest.main, specsManifest.module, specsManifest.types, specsManifest["react-native"]];
  const root = specsManifest.exports?.["."] ?? {};
  for (const key of ["types", "react-native", "import", "require", "default"]) targets.push(root[key]);
  for (const target of targets) {
    assert(typeof target === "string", `missing target in ${JSON.stringify(specsManifest.exports)}`);
    assert(existsSync(path.join(specsDir, target)), `${target} does not exist in the installed package`);
  }
  assert(root.types === "./dist/index.d.ts", `exports["."].types is ${root.types}; published types must be the emitted .d.ts`);
  return `types ${root.types}, react-native ${root["react-native"]}`;
});

check("ESM import and CommonJS require expose the same names", () => {
  const esm = run(process.execPath, ["--input-type=module", "-e", "const m = await import('@viro-external/specs'); console.log(JSON.stringify(Object.keys(m).sort()))"], consumer);
  const cjs = run(process.execPath, ["-e", "console.log(JSON.stringify(Object.keys(require('@viro-external/specs')).sort()))"], consumer);
  assert(esm.trim() === cjs.trim(), `ESM ${esm.trim()} != CJS ${cjs.trim()}`);
  return `${JSON.parse(esm).length} exports`;
});

check("a strict TypeScript consumer type-checks against the packed declarations", () => {
  writeFileSync(
    path.join(consumer, "consumer.ts"),
    [
      'import { compileSpecsScene, type SpecsCompileResult } from "@viro-external/specs";',
      'import type { PortableXRNode } from "@viro-external/xr-contract";',
      "const nodes: PortableXRNode[] = [];",
      "const result: SpecsCompileResult = compileSpecsScene(nodes);",
      "export const nodeCount: number = result.scene.nodes.length;",
      "",
    ].join("\n"),
  );
  writeFileSync(
    path.join(consumer, "tsconfig.json"),
    JSON.stringify({
      compilerOptions: {
        target: "ES2022", module: "NodeNext", moduleResolution: "NodeNext", strict: true,
        exactOptionalPropertyTypes: true, noUncheckedIndexedAccess: true, noEmit: true, skipLibCheck: false, types: [],
      },
      files: ["consumer.ts"],
    }, null, 2) + "\n",
  );
  const tsc = path.join(packageRoot, "node_modules", ".bin", "tsc");
  const result = spawnSync(tsc, ["-p", "tsconfig.json", "--listFilesOnly"], { cwd: consumer, encoding: "utf8" });
  const checked = spawnSync(tsc, ["-p", "tsconfig.json"], { cwd: consumer, encoding: "utf8" });
  assert(checked.status === 0, `tsc exit ${checked.status}\n${checked.stdout}${checked.stderr}`);
  const sources = (result.stdout ?? "").split("\n").filter((line) => line.includes("@viro-external/") && line.endsWith(".ts") && !line.endsWith(".d.ts"));
  assert(sources.length === 0, `tsc read package sources instead of declarations: ${sources.join(", ")}`);
  return "tsc exit 0 with strict, exactOptionalPropertyTypes, noUncheckedIndexedAccess, skipLibCheck false";
});

check("no file under lens/ or dist/ imports React, React Native or Viro", () => {
  const files = [...walk(path.join(specsDir, "lens")), ...walk(path.join(specsDir, "dist")), ...walk(path.join(contractDir, "dist"))]
    .filter((file) => /\.(ts|js|mjs|cjs)$/.test(file));
  const offenders = files.filter((file) => FORBIDDEN.test(readFileSync(file, "utf8")));
  assert(offenders.length === 0, offenders.map((file) => path.relative(modules, file)).join(", "));
  return `${files.length} files scanned`;
});

check("tests and test fixtures are not shipped", () => {
  const shipped = walk(path.join(specsDir, "scripts")).map((file) => path.relative(specsDir, file));
  const tests = shipped.filter((file) => file.endsWith(".test.mjs") || file.startsWith("scripts/support/") || file.startsWith("scripts/fixtures/"));
  assert(tests.length === 0, tests.join(", "));
  return shipped.join(", ");
});

const installedScripts = path.join(specsDir, "scripts");
check("installed validate-lens-runtime passes", () => run(process.execPath, [path.join(installedScripts, "validate-lens-runtime.mjs")], consumer).trim());

check("installed sync copies exactly the production files into a Lens project, and doctor passes", () => {
  const project = lensProject({ prefix: "viro-specs-consumer-lens-" });
  run(process.execPath, [path.join(installedScripts, "sync-lens-runtime.mjs"), "--project", project], consumer);
  const runtimeManifest = JSON.parse(readFileSync(path.join(specsDir, "lens-runtime.json"), "utf8"));
  const synced = walk(path.join(project, "Assets"))
    .map((file) => path.basename(file))
    .filter((file) => file.endsWith(".ts"))
    .sort();
  const expected = [...runtimeManifest.files.production].sort();
  assert(JSON.stringify(synced) === JSON.stringify(expected), `synced ${synced.join(", ")}\nexpected ${expected.join(", ")}`);
  const doctor = spawnSync(process.execPath, [path.join(installedScripts, "doctor-lens-project.mjs"), "--project", project], { cwd: consumer, encoding: "utf8" });
  assert(doctor.status === 0, `doctor exit ${doctor.status}\n${doctor.stdout}${doctor.stderr}`);
  return `${synced.length} production files synced; doctor exit 0`;
});

if (!keep) rmSync(consumer, { recursive: true, force: true });

let failed = 0;
for (const result of results) {
  console.log(`${result.ok ? "PASS" : "FAIL"} ${result.name}${result.detail ? `\n     ${result.detail.split("\n").join("\n     ")}` : ""}`);
  if (!result.ok) failed++;
}
console.log(`${results.length - failed}/${results.length} consumer checks passed`);
process.exit(failed === 0 ? 0 : 1);
