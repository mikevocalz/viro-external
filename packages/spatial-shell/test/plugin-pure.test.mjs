import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { describe, test } from "node:test";

import { APP_BUILD_GRADLE, MAIN_APPLICATION_KT, mainManifest, picoManifest, questManifest } from "./support/fixtures.mjs";

const require = createRequire(import.meta.url);
const { resolveSpatialShellOptions, PICO_PANEL_ACTIVITY } = require("../plugin/options.js");
const {
  IMMERSIVE_ACTIVITY_META,
  USES_METAVR_SDK,
  applyDetailPanelActivity,
  ensureHorizonSdk,
  hasImmersiveActivity,
  markImmersiveActivity,
} = require("../plugin/manifest.js");
const { placeQuestFlavorBeforeQuestDependencies } = require("../plugin/gradle.js");
const { FLAG_NAME, injectActivityIdentityGuard } = require("../plugin/mainApplication.js");

const DEFAULTS = resolveSpatialShellOptions();
const PANEL = DEFAULTS.detailPanel;

const activityNamed = (manifest, name) =>
  manifest.manifest.application[0].activity.filter((activity) => activity.$["android:name"] === name);

describe("resolveSpatialShellOptions", () => {
  test("defaults: quest, the @expo-pico/core panel at 420x600, HzOS SDK 207/209, marker and guard on", () => {
    assert.deepEqual(DEFAULTS, {
      platforms: ["QUEST"],
      detailPanel: {
        activity: PICO_PANEL_ACTIVITY,
        defaultWidth: "420dp",
        defaultHeight: "600dp",
        widthDp: 420,
        heightDp: 600,
      },
      horizonSdk: { minSdkVersion: 207, targetSdkVersion: 209 },
      immersiveActivityMarker: true,
      activityIdentityGuard: true,
    });
  });

  test("false turns pieces off; platforms are deduplicated", () => {
    const options = resolveSpatialShellOptions({
      platforms: ["QUEST", "PICO", "QUEST"],
      detailPanel: false,
      horizonSdk: false,
      immersiveActivityMarker: false,
      activityIdentityGuard: false,
    });
    assert.deepEqual(options.platforms, ["QUEST", "PICO"]);
    assert.equal(options.detailPanel, null);
    assert.equal(options.horizonSdk, null);
    assert.equal(options.immersiveActivityMarker, false);
    assert.equal(options.activityIdentityGuard, false);
  });

  test("rejects values Meta, PICO or Gradle would reject", () => {
    assert.throws(() => resolveSpatialShellOptions({ platforms: ["AR"] }), /QUEST/);
    assert.throws(() => resolveSpatialShellOptions({ detailPanel: { defaultWidth: "420" } }), /420dp/);
    assert.throws(() => resolveSpatialShellOptions({ detailPanel: { defaultWidth: "200dp" } }), /panel range/);
    assert.throws(
      () => resolveSpatialShellOptions({ detailPanel: { defaultWidth: "600dp", defaultHeight: "600dp" } }),
      /square/
    );
    assert.throws(() => resolveSpatialShellOptions({ detailPanel: { activity: "Panel" } }), /fully qualified/);
    assert.throws(() => resolveSpatialShellOptions({ horizonSdk: { minSdkVersion: 207.5 } }), /positive integer/);
    assert.throws(
      () => resolveSpatialShellOptions({ horizonSdk: { minSdkVersion: 209, targetSdkVersion: 207 } }),
      /below/
    );
  });
});

