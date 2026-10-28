// specs:doctor reads each Lens package's version from its package.native
// descriptor and fails when a required package is missing, unreadable or
// below its minimum. specs:sync keeps user edits and .meta files; the doctor
// reports drift against the ownership ledger.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runDoctor } from "./doctor-lens-project.mjs";
import { compareSemver, parseSemver, readInstalledPackage, versionFromDescriptor } from "./lib/lens-package-version.mjs";
import { loadManifest } from "./lib/lens-runtime-manifest.mjs";
import { VALIDATED_PACKAGES, lensProject, nativePackageDescriptor } from "./support/lens-project-fixture.mjs";

const scripts = path.dirname(fileURLToPath(import.meta.url));
const manifest = loadManifest();
const doctorCli = (root, ...extra) =>
  spawnSync(process.execPath, [path.join(scripts, "doctor-lens-project.mjs"), "--project", root, ...extra], { encoding: "utf8" });
const sync = (root, ...extra) =>
  execFileSync(process.execPath, [path.join(scripts, "sync-lens-runtime.mjs"), "--project", root, ...extra], { encoding: "utf8" });
const without = (name) => Object.fromEntries(Object.entries(VALIDATED_PACKAGES).filter(([key]) => key !== name));
const withVersion = (name, version) => ({ ...VALIDATED_PACKAGES, [name]: version });

// --- version parsing -------------------------------------------------------

test("semver precedence follows semver 2.0.0, prereleases rank below releases", () => {
  const ordered = ["1.9.9", "2.0.0-alpha", "2.0.0-alpha.1", "2.0.0-beta", "2.0.0-beta.2", "2.0.0-beta.11", "2.0.0-rc.1", "2.0.0", "2.0.1", "2.1.0", "10.0.0"];
  for (let index = 1; index < ordered.length; index++) {
    assert.ok(compareSemver(ordered[index - 1], ordered[index]) < 0, `${ordered[index - 1]} < ${ordered[index]}`);
    assert.ok(compareSemver(ordered[index], ordered[index - 1]) > 0, `${ordered[index]} > ${ordered[index - 1]}`);
  }
  assert.equal(compareSemver("2.0.0+build.7", "2.0.0"), 0);
  assert.equal(parseSemver("2.0"), undefined);
  assert.equal(parseSemver("02.0.0"), undefined);
  assert.equal(parseSemver("2.0.0-beta..1"), undefined);
  assert.equal(parseSemver("2.0.0-01"), undefined);
  assert.throws(() => compareSemver("latest", "2.0.0"), /Not a semantic version: latest/);
});

test("the descriptor version comes from VersionMajor/Minor/Patch; unset (-1) fields are rejected", () => {
  assert.equal(versionFromDescriptor(nativePackageDescriptor("4.12.3")), "4.12.3");
  assert.throws(() => versionFromDescriptor(nativePackageDescriptor("-1.0.0")), /VersionMajor -1/);
  assert.throws(() => versionFromDescriptor("- !<ScriptAsset/abc>\n  VersionMajor: 1\n"), /not a NativePackageDescriptor/);
  assert.throws(() => versionFromDescriptor("- !<NativePackageDescriptor/abc>\n  VersionMajor: 1\n  VersionMinor: 0\n"), /no VersionPatch/);
  // The nested AssetLibraryDependencyStructure.Version block must not be read as the package version.
  assert.equal(versionFromDescriptor(nativePackageDescriptor("2.0.1")), "2.0.1");
  // VersionPrerelease: "" (what Lens Studio writes for a release) adds nothing; a tag is appended.
  assert.match(nativePackageDescriptor("2.0.1"), /VersionPrerelease: ""/);
  assert.equal(versionFromDescriptor(nativePackageDescriptor("2.0.0-beta.1")), "2.0.0-beta.1");
  const malformed = nativePackageDescriptor("2.0.0").replace('VersionPrerelease: ""', 'VersionPrerelease: "beta..1"');
  assert.throws(() => versionFromDescriptor(malformed), /VersionPrerelease "beta\.\.1"/);
  const legacy = nativePackageDescriptor("2.0.0").replace(/^\s*VersionPrerelease:.*\n/m, "");
  assert.equal(versionFromDescriptor(legacy), "2.0.0", "older descriptors without the field still read");
});

