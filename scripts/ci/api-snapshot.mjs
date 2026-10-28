#!/usr/bin/env node
// Public API snapshots for the SPECS release packages.
//
// Emits declarations for each surface into a temporary folder, joins them in
// file-name order and compares the result with the committed snapshot under
// <package>/api/. Any change to an exported type, signature or doc comment
// fails the check until the snapshot is updated in the same commit, so an
// API change is always visible in review and can be matched to a semver bump
// and a CHANGELOG entry.
//
//   node scripts/ci/api-snapshot.mjs           # check, exit 1 on drift
//   node scripts/ci/api-snapshot.mjs --update  # rewrite the snapshots
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const update = process.argv.includes("--update");

/** Each surface: the package folder, the tsconfig whose inputs define it, and the snapshot file name. */
const SURFACES = [
  {
    label: "@viro-external/xr-contract",
    packageDir: "packages/xr-platform-contract",
    tsconfig: "tsconfig.build.json",
    snapshot: "xr-contract.api.d.ts",
  },
  {
    label: "@viro-external/specs (React Native / Node entry)",
    packageDir: "packages/specs",
    tsconfig: "tsconfig.build.json",
    snapshot: "specs.api.d.ts",
  },
  {
    label: "@viro-external/specs Lens core (lens/, portable subset)",
    packageDir: "packages/specs",
    tsconfig: "tsconfig.lens-core.json",
    snapshot: "specs-lens-core.api.d.ts",
  },
];

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function render(surface) {
  const packageDir = path.join(root, surface.packageDir);
  const out = mkdtempSync(path.join(tmpdir(), "viro-api-"));
  try {
    const tsc = path.join(packageDir, "node_modules", ".bin", "tsc");
    execFileSync(
      tsc,
      ["-p", path.join(packageDir, surface.tsconfig), "--declaration", "--emitDeclarationOnly", "--declarationMap", "false", "--sourceMap", "false", "--outDir", out],
      { cwd: packageDir, stdio: ["ignore", "pipe", "pipe"] },
    );
    const files = walk(out).filter((file) => file.endsWith(".d.ts")).sort();
    if (files.length === 0) throw new Error(`${surface.label}: tsc emitted no declarations`);
    const parts = [
      `// API snapshot for ${surface.label}.`,
      `// Regenerate with: node scripts/ci/api-snapshot.mjs --update`,
      "",
    ];
    for (const file of files) {
      const body = readFileSync(file, "utf8").replace(/\n?\/\/# sourceMappingURL=.*\n?/g, "\n").trimEnd();
      parts.push(`// ---- ${path.relative(out, file).split(path.sep).join("/")}`, body, "");
    }
    return parts.join("\n");
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
}

let drift = 0;
for (const surface of SURFACES) {
  const target = path.join(root, surface.packageDir, "api", surface.snapshot);
  const actual = render(surface);
  const rel = path.relative(root, target);
  if (update) {
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, actual);
    console.log(`wrote ${rel}`);
    continue;
  }
  const expected = existsSync(target) ? readFileSync(target, "utf8") : "";
  if (expected === actual) {
    console.log(`ok    ${rel}`);
    continue;
  }
  drift++;
  const a = expected.split("\n");
  const b = actual.split("\n");
  let line = 0;
  while (line < a.length && line < b.length && a[line] === b[line]) line++;
  console.error(`DRIFT ${rel} (first difference at line ${line + 1})`);
  console.error(`  committed: ${a[line] ?? "<end of file>"}`);
  console.error(`  current:   ${b[line] ?? "<end of file>"}`);
}
if (drift > 0) {
  console.error(`\n${drift} API snapshot(s) changed. If the change is intended, run`);
  console.error("  node scripts/ci/api-snapshot.mjs --update");
  console.error("and commit the snapshot with a CHANGELOG entry and the matching version bump (doc/Release.md).");
  process.exit(1);
}
