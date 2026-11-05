import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { after, describe, test } from "node:test";

import { jsonManifests, removeProjects, writeProject } from "./support/project.mjs";

after(removeProjects);

const require = createRequire(import.meta.url);
const { applySpatialShellToAndroidProject } = require("../plugin/applyToAndroidProject.js");
const { resolveSpatialShellOptions, PICO_PANEL_ACTIVITY } = require("../plugin/options.js");
const { IMMERSIVE_ACTIVITY_META, USES_METAVR_SDK } = require("../plugin/manifest.js");

function run(androidDir, overrides = {}) {
  const warnings = [];
  const promise = applySpatialShellToAndroidProject({
    platformProjectRoot: androidDir,
    packageName: "com.example.app",
    options: resolveSpatialShellOptions({ platforms: ["QUEST", "PICO"], ...overrides.options }),
    isPanelActivityLinked: overrides.isPanelActivityLinked ?? true,
    usesViro: true,
    manifests: jsonManifests,
    warn: (message) => warnings.push(message),
  });
  return promise.then((report) => ({ ...report, warnings }));
}

const readJson = (androidDir, ...parts) => JSON.parse(readFileSync(path.join(androidDir, "app", "src", ...parts), "utf8"));

describe("applySpatialShellToAndroidProject", () => {
  test("quest and pico flavors: every piece lands, and a second run writes nothing", async () => {
    const { androidDir } = writeProject();
    const first = await run(androidDir);
    assert.deepEqual(first.changed.sort(), [
      "app/build.gradle",
      "app/src/main/AndroidManifest.xml",
      "app/src/main/java/com/example/app/MainApplication.kt",
      "app/src/quest/AndroidManifest.xml",
    ]);
    assert.deepEqual(first.warnings, []);

    const quest = readJson(androidDir, "quest", "AndroidManifest.xml");
    const questPanel = quest.manifest.application[0].activity.find((a) => a.$["android:name"] === PICO_PANEL_ACTIVITY);
    assert.equal(questPanel.layout[0].$["android:defaultWidth"], "420dp");
    assert.equal(quest.manifest[USES_METAVR_SDK][0].$["metavr:targetSdkVersion"], "209");

    const pico = readJson(androidDir, "pico", "AndroidManifest.xml");
    const picoPanels = pico.manifest.application[0].activity.filter((a) => a.$["android:name"] === PICO_PANEL_ACTIVITY);
    assert.equal(picoPanels.length, 1);
    assert.equal(picoPanels[0]["meta-data"][0].$["android:value"], "core");

    const main = readJson(androidDir, "main", "AndroidManifest.xml");
    const vr = main.manifest.application[0].activity.find((a) => a.$["android:name"] === ".VRActivity");
    assert.equal(vr["meta-data"][0].$["android:name"], IMMERSIVE_ACTIVITY_META);

    const gradle = readFileSync(path.join(androidDir, "app", "build.gradle"), "utf8");
    assert.ok(gradle.indexOf("quest {") < gradle.indexOf("questImplementation"));

    const second = await run(androidDir);
    assert.deepEqual(second.changed, []);
  });

  test("pico flavor without @expo-pico/core's panel gets the shell's declaration", async () => {
    const { androidDir } = writeProject({ flavors: ["pico"], picoCorePanel: false });
    const report = await run(androidDir, { options: { platforms: ["PICO"] } });
    assert.ok(report.changed.includes("app/src/pico/AndroidManifest.xml"));
    const pico = readJson(androidDir, "pico", "AndroidManifest.xml");
    const panel = pico.manifest.application[0].activity.find((a) => a.$["android:name"] === PICO_PANEL_ACTIVITY);
    assert.equal(panel.layout[0].$["android:defaultHeight"], "600dp");
    assert.deepEqual((await run(androidDir, { options: { platforms: ["PICO"] } })).changed, []);
  });

  test("an unlinked panel activity is skipped with one warning naming the fix", async () => {
    const { androidDir } = writeProject({ flavors: ["quest"] });
    const report = await run(androidDir, { isPanelActivityLinked: false, options: { platforms: ["QUEST"] } });
    assert.equal(report.warnings.length, 1);
    assert.match(report.warnings[0], /@expo-pico\/core/);
    const quest = readJson(androidDir, "quest", "AndroidManifest.xml");
    assert.equal(quest.manifest.application[0].activity.some((a) => a.$["android:name"] === PICO_PANEL_ACTIVITY), false);
    assert.ok(quest.manifest[USES_METAVR_SDK]);
  });

  test("a QUEST build with no quest manifest warns that expo-horizon-core is missing", async () => {
    const { androidDir } = writeProject({ flavors: [] });
    const report = await run(androidDir, { options: { platforms: ["QUEST"] } });
    assert.ok(report.warnings.some((message) => /expo-horizon-core/.test(message)));
  });

  test("react-viro's SDK element still in main means no second declaration in quest", async () => {
    const { androidDir } = writeProject({ flavors: ["quest"] });
    const mainFile = path.join(androidDir, "app", "src", "main", "AndroidManifest.xml");
    const main = JSON.parse(readFileSync(mainFile, "utf8"));
    main.manifest["horizonos:uses-horizonos-sdk"] = [{ $: { "horizonos:minSdkVersion": "69" } }];
    await jsonManifests.write(mainFile, main);
    await run(androidDir, { options: { platforms: ["QUEST"] } });
    const quest = readJson(androidDir, "quest", "AndroidManifest.xml");
    assert.equal(USES_METAVR_SDK in quest.manifest, false);
  });

  test("turned-off pieces are not written", async () => {
    const { androidDir } = writeProject({ flavors: ["quest"] });
    const report = await run(androidDir, {
      options: {
        platforms: ["QUEST"],
        detailPanel: false,
        horizonSdk: false,
        immersiveActivityMarker: false,
        activityIdentityGuard: false,
      },
    });
    assert.deepEqual(report.changed, ["app/build.gradle"]);
  });
});