describe("detail panel activity", () => {
  test("quest: added once with its <layout> size, and replaced on a size change", () => {
    const manifest = questManifest();
    assert.equal(applyDetailPanelActivity(manifest, PANEL, "replace"), true);
    assert.equal(applyDetailPanelActivity(manifest, PANEL, "replace"), false);
    const [panel] = activityNamed(manifest, PICO_PANEL_ACTIVITY);
    assert.deepEqual(panel.layout, [{ $: { "android:defaultWidth": "420dp", "android:defaultHeight": "600dp" } }]);
    assert.equal(panel.$["android:taskAffinity"], "${applicationId}.panel");
    assert.equal(panel.$["android:exported"], "false");

    const wider = resolveSpatialShellOptions({ detailPanel: { defaultWidth: "480dp" } }).detailPanel;
    assert.equal(applyDetailPanelActivity(manifest, wider, "replace"), true);
    const panels = activityNamed(manifest, PICO_PANEL_ACTIVITY);
    assert.equal(panels.length, 1);
    assert.equal(panels[0].layout[0].$["android:defaultWidth"], "480dp");
  });

  test("pico: @expo-pico/core's own declaration is kept untouched", () => {
    const manifest = picoManifest();
    const before = JSON.stringify(manifest);
    assert.equal(applyDetailPanelActivity(manifest, PANEL, "keep"), false);
    assert.equal(JSON.stringify(manifest), before);
  });

  test("pico: added when nothing declared it, then left alone", () => {
    const manifest = picoManifest({ withCorePanel: false });
    assert.equal(applyDetailPanelActivity(manifest, PANEL, "keep"), true);
    assert.equal(applyDetailPanelActivity(manifest, PANEL, "keep"), false);
    assert.equal(activityNamed(manifest, PICO_PANEL_ACTIVITY).length, 1);
  });

  test("never invents an <application>", () => {
    const manifest = { manifest: { $: {} } };
    assert.equal(applyDetailPanelActivity(manifest, PANEL, "replace"), false);
    assert.equal("application" in manifest.manifest, false);
  });
});

describe("immersive activity marker", () => {
  test("marks .VRActivity exactly once and clears it elsewhere", () => {
    const manifest = mainManifest();
    manifest.manifest.application[0].activity[0]["meta-data"] = [
      { $: { "android:name": IMMERSIVE_ACTIVITY_META, "android:value": "true" } },
    ];
    assert.equal(hasImmersiveActivity(manifest), true);
    assert.equal(markImmersiveActivity(manifest), true);
    assert.equal(markImmersiveActivity(manifest), false);
    const [main, vr] = manifest.manifest.application[0].activity;
    assert.equal(main["meta-data"], undefined);
    assert.deepEqual(vr["meta-data"], [{ $: { "android:name": IMMERSIVE_ACTIVITY_META, "android:value": "true" } }]);
  });

  test("a phone manifest without .VRActivity is unchanged", () => {
    const manifest = mainManifest();
    manifest.manifest.application[0].activity.pop();
    assert.equal(hasImmersiveActivity(manifest), false);
    assert.equal(markImmersiveActivity(manifest), false);
  });
});

describe("Horizon OS SDK declaration", () => {
  test("written once when absent", () => {
    const manifest = questManifest();
    assert.equal(ensureHorizonSdk(manifest, DEFAULTS.horizonSdk), true);
    assert.equal(ensureHorizonSdk(manifest, DEFAULTS.horizonSdk), false);
    assert.equal(manifest.manifest.$["xmlns:metavr"], "http://schemas.meta.com/metavr-sdk");
    assert.deepEqual(manifest.manifest[USES_METAVR_SDK], [
      { $: { "metavr:minSdkVersion": "207", "metavr:targetSdkVersion": "209" } },
    ]);
  });

  test("an expo-horizon-core declaration is left as it is", () => {
    const manifest = questManifest();
    manifest.manifest[USES_METAVR_SDK] = [{ $: { "metavr:minSdkVersion": "210" } }];
    assert.equal(ensureHorizonSdk(manifest, DEFAULTS.horizonSdk), false);
    assert.deepEqual(manifest.manifest[USES_METAVR_SDK], [{ $: { "metavr:minSdkVersion": "210" } }]);
  });
});

