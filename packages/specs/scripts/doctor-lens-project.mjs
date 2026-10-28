#!/usr/bin/env node
// Checks a Lens Studio project before Viro Specs preview or device builds.
// Errors exit 1; warnings do not. Package minimum versions come from
// lens-runtime.json; installed versions are read from each package's
// package.native descriptor (see lib/lens-package-version.mjs).
import { existsSync } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import {
  DEPENDENCIES_FILE,
  isMainModule,
  LEDGER_FILE,
  PRODUCTION_FOLDER,
  VALIDATION_FOLDER,
  loadManifest,
  packageRoot,
} from "./lib/lens-runtime-manifest.mjs";
import { compareSemver, readInstalledPackage } from "./lib/lens-package-version.mjs";
import { auditOwnedFolder } from "./lib/owned-sync.mjs";

/**
 * @typedef {{ errors: string[], warnings: string[], facts: [string, string][] }} DoctorReport
 */

/**
 * Checks one package against its minimum version.
 * @param {string} project
 * @param {{ package: string, minVersion: string }} requirement
 * @param {string[]} problems where a failure is recorded
 * @param {string} kind "Required" or "Validation"
 * @returns {Promise<string>} the version, or a status word for the summary
 */
async function checkPackage(project, requirement, problems, kind) {
  const found = await readInstalledPackage(project, requirement.package);
  if (found.status === "missing") {
    problems.push(`${kind} Lens package not found in Packages/ or Assets/: ${requirement.package} (minimum ${requirement.minVersion}).`);
    return "missing";
  }
  if (found.status === "unreadable") {
    problems.push(`${kind} Lens package ${requirement.package} at ${found.source}: version unreadable (${found.reason}). Reinstall it from the Asset Library.`);
    return "unreadable";
  }
  if (compareSemver(found.version, requirement.minVersion) < 0) {
    problems.push(`${kind} Lens package ${requirement.package} is ${found.version}; minimum is ${requirement.minVersion}. Update it from the Asset Library.`);
  }
  return found.version;
}

/**
 * @param {string} projectArg
 * @param {{ withValidation?: boolean, beforeSync?: boolean }} [options]
 *   withValidation: treat the validation packages as required even before
 *   validation files are synced. beforeSync: check the project and its
 *   packages only, and skip the synced runtime (ledger, dependency record,
 *   Interaction Kit seam), which the sync that follows rewrites.
 *   specs:bootstrap passes both before `specs:sync --with-validation`, then
 *   runs the full doctor.
 * @returns {Promise<DoctorReport>}
 */