test("an installed package is read from a packed archive, an unpacked Assets/ folder, or reported missing/unreadable", async () => {
  const root = lensProject({ packages: { "Leaf.lspkg": "2.0.2", "Broken.lspkg": Buffer.from("not a zip") } });
  assert.deepEqual(await readInstalledPackage(root, "Leaf.lspkg"), { status: "ok", version: "2.0.2", source: "Packages/Leaf.lspkg" });
  assert.deepEqual(await readInstalledPackage(root, "Nope.lspkg"), { status: "missing" });
  const broken = await readInstalledPackage(root, "Broken.lspkg");
  assert.equal(broken.status, "unreadable");
  assert.match(broken.reason, /not a zip archive/);

  mkdirSync(path.join(root, "Assets", "SpectaclesUIKit.lspkg"));
  writeFileSync(path.join(root, "Assets", "SpectaclesUIKit.lspkg", "package.native"), nativePackageDescriptor("2.3.0"));
  assert.deepEqual(await readInstalledPackage(root, "SpectaclesUIKit.lspkg"), { status: "ok", version: "2.3.0", source: "Assets/SpectaclesUIKit.lspkg" });

  mkdirSync(path.join(root, "Assets", "Empty.lspkg"));
  const empty = await readInstalledPackage(root, "Empty.lspkg");
  assert.equal(empty.status, "unreadable");
  assert.match(empty.reason, /no package.native/);
});

// --- doctor: packages ------------------------------------------------------

test("a project with every package at its validated version passes", async () => {
  const report = await runDoctor(lensProject());
  assert.deepEqual(report.errors, []);
  const facts = Object.fromEntries(report.facts);
  assert.equal(facts["Interaction Kit"], "SpectaclesInteractionKit.lspkg 2.0.0");
  assert.equal(facts["VolumetricLine.lspkg"], "2.0.0");
  assert.equal(facts["Leaf.lspkg"], "2.0.2");
  assert.ok(report.warnings.some((warning) => /has not been synced/.test(warning)));
});

for (const requirement of manifest.requiredPackages) {
  test(`a missing ${requirement.package} is an error naming the package and its minimum`, async () => {
    const report = await runDoctor(lensProject({ packages: without(requirement.package) }));
    assert.deepEqual(report.errors, [
      `Required Lens package not found in Packages/ or Assets/: ${requirement.package} (minimum ${requirement.minVersion}).`,
    ]);
  });
}

test("a required package below its minimum is an error with both versions", async () => {
  const report = await runDoctor(lensProject({ packages: withVersion("SpectaclesUIKit.lspkg", "1.9.3") }));
  assert.deepEqual(report.errors, ["Required Lens package SpectaclesUIKit.lspkg is 1.9.3; minimum is 2.0.0. Update it from the Asset Library."]);
});

test("a prerelease of the minimum version is below the minimum", async () => {
  const report = await runDoctor(lensProject({ packages: withVersion("VolumetricLine.lspkg", "2.0.0-beta.1") }));
  assert.match(report.errors.join("\n"), /VolumetricLine\.lspkg is 2\.0\.0-beta\.1; minimum is 2\.0\.0/);
});