describe("quest flavor order", () => {
  test("moves the flavor region above the Layout SDK block, once", () => {
    const ordered = placeQuestFlavorBeforeQuestDependencies(APP_BUILD_GRADLE);
    assert.ok(ordered.indexOf("quest {") < ordered.indexOf("questImplementation"));
    assert.ok(ordered.indexOf("// expo-horizon-quest: begin quest flavor") < ordered.indexOf("// expo-horizon-quest: Meta VR Layout SDK"));
    assert.equal(placeQuestFlavorBeforeQuestDependencies(ordered), ordered);
    assert.equal(ordered.match(/quest \{/g).length, 1);
    assert.equal(ordered.match(/questImplementation/g).length, 2);
  });

  test("moves an unmarked flavor block with brace matching", () => {
    const unmarked = APP_BUILD_GRADLE.replace(/^\/\/ expo-horizon-quest: (begin|end) quest flavor\n/gm, "");
    const ordered = placeQuestFlavorBeforeQuestDependencies(unmarked);
    assert.ok(ordered.indexOf("productFlavors") < ordered.indexOf("questImplementation"));
    assert.equal(placeQuestFlavorBeforeQuestDependencies(ordered), ordered);
  });

  test("leaves a correct, quest-free or flavor-free file unchanged", () => {
    const ordered = placeQuestFlavorBeforeQuestDependencies(APP_BUILD_GRADLE);
    assert.equal(placeQuestFlavorBeforeQuestDependencies(ordered), ordered);
    const phone = 'android {\n    namespace "x"\n}\ndependencies {\n    implementation "a:b"\n}\n';
    assert.equal(placeQuestFlavorBeforeQuestDependencies(phone), phone);
    const noFlavor = 'dependencies {\n    questImplementation "a:b"\n}\n';
    assert.equal(placeQuestFlavorBeforeQuestDependencies(noFlavor), noFlavor);
  });

  test("ignores quest configurations in comments and braces in strings", () => {
    const commented = '// questImplementation "x"\nandroid {\n    productFlavors {\n        quest { dimension "device" }\n    }\n}\n';
    assert.equal(placeQuestFlavorBeforeQuestDependencies(commented), commented);
    const tricky = APP_BUILD_GRADLE.replace('"com.meta.metavrx.layout:layout-compat"', '"com.meta:x-${"}"}"');
    const ordered = placeQuestFlavorBeforeQuestDependencies(tricky);
    assert.ok(ordered.indexOf("quest {") < ordered.indexOf("questImplementation"));
  });
});

describe("activity identity guard", () => {
  test("added after loadReactNative with its imports, once", () => {
    const result = injectActivityIdentityGuard(MAIN_APPLICATION_KT);
    assert.equal(result.kind, "injected");
    const { contents } = result;
    assert.ok(contents.indexOf("loadReactNative(this)") < contents.indexOf("dangerouslyForceOverride"));
    assert.ok(contents.includes(`override fun ${FLAG_NAME}(): Boolean = true`));
    assert.ok(contents.includes("ReactNativeNewArchitectureFeatureFlagsDefaults()"));
    assert.ok(contents.indexOf("package com.example.app") < contents.indexOf("import com.facebook.react.internal.featureflags"));
    assert.deepEqual(injectActivityIdentityGuard(contents), { kind: "present" });
  });

  test("an existing guard from @expo-pico/core counts as present", () => {
    const withCore = MAIN_APPLICATION_KT.replace(
      "loadReactNative(this)\n",
      `loadReactNative(this)\n    // expo-pico-core\n    override fun ${FLAG_NAME}(): Boolean = true\n`
    );
    assert.deepEqual(injectActivityIdentityGuard(withCore), { kind: "present" });
  });

  test("reports a MainApplication without loadReactNative", () => {
    assert.deepEqual(injectActivityIdentityGuard("package x\nclass MainApplication\n"), { kind: "no-anchor" });
  });
});
