/**
 * The config plugin end to end on a prebuilt project with real AndroidManifest
 * XML, and the doctor before and after it ran.
 */
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { after, describe, test } from "node:test";

import { runDoctor } from "../scripts/doctor.mjs";
import { mainManifest, picoManifest, questManifest } from "./support/fixtures.mjs";
import { removeProjects, writeProject } from "./support/project.mjs";

after(removeProjects);

const require = createRequire(import.meta.url);
const { AndroidConfig } = require("@expo/config-plugins");
const withSpatialShell = require("../app.plugin.js");

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function writeXmlProject({ flavors = ["quest", "pico"] } = {}) {
  const { projectRoot, androidDir } = writeProject({ flavors });
  installPicoCore(projectRoot);
  const src = path.join(androidDir, "app", "src");
  const manifests = { main: mainManifest(), quest: questManifest(), pico: picoManifest() };
  for (const [flavor, manifest] of Object.entries(manifests)) {
    if (flavor !== "main" && !flavors.includes(flavor)) continue;
    await AndroidConfig.Manifest.writeAndroidManifestAsync(path.join(src, flavor, "AndroidManifest.xml"), manifest);
  }
  return { projectRoot, androidDir };
}

function installShell(projectRoot) {
  const scope = path.join(projectRoot, "node_modules", "@viro-external");
  mkdirSync(scope, { recursive: true });
  symlinkSync(PACKAGE_ROOT, path.join(scope, "spatial-shell"), "dir");
}

/** A stand-in for @expo-pico/core, which owns the default panel activity. */
function installPicoCore(projectRoot) {
  const dir = path.join(projectRoot, "node_modules", "@expo-pico", "core");
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, "package.json"), '{ "name": "@expo-pico/core", "version": "0.0.0" }\n');
}

function writeSource(projectRoot, file, contents) {
  const full = path.join(projectRoot, file);
  mkdirSync(path.dirname(full), { recursive: true });
  writeFileSync(full, contents);
}

const SHELL_LAYOUT = 'import { SpatialShell } from "@viro-external/spatial-shell";\nexport default function Layout() { return null; }\n';

async function runPlugin(projectRoot, androidDir, options) {
  const config = withSpatialShell(
    {
      name: "fixture",
      slug: "fixture",
      android: { package: "com.example.app" },
      plugins: [["@reactvision/react-viro", { android: { xRMode: ["QUEST", "PICO"] } }]],
      _internal: { projectRoot },
    },
    options
  );
  const finalized = config.mods?.android?.finalized;
  assert.equal(typeof finalized, "function", "the plugin registers an android finalized mod");
  await finalized({
    ...config,
    modResults: undefined,
    modRequest: { platform: "android", platformProjectRoot: androidDir, projectRoot, modName: "finalized" },
  });
}

const failed = (checks) => checks.filter((check) => check.status === "fail").map((check) => check.name);

describe("withSpatialShell on a prebuilt project", () => {
  test("writes the quest panel, SDK, marker, order and guard as XML; a second run changes nothing", async () => {
    const { projectRoot, androidDir } = await writeXmlProject();
    await runPlugin(projectRoot, androidDir, { platforms: ["QUEST", "PICO"] });

    const read = (...parts) => readFileSync(path.join(androidDir, ...parts), "utf8");
    const quest = read("app", "src", "quest", "AndroidManifest.xml");
    assert.match(quest, /<activity android:name="expo\.modules\.pico\.PicoPanelActivity"[^>]*>\s*<layout android:defaultWidth="420dp" android:defaultHeight="600dp"\/>/);
    assert.match(quest, /xmlns:metavr="http:\/\/schemas\.meta\.com\/metavr-sdk"/);
    assert.match(quest, /<metavr:uses-metavr-sdk metavr:minSdkVersion="207" metavr:targetSdkVersion="209"\/>/);
    assert.match(read("app", "src", "main", "AndroidManifest.xml"), /<activity android:name="\.VRActivity"[^>]*>\s*<meta-data android:name="expo\.modules\.pico\.IMMERSIVE_ACTIVITY" android:value="true"\/>/);
    const gradle = read("app", "build.gradle");
    assert.ok(gradle.indexOf("quest {") < gradle.indexOf("questImplementation"));
    assert.match(read("app", "src", "main", "java", "com", "example", "app", "MainApplication.kt"), /skipActivityIdentityAssertionOnHostPause\(\): Boolean = true/);

    const snapshot = ["app/src/quest/AndroidManifest.xml", "app/src/pico/AndroidManifest.xml", "app/src/main/AndroidManifest.xml", "app/build.gradle", "app/src/main/java/com/example/app/MainApplication.kt"].map((file) => read(file));
    await runPlugin(projectRoot, androidDir, { platforms: ["QUEST", "PICO"] });
    assert.deepEqual(
      ["app/src/quest/AndroidManifest.xml", "app/src/pico/AndroidManifest.xml", "app/src/main/AndroidManifest.xml", "app/build.gradle", "app/src/main/java/com/example/app/MainApplication.kt"].map((file) => read(file)),
      snapshot
    );
  });
});

describe("viro-spatial-shell-doctor", () => {
  test("a headset project fails before the plugin ran and passes after", async () => {
    const { projectRoot, androidDir } = await writeXmlProject({ flavors: ["quest"] });
    installShell(projectRoot);
    writeSource(projectRoot, "app/_layout.tsx", SHELL_LAYOUT);

    const before = await runDoctor(projectRoot, { allowTabNavigator: false });
    assert.deepEqual(failed(before).sort(), [
      "Horizon OS SDK",
      "activity identity guard",
      "immersive activity marker",
      "quest flavor order",
    ]);

    await runPlugin(projectRoot, androidDir, { platforms: ["QUEST"] });
    const after = await runDoctor(projectRoot, { allowTabNavigator: false });
    assert.deepEqual(failed(after), []);
    assert.equal(after.find((check) => check.name === "detail panel (quest)")?.status, "pass");
  });

  test("a headset project with no <SpatialShell>, a bottom tab navigator, or no shell package fails", async () => {
    const { projectRoot, androidDir } = await writeXmlProject({ flavors: ["quest"] });
    await runPlugin(projectRoot, androidDir, { platforms: ["QUEST"] });
    writeSource(projectRoot, "app/_layout.tsx", 'import { Tabs } from "expo-router";\nexport default Tabs;\n');
    const checks = await runDoctor(projectRoot, { allowTabNavigator: false });
    assert.deepEqual(failed(checks).sort(), ["no bottom tab navigator", "rail rendered", "shell installed"]);
    const allowed = await runDoctor(projectRoot, { allowTabNavigator: true });
    assert.equal(allowed.find((check) => check.name === "no bottom tab navigator")?.status, "warn");
  });

  test("a phone-only project passes without the shell", async () => {
    const { projectRoot, androidDir } = writeProject({ flavors: [] });
    const main = mainManifest();
    main.manifest.application[0].activity.pop();
    await AndroidConfig.Manifest.writeAndroidManifestAsync(path.join(androidDir, "app", "src", "main", "AndroidManifest.xml"), main);
    const checks = await runDoctor(projectRoot, { allowTabNavigator: false });
    assert.deepEqual(failed(checks), []);
    assert.match(checks.find((check) => check.name === "headset build")?.detail ?? "", /phone-only/);
  });

  test("a project that was never prebuilt fails with a prebuild hint", async () => {
    const checks = await runDoctor(path.join(PACKAGE_ROOT, "doc"), { allowTabNavigator: false });
    assert.deepEqual(failed(checks), ["android project"]);
  });
});
