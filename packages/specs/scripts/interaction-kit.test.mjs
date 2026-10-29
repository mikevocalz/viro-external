// specs:sync and specs:doctor against throwaway Lens project folders, for
// the 2.x / 4.0.0 kit seams (Interaction Kit, UI Kit, Navigation Kit).
// Nothing here opens Lens Studio.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { VALIDATED_PACKAGES, lspkg } from "./support/lens-project-fixture.mjs";
import { kitSeams, loadManifest } from "./lib/lens-runtime-manifest.mjs";

const scripts = path.dirname(fileURLToPath(import.meta.url));
const lens = path.join(scripts, "..", "lens");

const SEAMS = kitSeams(loadManifest());

/** `cacheLine` fills Lens Studio's package cache with every module the seams import, under that line's package names. */
function project(packages, { cacheLine } = {}) {
  const root = mkdtempSync(path.join(tmpdir(), "viro-specs-kit-"));
  mkdirSync(path.join(root, "Assets"));
  mkdirSync(path.join(root, "Packages"));
  // Real archives, so the doctor's version check reads them: validated
  // versions for the 2.x set, 4.0.0 for the renamed 4.0.0 packages.
  const versions = { ...VALIDATED_PACKAGES, "InteractionKit.lspkg": "4.0.0", "UIKit.lspkg": "4.0.0", "NavigationKit.lspkg": "4.0.0" };
  for (const name of packages) writeFileSync(path.join(root, "Packages", name), lspkg(versions[name]));
  writeFileSync(path.join(root, "Lab.esproj"), "studioVersion:\n  major: 5\n  minor: 24\n  patch: 0\ntargetPlatform: Spectacles\n");
  for (const { seam, lines } of cacheLine ? SEAMS : []) {
    const source = readFileSync(path.join(lens, seam), "utf8");
    for (const [, specifier] of source.matchAll(new RegExp('from\\s+"' + lines["2"].package.replace(/\./g, "\\.") + '/([^"]+)"', "g"))) {
      const file = path.join(root, "Cache", "TypeScript", "Src", "Packages", lines[cacheLine].package, specifier + ".ts");
      mkdirSync(path.dirname(file), { recursive: true });
      writeFileSync(file, "");
    }
  }
  return root;
}

const sync = (root, ...extra) =>
  execFileSync(process.execPath, [path.join(scripts, "sync-lens-runtime.mjs"), "--project", root, ...extra], { encoding: "utf8" });
const doctor = (root) =>
  spawnSync(process.execPath, [path.join(scripts, "doctor-lens-project.mjs"), "--project", root], { encoding: "utf8" });
const synced = (root, seam = "ViroSpecsInteractionKit.ts") => readFileSync(path.join(root, "Assets", "ViroSpecs", "lens", seam), "utf8");
const deps = (root) => JSON.parse(readFileSync(path.join(root, "Assets", "ViroSpecs", "viro-specs.dependencies.json"), "utf8"));
const rest = ["SpectaclesUIKit.lspkg", "SurfacePlacement.lspkg", "VolumetricLine.lspkg", "SpecsNavigationKit.lspkg"];
const rest4 = ["UIKit.lspkg", "SurfacePlacement.lspkg", "VolumetricLine.lspkg", "NavigationKit.lspkg"];

test("only the seam files import the renamed kits", () => {
  for (const { seam, lines } of SEAMS) {
    const names = Object.values(lines).map((item) => item.package.replace(/\./g, "\\."));
    const pattern = new RegExp('from\\s+"(' + names.join("|") + ')/');
    for (const file of readdirSync(lens).filter((f) => f.endsWith(".ts") && f !== seam)) {
      assert.doesNotMatch(readFileSync(path.join(lens, file), "utf8"), pattern, file);
    }
  }
});

test("2.x project: sync keeps SpectaclesInteractionKit and doctor passes", () => {
  const root = project(["SpectaclesInteractionKit.lspkg", ...rest], { cacheLine: "2" });
  sync(root);
  for (const { seam } of SEAMS) assert.equal(synced(root, seam), readFileSync(path.join(lens, seam), "utf8"));
  assert.deepEqual(deps(root).interactionKit, { line: 2, package: "SpectaclesInteractionKit.lspkg" });
  const result = doctor(root);
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test("4.0.0 project: sync detects InteractionKit and rewrites only the seams", () => {
  const root = project(["InteractionKit.lspkg", ...rest4], { cacheLine: "4" });
  sync(root);
  const seam = synced(root);
  assert.doesNotMatch(seam, /"SpectaclesInteractionKit\.lspkg\//);
  assert.equal((seam.match(/from "InteractionKit\.lspkg\//g) ?? []).length, 7);
  assert.equal((synced(root, "ViroSpecsUIKit.ts").match(/from "UIKit\.lspkg\//g) ?? []).length, 2);
  assert.equal((synced(root, "ViroSpecsNavigationKit.ts").match(/from "NavigationKit\.lspkg\//g) ?? []).length, 2);
  // Every other synced file is byte-identical to its source.
  for (const file of readdirSync(path.join(root, "Assets", "ViroSpecs", "lens")).filter((f) => f.endsWith(".ts") && !SEAMS.some((s) => s.seam === f))) {
    assert.equal(synced(root, file), readFileSync(path.join(lens, file), "utf8"), file);
  }
  assert.deepEqual(deps(root).interactionKit, { line: 4, package: "InteractionKit.lspkg" });
  for (const name of ["InteractionKit.lspkg", "UIKit.lspkg", "NavigationKit.lspkg"]) assert.ok(deps(root).requiredPackages.includes(name), name);
  const result = doctor(root);
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test("doctor fails on a seam that names the other kit, a missing module, or missing packages", () => {
  const mismatch = project(["InteractionKit.lspkg", ...rest4], { cacheLine: "4" });
  sync(mismatch, "--interaction-kit", "2");
  let result = doctor(mismatch);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /imports SpectaclesInteractionKit\.lspkg but the project has InteractionKit\.lspkg/);

  const moved = project(["InteractionKit.lspkg", ...rest4], { cacheLine: "4" });
  sync(moved);
  const gone = path.join(moved, "Cache", "TypeScript", "Src", "Packages", "InteractionKit.lspkg", "Utils", "FunctionTimingUtils.ts");
  writeFileSync(gone + ".moved", "");
  execFileSync("rm", [gone]);
  result = doctor(moved);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /has no module InteractionKit\.lspkg\/Utils\/FunctionTimingUtils/);

  // The 4.0.0 Interaction Kit with 2.x UI Kit and Navigation Kit: those 2.x
  // packages import SpectaclesInteractionKit, which this project lacks.
  const mixed = project(["InteractionKit.lspkg", ...rest], { cacheLine: "4" });
  sync(mixed);
  result = doctor(mixed);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Required Lens package not found in Packages\/ or Assets\/: UIKit\.lspkg \(minimum 4\.0\.0\)/);
  assert.match(result.stderr, /NavigationKit\.lspkg \(minimum 4\.0\.0\)/);

  const bare = project([]);
  result = doctor(bare);
  assert.equal(result.status, 1, "missing required packages are errors, not warnings");
  assert.match(result.stderr, /SpectaclesInteractionKit\.lspkg \(minimum 2\.0\.0\) or InteractionKit\.lspkg \(minimum 4\.0\.0\)/);
  assert.match(result.stderr, /SpectaclesUIKit\.lspkg/);
});

test("sync rejects an unknown kit line", () => {
  const root = project(["SpectaclesInteractionKit.lspkg", ...rest]);
  assert.throws(() => sync(root, "--interaction-kit", "3"));
});
