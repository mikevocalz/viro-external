#!/usr/bin/env node
/**
 * The workspace overrides `@reactvision/react-viro` to a sibling checkout
 * (`link:../viro`). A linked checkout ships `.d.ts` files that `import * as React
 * from "react"`, but it has no node_modules of its own, so React resolves to
 * nothing, `React.Component` comes out empty, and every Viro component fails as a
 * JSX element with TS2786/TS2607 in every package that renders one.
 *
 * Point the checkout at an installed copy of react, react-native and
 * @types/react. Idempotent, and a no-op when the checkout brought its own deps.
 */
import { mkdir, readFile, readdir, symlink, rm, stat } from "node:fs/promises";
import { existsSync, lstatSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");
const packagesRoot = path.join(repoRoot, "packages");

const LINKED = "@reactvision/react-viro";
const REQUIRED = ["react", "react-native", "@types/react"];

/** Read the `link:` target for LINKED out of pnpm-workspace.yaml. */
async function readLinkTarget() {
  const file = path.join(repoRoot, "pnpm-workspace.yaml");
  const yaml = await readFile(file, "utf8");
  const pattern = new RegExp(
    `^\\s*["']?${LINKED.replace("/", "\\/")}["']?\\s*:\\s*["']?link:([^"'\\s]+)`,
    "m"
  );
  const match = yaml.match(pattern);
  if (!match) {
    return null;
  }
  return path.resolve(repoRoot, match[1]);
}

/** First workspace package whose node_modules holds every REQUIRED dependency. */
async function findDonor() {
  const entries = await readdir(packagesRoot, { withFileTypes: true });
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    if (!entry.isDirectory()) continue;
    const modules = path.join(packagesRoot, entry.name, "node_modules");
    if (REQUIRED.every((dep) => existsSync(path.join(modules, dep)))) {
      return modules;
    }
  }
  return null;
}

const target = await readLinkTarget();

if (!target) {
  console.log(
    `No link: override for ${LINKED} in pnpm-workspace.yaml; nothing to hydrate.`
  );
  process.exit(0);
}

if (!existsSync(target)) {
  throw new Error(
    `${LINKED} is overridden to link:${target}, but that path does not exist.\n` +
      "Clone the Viro checkout there, or drop the override."
  );
}

const targetModules = path.join(target, "node_modules");

// A checkout that installed its own dependencies resolves React on its own.
const selfInstalled = REQUIRED.every((dep) => {
  const entry = path.join(targetModules, dep);
  if (!existsSync(entry)) return false;
  // Links we wrote on an earlier run are not the checkout's own install.
  try {
    return !lstatSync(entry).isSymbolicLink();
  } catch {
    return false;
  }
});

if (selfInstalled) {
  console.log(`${target} resolves React on its own; nothing to hydrate.`);
  process.exit(0);
}

const donor = await findDonor();

if (!donor) {
  throw new Error(
    "No workspace package has react, react-native and @types/react installed.\n" +
      "Run pnpm install --strict-peer-dependencies=false first."
  );
}

await mkdir(path.join(targetModules, "@types"), { recursive: true });

for (const dep of REQUIRED) {
  const link = path.join(targetModules, dep);
  const source = path.join(donor, dep);
  await rm(link, { recursive: true, force: true });
  await symlink(source, link, "dir");
}

const donorName = path.relative(packagesRoot, path.dirname(donor));
console.log(
  `Hydrated ${path.relative(repoRoot, target)} from packages/${donorName}: ` +
    REQUIRED.join(", ") + "."
);

// Fail loudly rather than reporting success on a dangling link.
for (const dep of REQUIRED) {
  await stat(path.join(targetModules, dep));
}
