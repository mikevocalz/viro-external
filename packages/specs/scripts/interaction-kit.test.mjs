// specs:sync and specs:doctor against throwaway Lens project folders, for
// the Interaction Kit 2.x / 4.0.0 seam. Nothing here opens Lens Studio.
import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { VALIDATED_PACKAGES, lspkg } from "./support/lens-project-fixture.mjs";

const scripts = path.dirname(fileURLToPath(import.meta.url));
const lens = path.join(scripts, "..", "lens");
const SEAM = path.join(lens, "ViroSpecsInteractionKit.ts");

function project(packages, { cacheKit } = {}) {
  const root = mkdtempSync(path.join(tmpdir(), "viro-specs-kit-"));
  mkdirSync(path.join(root, "Assets"));
  mkdirSync(path.join(root, "Packages"));
  // Real archives, so the doctor's version check reads them: validated
  // versions for the 2.x set, 4.0.0 for InteractionKit.lspkg.
  const versions = { ...VALIDATED_PACKAGES, "InteractionKit.lspkg": "4.0.0" };
  for (const name of packages) writeFileSync(path.join(root, "Packages", name), lspkg(versions[name]));
  writeFileSync(path.join(root, "Lab.esproj"), "studioVersion:\n  major: 5\n  minor: 24\n  patch: 0\ntargetPlatform: Spectacles\n");
  if (cacheKit) {
    const seam = readFileSync(SEAM, "utf8");
    for (const [, specifier] of seam.matchAll(/from\s+"SpectaclesInteractionKit\.lspkg\/([^"]+)"/g)) {
      const file = path.join(root, "Cache", "TypeScript", "Src", "Packages", cacheKit, specifier + ".ts");
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
const synced = (root) => readFileSync(path.join(root, "Assets", "ViroSpecs", "lens", "ViroSpecsInteractionKit.ts"), "utf8");
const deps = (root) => JSON.parse(readFileSync(path.join(root, "Assets", "ViroSpecs", "viro-specs.dependencies.json"), "utf8"));
const rest = ["SpectaclesUIKit.lspkg", "SurfacePlacement.lspkg", "VolumetricLine.lspkg", "SpecsNavigationKit.lspkg"];

test("only the seam file imports the Interaction Kit", () => {
  for (const file of readdirSync(lens).filter((f) => f.endsWith(".ts") && f !== "ViroSpecsInteractionKit.ts")) {
    assert.doesNotMatch(readFileSync(path.join(lens, file), "utf8"), /from\s+"(Spectacles)?InteractionKit\.lspkg\//, file);
  }
});

test("2.x project: sync keeps SpectaclesInteractionKit and doctor passes", () => {
  const root = project(["SpectaclesInteractionKit.lspkg", ...rest], { cacheKit: "SpectaclesInteractionKit.lspkg" });
  sync(root);
  assert.equal(synced(root), readFileSync(SEAM, "utf8"));
  assert.deepEqual(deps(root).interactionKit, { line: 2, package: "SpectaclesInteractionKit.lspkg" });
  const result = doctor(root);
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test("4.0.0 project: sync detects InteractionKit and rewrites only the seam", () => {
  const root = project(["InteractionKit.lspkg", ...rest], { cacheKit: "InteractionKit.lspkg" });
  sync(root);
  const seam = synced(root);
  assert.doesNotMatch(seam, /"SpectaclesInteractionKit\.lspkg\//);
  assert.equal((seam.match(/from "InteractionKit\.lspkg\//g) ?? []).length, 7);
  assert.deepEqual(deps(root).interactionKit, { line: 4, package: "InteractionKit.lspkg" });
  assert.ok(deps(root).requiredPackages.includes("InteractionKit.lspkg"));
  const result = doctor(root);
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test("doctor fails on a seam that names the other kit, a missing module, or missing packages", () => {
  const mismatch = project(["InteractionKit.lspkg", ...rest], { cacheKit: "InteractionKit.lspkg" });
  sync(mismatch, "--interaction-kit", "2");
  let result = doctor(mismatch);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /imports SpectaclesInteractionKit\.lspkg but the project has InteractionKit\.lspkg/);

  const moved = project(["InteractionKit.lspkg", ...rest], { cacheKit: "InteractionKit.lspkg" });
  sync(moved);
  const gone = path.join(moved, "Cache", "TypeScript", "Src", "Packages", "InteractionKit.lspkg", "Utils", "FunctionTimingUtils.ts");
  writeFileSync(gone + ".moved", "");
  execFileSync("rm", [gone]);
  result = doctor(moved);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /has no module InteractionKit\.lspkg\/Utils\/FunctionTimingUtils/);

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
