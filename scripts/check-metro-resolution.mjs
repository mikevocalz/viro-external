// Resolves the workspace's published packages the way a React Native app's
// Metro does (package exports on, "react-native" condition) and fails if any
// lands outside src/. dist/ is not committed, so a Metro app that resolved to
// it would break on a fresh clone.
import { createRequire } from "node:module";
import { existsSync, readdirSync, statSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const require = createRequire(import.meta.url);
const { resolve } = require("metro-resolver");

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
// [origin file, package] pairs. Workspace consumers resolve through their
// pnpm node_modules symlinks, exactly as Metro would in an app. specs has no
// workspace consumer, so it gets a throwaway one with a symlink.
const tmp = mkdtempSync(path.join(os.tmpdir(), "metro-consumer-"));
mkdirSync(path.join(tmp, "node_modules/@viro-external"), { recursive: true });
symlinkSync(path.join(root, "packages/specs"), path.join(tmp, "node_modules/@viro-external/specs"));
const checks = [
  [path.join(root, "packages/meta-layout/src/index.ts"), "@viro-external/xr-contract"],
  [path.join(root, "packages/pico-layout/src/index.ts"), "@viro-external/xr-contract"],
  [path.join(tmp, "index.ts"), "@viro-external/specs"],
];

const fileSystemLookup = (p) => {
  if (!existsSync(p)) return { exists: false };
  const st = statSync(p);
  return { exists: true, type: st.isDirectory() ? "d" : "f", realPath: realpathSync(p) };
};

const context = {
  allowHaste: false,
  assetExts: new Set(),
  customResolverOptions: {},
  disableHierarchicalLookup: false,
  dev: true,
  extraNodeModules: null,
  fileSystemLookup,
  doesFileExist: (p) => existsSync(p) && statSync(p).isFile(),
  getPackage: (p) => (existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : null),
  // Closest package.json at or above the candidate, stopping at node_modules,
  // as Metro's file map computes it.
  getPackageForModule: (candidate) => {
    let dir = candidate;
    while (dir !== path.dirname(dir)) {
      const pj = path.join(dir, "package.json");
      if (existsSync(pj)) {
        return {
          rootPath: dir,
          packageJson: JSON.parse(readFileSync(pj, "utf8")),
          packageRelativePath: path.relative(dir, candidate),
        };
      }
      if (path.basename(dir) === "node_modules") return null;
      dir = path.dirname(dir);
    }
    return null;
  },
  isESMImport: true,
  mainFields: ["react-native", "browser", "main"],
  nodeModulesPaths: [],
  preferNativePlatform: true,
  redirectModulePath: (p) => p,
  resolveAsset: () => null,
  resolveHasteModule: () => undefined,
  resolveHastePackage: () => undefined,
  sourceExts: ["ts", "tsx", "js", "jsx", "json"],
  unstable_conditionNames: ["require", "import", "react-native"],
  unstable_conditionsByPlatform: { web: ["browser"] },
  unstable_enablePackageExports: true,
  unstable_logWarning: (m) => console.warn(m),
};

// Package exports on (RN 0.79+ default) and off (older RN, or apps that turn
// it off, where Metro falls back to the "react-native" field, then "main").
const modes = [
  ["exports on ", { unstable_enablePackageExports: true }],
  ["exports off", { unstable_enablePackageExports: false }],
];

// Every relative specifier inside these packages' src/ must resolve too.
// Metro has no ".js" -> ".ts" substitution, so "./ui.js" in a .ts file breaks
// the bundle even when the package entry resolves.
const relativeSpecifier = /(?:\bfrom\s+|\bimport\s*\(\s*|\bimport\s+)["'](\.{1,2}\/[^"']+)["']/g;
for (const pkg of ["packages/xr-platform-contract/src", "packages/meta-layout/src"]) {
  const dir = path.join(root, pkg);
  for (const name of readdirSync(dir)) {
    if (!/\.tsx?$/.test(name)) continue;
    const file = path.join(dir, name);
    for (const m of readFileSync(file, "utf8").matchAll(relativeSpecifier)) {
      checks.push([file, m[1]]);
    }
  }
}

let failed = false;
for (const [label, overrides] of modes) {
  for (const platform of ["android", "web"]) {
    for (const [origin, name] of checks) {
      let line;
      try {
        const res = resolve({ ...context, ...overrides, originModulePath: origin }, name, platform);
        const file = res.type === "sourceFile" ? realpathSync(res.filePath) : null;
        const ok = file !== null && /\/src\//.test(file);
        line = `${ok ? "ok  " : "FAIL"} [${label} ${platform}] ${name} from ${path.basename(path.dirname(path.dirname(origin)))} -> ${file ? path.relative(root, file) : JSON.stringify(res)}`;
        if (!ok) failed = true;
      } catch (e) {
        line = `FAIL [${label} ${platform}] ${name} from ${path.relative(root, origin)}: ${e.message.split("\n")[0]}`;
        failed = true;
      }
      console.log(line);
    }
  }
}
rmSync(tmp, { recursive: true, force: true });
process.exit(failed ? 1 : 0);
