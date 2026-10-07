#!/usr/bin/env node
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(here, "..");
const lensRoot = path.join(packageRoot, "lens");

const requiredFiles = [
  "ViroSpecsProtocol.ts",
  "ViroSpecsAssetRegistry.ts",
  "ViroSpecsSceneRuntime.ts",
  "ViroSpecsRuntimeHost.ts",
  "ViroSpecsAnimationRuntime.ts",
  "ViroSpecsAnimationHost.ts",
  "ViroSpecsInteractionRuntime.ts",
  "ViroSpecsInteractionHost.ts",
  "ViroSpecsWorldRuntime.ts",
  "ViroSpecsCapabilities.ts",
  "ViroSpecsLensTransport.ts",
  "ViroSpecsNavigationRuntime.ts",
  "ViroSpecsNavigationHost.ts",
  "ViroSpecsPlatformLab.ts",
  "ViroSpecsAgentValidation.ts",
  "ViroSpecsLeafSceneSmokeScenario.ts",
  "ViroSpecsLeafInteractionScenario.ts",
  "ViroSpecsLeafIndex.ts",
];

const forbiddenImports = [
  "@viro-external/",
  "react",
  "react-native",
  "../src/",
];

const entries = await readdir(lensRoot);
const tsFiles = entries.filter((entry) => entry.endsWith(".ts"));
const missing = requiredFiles.filter((file) => !entries.includes(file));

if (missing.length > 0) {
  throw new Error(
    "Missing Lens runtime files: " + missing.join(", ")
  );
}

const violations = [];

for (const file of tsFiles) {
  const content = await readFile(path.join(lensRoot, file), "utf8");
  const imports = [...content.matchAll(/from\s+["']([^"']+)["']/g)].map(
    (match) => match[1]
  );

  for (const source of imports) {
    if (forbiddenImports.some((forbidden) => source.startsWith(forbidden))) {
      violations.push(file + " -> " + source);
    }

    if (source.startsWith("./")) {
      const target = path.basename(source) + ".ts";
      if (!entries.includes(target)) {
        violations.push(file + " -> missing local module " + target);
      }
    }
  }
}

if (violations.length > 0) {
  throw new Error(
    "Lens runtime validation failed:\n" + violations.map((v) => " - " + v).join("\n")
  );
}

console.log(
  "Lens runtime validation passed:",
  tsFiles.length,
  "TypeScript files; no workspace/runtime-forbidden imports."
);
