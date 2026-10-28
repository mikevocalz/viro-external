// Reads lens-runtime.json: which lens/ files ship to production, which are
// editor validation, and the Lens packages (with minimum versions) each set
// needs. specs:sync, specs:doctor and specs:validate-lens all read this file,
// so the lists cannot drift apart.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const lensRoot = path.join(packageRoot, "lens");
export const manifestPath = path.join(packageRoot, "lens-runtime.json");

/** Folder under the Lens project's Assets/ that receives each file set. */
export const PRODUCTION_FOLDER = "ViroSpecs";
export const VALIDATION_FOLDER = "ViroSpecsValidation";
/** Ownership ledger file name, written at the root of each synced folder. */
export const LEDGER_FILE = "viro-specs.owned.json";
export const DEPENDENCIES_FILE = "viro-specs.dependencies.json";

/**
 * @typedef {{ package: string, minVersion: string }} PackageRequirement
 * @typedef {{
 *   schemaVersion: number,
 *   wireVersion: number,
 *   sceneProtocols: number[],
 *   files: { production: string[], validation: string[], notSynced: string[] },
 *   interactionKit: Record<"2" | "4", PackageRequirement>,
 *   requiredPackages: PackageRequirement[],
 *   validationPackages: PackageRequirement[],
 * }} LensRuntimeManifest
 */

/** @returns {LensRuntimeManifest} */
export function loadManifest(file = manifestPath) {
  /** @type {LensRuntimeManifest} */
  const manifest = JSON.parse(readFileSync(file, "utf8"));
  if (manifest.schemaVersion !== 1) {
    throw new Error(`${path.basename(file)}: unsupported schemaVersion ${manifest.schemaVersion}`);
  }
  return manifest;
}

/**
 * Sorts directory entries into the manifest's sets. Anything not listed is
 * returned in `unknown`; callers must treat that as an error.
 * @param {string[]} entries file names in lens/
 * @param {LensRuntimeManifest} manifest
 */
export function classifyLensFiles(entries, manifest) {
  const sets = manifest.files;
  const listed = [...sets.production, ...sets.validation, ...sets.notSynced];
  const duplicates = listed.filter((name, index) => listed.indexOf(name) !== index);
  const present = new Set(entries);
  return {
    production: sets.production.filter((name) => present.has(name)),
    validation: sets.validation.filter((name) => present.has(name)),
    notSynced: sets.notSynced.filter((name) => present.has(name)),
    unknown: entries.filter((name) => !listed.includes(name)).sort(),
    missing: listed.filter((name) => !present.has(name)).sort(),
    duplicates: [...new Set(duplicates)].sort(),
  };
}

/** Throws unless every lens/ file is classified exactly once and exists. */
export function assertClassified(entries, manifest) {
  const result = classifyLensFiles(entries, manifest);
  const problems = [];
  if (result.unknown.length) {
    problems.push("not classified in lens-runtime.json (add each to files.production, files.validation or files.notSynced): " + result.unknown.join(", "));
  }
  if (result.missing.length) problems.push("listed in lens-runtime.json but missing from lens/: " + result.missing.join(", "));
  if (result.duplicates.length) problems.push("listed in more than one set: " + result.duplicates.join(", "));
  if (problems.length) throw new Error("Lens file classification failed:\n - " + problems.join("\n - "));
  return result;
}

/**
 * Module specifiers imported or re-exported by a TypeScript source.
 * Covers `import ... from`, `export ... from`, side-effect `import "x"` and
 * `require("x")`.
 * @param {string} source
 * @returns {string[]}
 */
export function importSpecifiers(source) {
  const found = [];
  for (const re of [/\bfrom\s+["']([^"']+)["']/g, /\bimport\s+["']([^"']+)["']/g, /\brequire\(\s*["']([^"']+)["']\s*\)/g]) {
    for (const match of source.matchAll(re)) found.push(match[1]);
  }
  return found;
}

/** `ViroSpecsFoo.ts` for a `./ViroSpecsFoo` specifier, else undefined. */
export function localModuleFile(specifier) {
  if (!specifier.startsWith("./")) return undefined;
  const base = specifier.slice(2);
  return base.endsWith(".ts") ? base : base + ".ts";
}

/** `Leaf.lspkg` for `Leaf.lspkg/Utils/common/Expect`, else undefined. */
export function lensPackageOf(specifier) {
  const head = specifier.split("/")[0];
  return head.endsWith(".lspkg") || head.endsWith(".lsc") ? head : undefined;
}