test("a corrupt package archive is an error, not a pass", async () => {
  const report = await runDoctor(lensProject({ packages: { ...VALIDATED_PACKAGES, "SurfacePlacement.lspkg": Buffer.alloc(0) } }));
  assert.match(report.errors.join("\n"), /SurfacePlacement\.lspkg at Packages\/SurfacePlacement\.lspkg: version unreadable \(not a zip archive/);
});

test("an Interaction Kit is required, only one line may be installed, and the 4.x line has its own minimum", async () => {
  const none = await runDoctor(lensProject({ packages: without("SpectaclesInteractionKit.lspkg") }));
  assert.deepEqual(none.errors, [
    "Required Lens package not found in Packages/ or Assets/: SpectaclesInteractionKit.lspkg (minimum 2.0.0) or InteractionKit.lspkg (minimum 4.0.0).",
  ]);

  const both = await runDoctor(lensProject({ packages: { ...VALIDATED_PACKAGES, "InteractionKit.lspkg": "4.0.0" } }));
  assert.match(both.errors.join("\n"), /Both Interaction Kit packages are installed \(SpectaclesInteractionKit\.lspkg, InteractionKit\.lspkg\)/);

  const four = { ...without("SpectaclesInteractionKit.lspkg"), "InteractionKit.lspkg": "4.0.0" };
  const ok = await runDoctor(lensProject({ packages: four }));
  assert.deepEqual(ok.errors, []);
  assert.equal(Object.fromEntries(ok.facts)["Interaction Kit"], "InteractionKit.lspkg 4.0.0");

  const old = await runDoctor(lensProject({ packages: { ...four, "InteractionKit.lspkg": "3.9.0" } }));
  assert.deepEqual(old.errors, ["Required Lens package InteractionKit.lspkg is 3.9.0; minimum is 4.0.0. Update it from the Asset Library."]);
});

test("validation packages warn when no validation scripts are synced and fail when they are, or with --with-validation", async () => {
  const packages = { ...without("Leaf.lspkg"), "AiPreviewAgentInteract.lspkg": "2.0.0" };
  const productionOnly = lensProject({ packages });
  const relaxed = await runDoctor(productionOnly);
  assert.deepEqual(relaxed.errors, []);
  assert.ok(relaxed.warnings.includes(`Validation Lens package not found in Packages/ or Assets/: Leaf.lspkg (minimum ${manifest.validationPackages.find((item) => item.package === "Leaf.lspkg").minVersion}).`));
  assert.ok(relaxed.warnings.some((warning) => /AiPreviewAgentInteract\.lspkg is 2\.0\.0; minimum is 2\.0\.1/.test(warning)));

  const strict = await runDoctor(productionOnly, { withValidation: true });
  assert.equal(strict.errors.length, 2);
  assert.match(strict.errors.join("\n"), /Validation Lens package not found.*Leaf\.lspkg/);

  const synced = lensProject({ packages });
  mkdirSync(path.join(synced, "Assets", "ViroSpecsValidation"));
  assert.equal((await runDoctor(synced)).errors.length, 2, "a validation folder in Assets/ makes them required");
});

// --- doctor: CLI -----------------------------------------------------------

test("the CLI exits 1 and prints each error; exits 0 on a clean project", () => {
  const bad = doctorCli(lensProject({ packages: without("VolumetricLine.lspkg") }));
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /Errors:\n - Required Lens package not found in Packages\/ or Assets\/: VolumetricLine\.lspkg \(minimum 2\.0\.0\)\./);
  assert.match(bad.stdout, /VolumetricLine\.lspkg: missing/);

  const good = doctorCli(lensProject());
  assert.equal(good.status, 0, good.stderr);
  assert.match(good.stdout, /Project checks passed\./);

  const usage = spawnSync(process.execPath, [path.join(scripts, "doctor-lens-project.mjs")], { encoding: "utf8" });
  assert.equal(usage.status, 1);
  assert.match(usage.stderr, /Usage: pnpm specs:doctor -- --project/);
});

// --- sync ownership and the doctor's ledger audit --------------------------

