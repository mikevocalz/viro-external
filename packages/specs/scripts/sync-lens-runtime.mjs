#!/usr/bin/env node
// Copies the Viro Specs Lens runtime into a Lens Studio project.
//
// Production files go to Assets/ViroSpecs/lens. Editor validation files
// (LEAF scenarios, AiPreviewAgent wiring, Platform Lab) go to
// Assets/ViroSpecsValidation/lens, and only with --with-validation.
// lens-runtime.json decides which file is which. Each folder carries an
// ownership ledger; see lib/owned-sync.mjs for the update rules.
import { existsSync, readFileSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import {
  DEPENDENCIES_FILE,
  isMainModule,
  kitSeams,
  PRODUCTION_FOLDER,
  VALIDATION_FOLDER,
  assertClassified,
  lensRoot,
  loadManifest,
  localModuleFile,
  packageRoot,
} from "./lib/lens-runtime-manifest.mjs";
import { syncOwnedFolder } from "./lib/owned-sync.mjs";

// Each renamed kit (Interaction Kit, UI Kit, Navigation Kit) is imported by
// exactly one lens/ file; switching lines rewrites those files (kitSeams).
const USAGE =
  "Usage: pnpm specs:sync -- --project /absolute/path/to/LensStudioProject [--interaction-kit 2|4] [--with-validation] [--force-overwrite <path under Assets/>]... [--adopt-existing]";

/**
 * @typedef {{
 *   project: string,
 *   interactionKit?: "2" | "4",
 *   withValidation: boolean,
 *   forceOverwrite: string[],
 *   adoptExisting: boolean,
 * }} SyncOptions
 */

/** @param {string[]} argv @returns {SyncOptions} */
export function parseSyncArgs(argv) {
  /** @type {Partial<SyncOptions> & { forceOverwrite: string[] }} */
  const options = { withValidation: false, forceOverwrite: [], adoptExisting: false };
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index];
    const value = () => {
      const next = argv[++index];
      if (next === undefined || next.startsWith("--")) throw new Error(`${arg} requires a value.\n${USAGE}`);
      return next;
    };
    if (arg === "--") continue;
    else if (arg === "--project") options.project = value();
    else if (arg === "--interaction-kit") {
      const line = value();
      if (line !== "2" && line !== "4") throw new Error("--interaction-kit must be 2 or 4, got " + line);
      options.interactionKit = line;
    } else if (arg === "--with-validation") options.withValidation = true;
    else if (arg === "--force-overwrite") options.forceOverwrite.push(value().split(path.sep).join("/").replace(/^Assets\//, ""));
    else if (arg === "--adopt-existing") options.adoptExisting = true;
    else if (arg === "--clean") {
      throw new Error(
        "--clean was removed. It deleted Assets/ViroSpecs including the Lens .meta files, which gave every script a new asset identity and broke scene references. " +
          "specs:sync now updates files in place, removes files the SDK no longer ships when they are unmodified, and keeps your edits. " +
          "Use --force-overwrite <path> to replace one edited file."
      );
    } else throw new Error(`Unknown specs:sync option ${arg}.\n${USAGE}`);
  }
  if (!options.project) throw new Error(USAGE);
  return /** @type {SyncOptions} */ (options);
}

/**
 * Rewrites `./ViroSpecsX` imports of production modules so a validation file
 * in Assets/ViroSpecsValidation/lens resolves them in Assets/ViroSpecs/lens.
 * @param {string} source
 * @param {string[]} production production file names
 */
export function pointValidationImportsAtProduction(source, production) {
  return source.replace(/(\bfrom\s+["'])(\.\/[^"']+)(["'])/g, (whole, open, specifier, close) => {
    const file = localModuleFile(specifier);
    return file && production.includes(file)
      ? open + `../../${PRODUCTION_FOLDER}/lens/` + specifier.slice(2) + close
      : whole;
  });
}

/** @param {import("./lib/owned-sync.mjs").SyncReport} report @param {string} label */
function printReport(report, label) {
  const line = (title, items) => items.length && console.log(`  ${title} (${items.length}): ${items.join(", ")}`);
  console.log(`${label}:`);
  line("written", report.written);
  line("forced", report.forced);
  line("adopted", report.adopted);
  console.log(`  unchanged: ${report.unchanged.length}`);
  line("removed (no longer shipped, unmodified)", report.removed);
  line("KEPT, edited since the last sync", report.keptModified);
  line("KEPT, not in the ownership ledger", report.keptUnowned);
  line("KEPT, no longer shipped but edited", report.keptStaleModified);
}

/** @param {SyncOptions} options */
export async function syncLensRuntime(options) {
  const project = path.resolve(options.project);
  const assets = path.join(project, "Assets");
  if (!existsSync(project)) throw new Error("Lens Studio project does not exist: " + project);
  if (!existsSync(assets)) throw new Error("Expected Lens Studio Assets directory at: " + assets);

  const manifest = loadManifest();
  const sdkVersion = JSON.parse(readFileSync(path.join(packageRoot, "package.json"), "utf8")).version;
  const files = assertClassified(await readdir(lensRoot), manifest);
  const productionRoot = path.join(assets, PRODUCTION_FOLDER);
  const validationRoot = path.join(assets, VALIDATION_FOLDER);

  // Validation copies left in the production folder by older syncs would
  // define the same @component classes twice once the validation folder exists.
  const legacyValidation = files.validation.filter((name) => existsSync(path.join(productionRoot, "lens", name)));
  if (options.withValidation && legacyValidation.length) {
    throw new Error(
      "These validation scripts are still in Assets/ViroSpecs/lens from an older specs:sync: " + legacyValidation.join(", ") +
        ". Move each one, with its .meta file, to Assets/ViroSpecsValidation/lens (keeps scene references) or out of Assets/, then rerun with --with-validation."
    );
  }

  // Kit line: explicit flag, else what the project has installed, else 2.x.
  const packagesDir = path.join(project, "Packages");
  const installed = existsSync(packagesDir) ? await readdir(packagesDir) : [];
  /** @type {"2" | "4"} */
  let kitLine = "2";
  if (options.interactionKit) kitLine = options.interactionKit;
  else if (installed.includes(manifest.interactionKit["4"].package) && !installed.includes(manifest.interactionKit["2"].package)) kitLine = "4";
  const kitPackage = manifest.interactionKit[kitLine].package;
  const seams = kitSeams(manifest);
  const linePackages = seams.map(({ lines }) => lines[kitLine]);

  /** @type {Map<string, string>} */
  const production = new Map();
  for (const name of files.production) {
    let source = await readFile(path.join(lensRoot, name), "utf8");
    const seam = seams.find((item) => item.seam === name);
    if (seam && kitLine !== "2") source = source.split('"' + seam.lines["2"].package + "/").join('"' + seam.lines[kitLine].package + "/");
    production.set("lens/" + name, source);
  }

  const upstream = JSON.parse(await readFile(path.join(packageRoot, "upstream", "specs-27.json"), "utf8"));
  const dependencies = {
    schemaVersion: 1,
    generatedBy: "@viro-external/specs",
    sdkVersion,
    wireVersion: manifest.wireVersion,
    sceneProtocols: manifest.sceneProtocols,
    interactionKit: { line: Number(kitLine), package: kitPackage },
    target: upstream.source.target,
    lensStudio: upstream.source.lensStudio,
    upstream: { repository: upstream.source.repository, commit: upstream.source.commit },
    requiredPackages: [...linePackages, ...manifest.requiredPackages].map((item) => item.package),
    packageRequirements: [...linePackages, ...manifest.requiredPackages],
    editorValidationPackages: manifest.validationPackages.map((item) => item.package),
    notes: [
      "Install required .lspkg dependencies through the Lens Studio Asset Library before preview or device builds. specs:doctor checks the installed versions.",
      "Editor validation scripts sync to Assets/ViroSpecsValidation only with --with-validation; they need the editorValidationPackages.",
    ],
  };
  production.set(DEPENDENCIES_FILE, JSON.stringify(dependencies, null, 2) + "\n");

  /** @type {Map<string, string>} */
  const validation = new Map();
  if (options.withValidation) {
    for (const name of files.validation) {
      const source = await readFile(path.join(lensRoot, name), "utf8");
      validation.set("lens/" + name, pointValidationImportsAtProduction(source, files.production));
    }
  }

  // Resolve --force-overwrite paths before writing anything.
  /** @type {Record<string, Set<string>>} */
  const forced = { [PRODUCTION_FOLDER]: new Set(), [VALIDATION_FOLDER]: new Set() };
  for (const requested of options.forceOverwrite) {
    const [folder, ...rest] = requested.split("/");
    const relative = rest.join("/");
    const target = folder === PRODUCTION_FOLDER ? production : folder === VALIDATION_FOLDER ? validation : undefined;
    if (!target?.has(relative)) {
      throw new Error(`--force-overwrite ${requested} is not a file this sync writes. Use a path under Assets/, for example ${PRODUCTION_FOLDER}/lens/ViroSpecsRuntimeHost.ts.`);
    }
    forced[folder].add(relative);
  }

  const reports = {
    production: await syncOwnedFolder({ root: productionRoot, desired: production, sdkVersion, profile: "production", forceOverwrite: forced[PRODUCTION_FOLDER], adoptExisting: options.adoptExisting }),
    validation: options.withValidation
      ? await syncOwnedFolder({ root: validationRoot, desired: validation, sdkVersion, profile: "validation", forceOverwrite: forced[VALIDATION_FOLDER], adoptExisting: options.adoptExisting })
      : undefined,
  };
  return { project, kitLine, kitPackage, upstream, legacyValidation, reports };
}

/** @param {string[]} argv */
export async function main(argv = process.argv.slice(2)) {
  const options = parseSyncArgs(argv);
  const result = await syncLensRuntime(options);
  console.log("Synced Viro Specs Lens runtime to:", path.join(result.project, "Assets", PRODUCTION_FOLDER));
  printReport(result.reports.production, "Assets/" + PRODUCTION_FOLDER);
  if (result.reports.validation) printReport(result.reports.validation, "Assets/" + VALIDATION_FOLDER);
  console.log("");
  console.log("Pinned upstream:", result.upstream.source.repository, result.upstream.source.commit);
  console.log("Target:", result.upstream.source.target, "Lens Studio", result.upstream.source.lensStudio);
  console.log("Interaction Kit:", result.kitPackage, "(line " + result.kitLine + (options.interactionKit ? ", from --interaction-kit" : ", detected") + ")");
  if (result.legacyValidation.length) {
    console.warn(
      "\nWarning: validation scripts from an older sync are still in Assets/ViroSpecs/lens: " + result.legacyValidation.join(", ") +
        ". Production code does not need them. Move them, with their .meta files, out of that folder."
    );
  }
  const kept = [result.reports.production, result.reports.validation].filter((report) => report !== undefined);
  if (kept.some((report) => report.keptUnowned.length)) {
    console.warn("\nWarning: files listed as not in the ownership ledger were kept as they are. If this project was synced before the ledger existed and you never edited them, rerun with --adopt-existing.");
  }
  if (kept.some((report) => report.keptModified.length)) {
    console.warn("\nWarning: edited files were kept. Rerun with --force-overwrite <path under Assets/> to replace one.");
  }
}

if (isMainModule(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
