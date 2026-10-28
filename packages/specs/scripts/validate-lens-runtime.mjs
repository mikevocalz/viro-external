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
  "ViroSpecsHostDiagnostics.ts",
  "ViroSpecsSceneDocument.ts",
  "ViroSpecsSceneBackend.ts",
  "ViroSpecsResourceCache.ts",
  "ViroSpecsSceneController.ts",
  "ViroSpecsSikBinding.ts",
  "ViroSpecsLensSceneBackend.ts",
  "ViroSpecsSceneControllerHost.ts",
  "ViroSpecsInteractionKit.ts",
  "ViroSpecsActionContract.ts",
  "ViroSpecsActionRuntime.ts",
  "ViroSpecsReferenceFlow.ts",
  "ViroSpecsActionsLab.ts",
];

// Only this file may import the Interaction Kit, under either Asset Library
// name, so specs:sync can switch between 2.x and 4.0.0 by rewriting it.
const INTERACTION_KIT_SEAM = "ViroSpecsInteractionKit.ts";
const INTERACTION_KIT_PREFIXES = ["SpectaclesInteractionKit.lspkg/", "InteractionKit.lspkg/"];

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
    if (file !== INTERACTION_KIT_SEAM && INTERACTION_KIT_PREFIXES.some((prefix) => source.startsWith(prefix))) {
      violations.push(file + " -> " + source + " (import it from ./ViroSpecsInteractionKit)");
    }

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

  // Lens Studio's compiler does not narrow a `{ ok: true } | { ok: false }`
  // union through `!x.ok` or `x.ok ? a : b`, so the else side fails with TS2339
  // there while tsc accepts it. Compare against the literal instead.
  content.split("\n").forEach((line, index) => {
    if (/!\s*[\w.]+\.ok\b|\.ok\s*\?/.test(line)) {
      violations.push(file + ":" + (index + 1) + " narrows .ok by truthiness; write `.ok === false`");
    }
  });
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