test("a resync keeps user edits and .meta files, and the doctor reports both kinds of drift", async () => {
  const root = lensProject();
  sync(root);
  const lens = path.join(root, "Assets", "ViroSpecs", "lens");
  assert.deepEqual((await runDoctor(root)).errors, []);

  const edited = path.join(lens, "ViroSpecsRuntimeHost.ts");
  const meta = edited + ".meta";
  writeFileSync(meta, "- !<AssetImportMetadata/keep-this-uuid>\n");
  writeFileSync(edited, readFileSync(edited, "utf8") + "\n// local edit\n");
  rmSync(path.join(lens, "ViroSpecsProtocol.ts"));

  const report = await runDoctor(root);
  assert.deepEqual(report.errors, [
    "Assets/ViroSpecs/lens/ViroSpecsProtocol.ts is listed in viro-specs.owned.json but missing. Run specs:sync to restore it.",
  ]);
  assert.ok(report.warnings.some((warning) => warning.startsWith("Assets/ViroSpecs/lens/ViroSpecsRuntimeHost.ts differs from what specs:sync wrote")));

  const output = sync(root);
  assert.match(output, /KEPT, edited since the last sync \(1\): lens\/ViroSpecsRuntimeHost\.ts/);
  assert.match(readFileSync(edited, "utf8"), /\/\/ local edit/);
  assert.equal(readFileSync(meta, "utf8"), "- !<AssetImportMetadata/keep-this-uuid>\n");
  assert.deepEqual((await runDoctor(root)).errors, [], "the missing file is restored");

  sync(root, "--force-overwrite", "ViroSpecs/lens/ViroSpecsRuntimeHost.ts");
  assert.doesNotMatch(readFileSync(edited, "utf8"), /\/\/ local edit/);
  assert.equal(readFileSync(meta, "utf8"), "- !<AssetImportMetadata/keep-this-uuid>\n", "forcing a file still leaves its .meta alone");
});

test("the doctor fails when the synced dependency record disagrees with the project", async () => {
  const root = lensProject();
  sync(root);
  const file = path.join(root, "Assets", "ViroSpecs", "viro-specs.dependencies.json");
  const record = JSON.parse(readFileSync(file, "utf8"));
  writeFileSync(file, JSON.stringify({ ...record, wireVersion: 0, sceneProtocols: [1], interactionKit: { line: 4, package: "InteractionKit.lspkg" } }));
  const errors = (await runDoctor(root)).errors.join("\n");
  assert.match(errors, /reads scene protocols \[1\], but this SDK emits \[1, 2\]/);
  assert.match(errors, /wire version 0; this SDK uses 1/);
  assert.match(errors, /records InteractionKit\.lspkg but the project has SpectaclesInteractionKit\.lspkg/);

  rmSync(file);
  assert.match((await runDoctor(root)).errors.join("\n"), /viro-specs\.dependencies\.json is missing/);
});

test("--before-sync checks packages but not a half-synced runtime the next sync will rewrite", async () => {
  const root = lensProject();
  mkdirSync(path.join(root, "Assets", "ViroSpecs", "lens"), { recursive: true });
  assert.match((await runDoctor(root)).errors.join("\n"), /viro-specs\.dependencies\.json is missing/);
  const before = await runDoctor(root, { beforeSync: true });
  assert.deepEqual(before.errors, []);
  assert.equal(Object.fromEntries(before.facts)["Runtime synced"], "not checked (--before-sync)");

  const missing = lensProject({ packages: without("SpecsNavigationKit.lspkg") });
  assert.match((await runDoctor(missing, { beforeSync: true })).errors.join("\n"), /SpecsNavigationKit\.lspkg \(minimum 2\.0\.0\)/);
});

test("the doctor flags a seam that imports the other Interaction Kit line", async () => {
  const root = lensProject({ packages: { ...without("SpectaclesInteractionKit.lspkg"), "InteractionKit.lspkg": "4.0.0" } });
  sync(root, "--interaction-kit", "2", "--force-overwrite", "ViroSpecs/lens/ViroSpecsInteractionKit.ts");
  const errors = (await runDoctor(root)).errors.join("\n");
  assert.match(errors, /ViroSpecsInteractionKit\.ts imports SpectaclesInteractionKit\.lspkg but the project has InteractionKit\.lspkg/);
});
