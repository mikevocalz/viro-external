#!/usr/bin/env node
// Compiles the Lens files that use no Lens Studio globals (tsconfig.lens-core.json)
// to dist/lens-core so Node tests can run the real host code against a mock
// backend. Lens Studio resolves extensionless relative imports; Node ESM does
// not, so the emitted specifiers get ".js".
import { execFileSync } from "node:child_process";
import { readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(packageRoot, "dist", "lens-core");
await rm(out, { recursive: true, force: true });
const tsc = path.join(packageRoot, "node_modules", ".bin", "tsc");
execFileSync(tsc, ["-p", path.join(packageRoot, "tsconfig.lens-core.json")], { stdio: "inherit" });
for (const file of await readdir(out)) {
  if (!file.endsWith(".js")) continue;
  const full = path.join(out, file);
  const source = await readFile(full, "utf8");
  await writeFile(full, source.replace(/(from\s+["'])(\.\/[^"']+?)(["'])/g, (_m, a, spec, b) =>
    spec.endsWith(".js") ? a + spec + b : a + spec + ".js" + b));
}
console.log("Built Lens core to", path.relative(packageRoot, out));
