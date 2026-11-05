import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { APP_BUILD_GRADLE, MAIN_APPLICATION_KT, mainManifest, picoManifest, questManifest } from "./fixtures.mjs";

/**
 * Manifest IO that stores the parsed manifest as JSON at the manifest's path,
 * so `applySpatialShellToAndroidProject` can run without xml2js.
 */
export const jsonManifests = {
  read: async (file) => JSON.parse(readFileSync(file, "utf8")),
  write: async (file, manifest) => writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`),
};

const created = [];

/** Deletes every project {@link writeProject} created in this process. */
export function removeProjects() {
  for (const dir of created.splice(0)) rmSync(dir, { recursive: true, force: true });
}

/**
 * Writes a prebuilt Expo project to a temp directory.
 *
 * @param {{ flavors?: string[], picoCorePanel?: boolean, serialize?: (manifest: object) => string }} [options]
 * @returns {{ projectRoot: string, androidDir: string }}
 */
export function writeProject({ flavors = ["quest", "pico"], picoCorePanel = true, serialize } = {}) {
  const projectRoot = mkdtempSync(path.join(tmpdir(), "spatial-shell-"));
  created.push(projectRoot);
  const androidDir = path.join(projectRoot, "android");
  const src = path.join(androidDir, "app", "src");
  const write = (file, contents) => {
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, contents);
  };
  const encode = serialize ?? ((manifest) => `${JSON.stringify(manifest, null, 2)}\n`);
  write(path.join(src, "main", "AndroidManifest.xml"), encode(mainManifest()));
  if (flavors.includes("quest")) write(path.join(src, "quest", "AndroidManifest.xml"), encode(questManifest()));
  if (flavors.includes("pico")) {
    write(path.join(src, "pico", "AndroidManifest.xml"), encode(picoManifest({ withCorePanel: picoCorePanel })));
  }
  write(path.join(androidDir, "app", "build.gradle"), APP_BUILD_GRADLE);
  write(path.join(src, "main", "java", "com", "example", "app", "MainApplication.kt"), MAIN_APPLICATION_KT);
  write(path.join(projectRoot, "package.json"), '{ "name": "fixture-app", "private": true }\n');
  return { projectRoot, androidDir };
}
