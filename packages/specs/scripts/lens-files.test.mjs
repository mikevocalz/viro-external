// Production / validation split of lens/: every file is classified, no
// production file reaches a validation module or package, and a default sync
// ships no validation code.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  assertClassified,
  classifyLensFiles,
  importSpecifiers,
  lensPackageOf,
  lensRoot,
  loadManifest,
  localModuleFile,
} from "./lib/lens-runtime-manifest.mjs";
import { lensProject } from "./support/lens-project-fixture.mjs";

const scripts = path.dirname(fileURLToPath(import.meta.url));
const manifest = loadManifest();
const entries = readdirSync(lensRoot);
const source = (name) => readFileSync(path.join(lensRoot, name), "utf8");
const sync = (root, ...extra) =>
  execFileSync(process.execPath, [path.join(scripts, "sync-lens-runtime.mjs"), "--project", root, ...extra], { encoding: "utf8" });

test("every file in lens/ is classified exactly once", () => {
  const result = assertClassified(entries, manifest);
  assert.equal(result.production.length + result.validation.length + result.notSynced.length, entries.length);
});

test("an unclassified file fails classification instead of defaulting to a set", () => {
  const result = classifyLensFiles([...entries, "ViroSpecsNewThing.ts"], manifest);
  assert.deepEqual(result.unknown, ["ViroSpecsNewThing.ts"]);
  assert.throws(() => assertClassified([...entries, "ViroSpecsNewThing.ts"], manifest), /not classified in lens-runtime\.json.*ViroSpecsNewThing\.ts/s);
});

test("specs:sync refuses to run while lens/ holds an unclassified file", () => {
  // Run a copy of the package so the real lens/ is never modified.
  const copy = mkdtempSync(path.join(tmpdir(), "viro-specs-pkg-"));
  for (const item of ["lens", "scripts", "upstream", "lens-runtime.json", "package.json"]) {
    cpSync(path.join(scripts, "..", item), path.join(copy, item), { recursive: true });
  }
  writeFileSync(path.join(copy, "lens", "ViroSpecsNewThing.ts"), "export const x = 1;\n");
  const root = lensProject();
  const result = spawnSync(process.execPath, [path.join(copy, "scripts", "sync-lens-runtime.mjs"), "--project", root], { encoding: "utf8" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /ViroSpecsNewThing\.ts/);
  assert.equal(existsSync(path.join(root, "Assets", "ViroSpecs")), false, "nothing is written");
});

test("no production file imports a validation module or a validation package", () => {
  const validationPackages = manifest.validationPackages.map((item) => item.package);
  const violations = [];
  for (const name of manifest.files.production) {
    for (const specifier of importSpecifiers(source(name))) {
      const local = localModuleFile(specifier);
      if (local && !manifest.files.production.includes(local)) violations.push(`${name} -> ${specifier}`);
      const pkg = lensPackageOf(specifier);
      if (pkg && validationPackages.includes(pkg)) violations.push(`${name} -> ${specifier}`);
    }
  }
  assert.deepEqual(violations, []);
});

test("the import scan sees import, export-from, side-effect and require forms", () => {
  const sample = [
    'import { a } from "./A";',
    'import type { B } from "./B";',
    'export { C } from "./C";',
    'import "./D";',
    'const e = require("Leaf.lspkg/E");',
  ].join("\n");
  assert.deepEqual(importSpecifiers(sample).sort(), ["./A", "./B", "./C", "./D", "Leaf.lspkg/E"]);
});

test("every Lens package a file imports is declared in lens-runtime.json for its set", () => {
  const kits = Object.values(manifest.interactionKit).map((item) => item.package);
  const required = [...kits, ...manifest.requiredPackages.map((item) => item.package)];
  const validation = manifest.validationPackages.map((item) => item.package);
  const undeclared = [];
  for (const [set, allowed] of [["production", required], ["validation", [...required, ...validation]]]) {
    for (const name of manifest.files[set]) {
      for (const specifier of importSpecifiers(source(name))) {
        const pkg = lensPackageOf(specifier);
        if (pkg && !allowed.includes(pkg)) undeclared.push(`${set}: ${name} -> ${pkg}`);
      }
    }
  }
  assert.deepEqual(undeclared, []);
});

test("a default sync writes only production files; --with-validation adds a separate folder", () => {
  const root = lensProject();
  sync(root);
  const synced = readdirSync(path.join(root, "Assets", "ViroSpecs", "lens")).sort();
  assert.deepEqual(synced, [...manifest.files.production].sort());
  assert.ok(!synced.some((name) => /Leaf|Agent|Validation|PlatformLab/.test(name)), synced.join(", "));
  assert.equal(existsSync(path.join(root, "Assets", "ViroSpecsValidation")), false);
  for (const name of synced) {
    for (const specifier of importSpecifiers(readFileSync(path.join(root, "Assets", "ViroSpecs", "lens", name), "utf8"))) {
      assert.ok(!/^(Leaf|AiPreviewAgent)/.test(specifier), `${name} imports ${specifier}`);
    }
  }

  sync(root, "--with-validation");
  const validationDir = path.join(root, "Assets", "ViroSpecsValidation", "lens");
  assert.deepEqual(readdirSync(validationDir).sort(), [...manifest.files.validation].sort());
  // Production modules resolve one folder over; validation-to-validation stays local.
  for (const name of manifest.files.validation) {
    for (const specifier of importSpecifiers(readFileSync(path.join(validationDir, name), "utf8"))) {
      const local = localModuleFile(specifier);
      if (local) assert.ok(manifest.files.validation.includes(local), `${name}: ${specifier} should point at ../../ViroSpecs/lens`);
      if (specifier.startsWith("../")) {
        const target = path.resolve(validationDir, specifier + ".ts");
        assert.ok(existsSync(target), `${name}: ${specifier} does not resolve`);
        assert.equal(path.dirname(target), path.join(root, "Assets", "ViroSpecs", "lens"));
      }
    }
  }
  assert.deepEqual(readdirSync(path.join(root, "Assets", "ViroSpecs", "lens")).sort(), synced, "production folder unchanged");
});

test("--with-validation refuses while validation copies from an older sync sit in the production folder", () => {
  const root = lensProject();
  sync(root);
  const legacy = path.join(root, "Assets", "ViroSpecs", "lens", "ViroSpecsLeafIndex.ts");
  writeFileSync(legacy, source("ViroSpecsLeafIndex.ts"));
  const result = spawnSync(process.execPath, [path.join(scripts, "sync-lens-runtime.mjs"), "--project", root, "--with-validation"], { encoding: "utf8" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /ViroSpecsLeafIndex\.ts.*with its \.meta file/s);
  assert.equal(existsSync(path.join(root, "Assets", "ViroSpecsValidation")), false);
  assert.ok(existsSync(legacy), "the user's file is not touched");
});