export async function runDoctor(projectArg, { withValidation = false, beforeSync = false } = {}) {
  const manifest = loadManifest();
  const sdkVersion = JSON.parse(await readFile(path.join(packageRoot, "package.json"), "utf8")).version;
  const project = path.resolve(projectArg);
  const assets = path.join(project, "Assets");
  if (!existsSync(project) || !(await stat(project)).isDirectory()) throw new Error("Lens Studio project folder does not exist: " + project);
  if (!existsSync(assets)) throw new Error("Lens Studio Assets directory is missing: " + assets);

  const esprojFiles = (await readdir(project)).filter((name) => name.endsWith(".esproj"));
  if (esprojFiles.length !== 1) throw new Error("Expected exactly one .esproj file in project root; found " + esprojFiles.length);
  const esproj = await readFile(path.join(project, esprojFiles[0]), "utf8");

  /** @type {DoctorReport} */
  const report = { errors: [], warnings: [], facts: [] };
  const { errors, warnings, facts } = report;

  const versionBlock = esproj.match(/studioVersion:\s*\n([\s\S]*?)(?=\n\S|$)/)?.[1] ?? "";
  const studio = ["major", "minor", "patch"].map((key) => Number(versionBlock.match(new RegExp(key + ":\\s*(\\d+)"))?.[1] ?? 0));
  const target = esproj.match(/^targetPlatform:\s*(\S+)/m)?.[1] ?? "unknown";
  facts.push(["Project file", esprojFiles[0]], ["Lens Studio", studio.join(".")], ["Target", target]);
  if (target !== "Spectacles") errors.push("Project targetPlatform is " + target + "; expected Spectacles/SPECS.");
  if (compareSemver(studio.join("."), "5.22.0") < 0) errors.push("Lens Studio project version is " + studio.join(".") + "; SPECS 27 runtime requires 5.22.0+.");

  // Interaction Kit: exactly one line installed, at or above its minimum.
  const kitLines = /** @type {const} */ (["2", "4"]);
  const kits = [];
  for (const line of kitLines) {
    const found = await readInstalledPackage(project, manifest.interactionKit[line].package);
    if (found.status !== "missing") kits.push(line);
  }
  if (kits.length === 0) {
    const [two, four] = [manifest.interactionKit["2"], manifest.interactionKit["4"]];
    errors.push(`Required Lens package not found in Packages/ or Assets/: ${two.package} (minimum ${two.minVersion}) or ${four.package} (minimum ${four.minVersion}).`);
  } else if (kits.length > 1) {
    errors.push("Both Interaction Kit packages are installed (" + kits.map((line) => manifest.interactionKit[line].package).join(", ") + "); keep one line.");
  }
  const kitPackage = kits.length === 1 ? manifest.interactionKit[kits[0]].package : undefined;
  if (kits.length === 1) {
    facts.push(["Interaction Kit", kitPackage + " " + (await checkPackage(project, manifest.interactionKit[kits[0]], errors, "Required"))]);
  } else {
    facts.push(["Interaction Kit", kits.length ? "conflict" : "missing"]);
  }
  for (const requirement of manifest.requiredPackages) {
    facts.push([requirement.package, await checkPackage(project, requirement, errors, "Required")]);
  }

  const productionRoot = path.join(assets, PRODUCTION_FOLDER);
  const productionLens = path.join(productionRoot, "lens");
  const validationRoot = path.join(assets, VALIDATION_FOLDER);
  const legacyValidation = manifest.files.validation.filter((name) => existsSync(path.join(productionLens, name)));
  const validationInUse = withValidation || existsSync(validationRoot) || legacyValidation.length > 0;

  // Validation packages only matter when validation scripts are in Assets/
  // (or about to be); then a missing one fails the Lens compile, so it is an
  // error. Otherwise it is a warning.
  for (const requirement of manifest.validationPackages) {
    facts.push([requirement.package, await checkPackage(project, requirement, validationInUse ? errors : warnings, "Validation")]);
  }
  if (legacyValidation.length) {
    warnings.push("Validation scripts from an older specs:sync are in Assets/ViroSpecs/lens: " + legacyValidation.join(", ") +
      ". Move them, with their .meta files, to Assets/ViroSpecsValidation/lens or out of Assets/.");
  }

  // The seam must name the installed kit, and every module it imports must
  // exist in Lens Studio's package cache (present once the project was opened).
  if (beforeSync) {
    facts.push(["Runtime synced", "not checked (--before-sync)"]);
    return report;
  }

  const seamFile = path.join(productionLens, "ViroSpecsInteractionKit.ts");
  if (kitPackage && existsSync(seamFile)) {
    const seam = await readFile(seamFile, "utf8");
    const specifiers = [...seam.matchAll(/from\s+"([^"]+)"/g)].map((m) => m[1]);
    const wrong = specifiers.filter((s) => !s.startsWith(kitPackage + "/"));
    if (wrong.length) {
      errors.push("ViroSpecsInteractionKit.ts imports " + wrong[0].split("/")[0] + " but the project has " + kitPackage +
        ". Re-run specs:sync (it detects the kit) or pass --interaction-kit " + (kitPackage === manifest.interactionKit["4"].package ? "4" : "2") + ".");
    }
    const cache = path.join(project, "Cache", "TypeScript", "Src", "Packages");
    if (existsSync(path.join(cache, kitPackage))) {
      for (const specifier of specifiers.filter((s) => s.startsWith(kitPackage + "/"))) {
        if (!existsSync(path.join(cache, specifier + ".ts"))) {
          errors.push("Installed " + kitPackage + " has no module " + specifier + " (imported by ViroSpecsInteractionKit.ts).");
        }
      }
    } else {
      warnings.push("Interaction Kit module paths not verified: open the project in Lens Studio once so Cache/TypeScript/Src/Packages exists.");
    }
  }

  // Synced runtime against its ownership ledger and dependency record.
  if (!existsSync(productionLens)) {
    warnings.push("Viro Specs runtime has not been synced to Assets/ViroSpecs/lens.");
    facts.push(["Runtime synced", "no"]);
  } else {
    facts.push(["Runtime synced", "yes"]);
    for (const [label, root] of [["Assets/" + PRODUCTION_FOLDER, productionRoot], ["Assets/" + VALIDATION_FOLDER, validationRoot]]) {
      if (!existsSync(root)) continue;
      let audit;
      try {
        audit = await auditOwnedFolder(root);
      } catch (error) {
        errors.push(error instanceof Error ? error.message : String(error));
        continue;
      }
      if (!audit.ledger) {
        warnings.push(`${label} has no ${LEDGER_FILE}; it was synced by an older specs:sync. Run specs:sync (add --adopt-existing if you never edited those files).`);
        continue;
      }
      for (const file of audit.missing) errors.push(`${label}/${file} is listed in ${LEDGER_FILE} but missing. Run specs:sync to restore it.`);
      for (const file of audit.modified) warnings.push(`${label}/${file} differs from what specs:sync wrote (local edit). specs:sync keeps it; --force-overwrite ${label.slice(7)}/${file} replaces it.`);
      if (audit.ledger.sdkVersion !== sdkVersion) {
        warnings.push(`${label} was synced by @viro-external/specs ${audit.ledger.sdkVersion}; this checkout is ${sdkVersion}. Run specs:sync.`);
      }
    }

    const dependenciesFile = path.join(productionRoot, DEPENDENCIES_FILE);
    if (!existsSync(dependenciesFile)) {
      errors.push(`Assets/${PRODUCTION_FOLDER}/${DEPENDENCIES_FILE} is missing. Run specs:sync.`);
    } else {
      let dependencies;
      try {
        dependencies = JSON.parse(await readFile(dependenciesFile, "utf8"));
      } catch {
        errors.push(`Assets/${PRODUCTION_FOLDER}/${DEPENDENCIES_FILE} is not valid JSON. Run specs:sync.`);
      }
      if (dependencies) {
        const protocols = Array.isArray(dependencies.sceneProtocols) ? dependencies.sceneProtocols : [];
        const absent = manifest.sceneProtocols.filter((protocol) => !protocols.includes(protocol));
        facts.push(["Scene protocols", protocols.join(", ") || "none"]);
        if (absent.length) {
          errors.push(`The synced runtime reads scene protocols [${protocols.join(", ")}], but this SDK emits [${manifest.sceneProtocols.join(", ")}]. Run specs:sync.`);
        }
        if (dependencies.wireVersion !== manifest.wireVersion) {
          errors.push(`The synced runtime uses wire version ${dependencies.wireVersion}; this SDK uses ${manifest.wireVersion}. Run specs:sync.`);
        }
        if (kitPackage && dependencies.interactionKit?.package !== kitPackage) {
          errors.push(`${DEPENDENCIES_FILE} records ${dependencies.interactionKit?.package ?? "no Interaction Kit"} but the project has ${kitPackage}. Run specs:sync.`);
        }
      }
    }
  }
  return report;
}

/** @param {string[]} argv */
export async function main(argv = process.argv.slice(2)) {
  const index = argv.indexOf("--project");
  const projectArg = index >= 0 ? argv[index + 1] : undefined;
  if (!projectArg || projectArg.startsWith("--")) {
    throw new Error("Usage: pnpm specs:doctor -- --project /absolute/path/to/LensStudioProject [--with-validation] [--before-sync]");
  }
  const { errors, warnings, facts } = await runDoctor(projectArg, {
    withValidation: argv.includes("--with-validation"),
    beforeSync: argv.includes("--before-sync"),
  });
  console.log("Viro Specs Lens project doctor");
  console.log("------------------------------");
  console.log("Project:", path.resolve(projectArg));
  for (const [label, value] of facts) console.log(label + ":", value);
  if (warnings.length) {
    console.log("\nWarnings:");
    for (const warning of warnings) console.log(" -", warning);
  }
  if (errors.length) {
    console.error("\nErrors:");
    for (const error of errors) console.error(" -", error);
    process.exitCode = 1;
  } else {
    console.log("\nProject checks passed.");
  }
}

if (isMainModule(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
