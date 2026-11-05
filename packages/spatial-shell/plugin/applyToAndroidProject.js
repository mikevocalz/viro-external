'use strict';

const fs = require('fs');
const path = require('path');

const { placeQuestFlavorBeforeQuestDependencies } = require('./gradle');
const { injectActivityIdentityGuard } = require('./mainApplication');
const {
  applyDetailPanelActivity,
  ensureHorizonSdk,
  hasImmersiveActivity,
  markImmersiveActivity,
} = require('./manifest');

/**
 * @typedef {import('./options').ResolvedSpatialShellOptions} ResolvedSpatialShellOptions
 * @typedef {import('./manifest').ParsedManifest} ParsedManifest
 *
 * @typedef {object} ManifestIO
 * @property {(file: string) => Promise<ParsedManifest>} read
 * @property {(file: string, manifest: ParsedManifest) => Promise<void>} write
 *
 * @typedef {object} ApplyInput
 * @property {string} platformProjectRoot The `android/` directory.
 * @property {string | undefined} packageName `android.package`, to find `MainApplication.kt`.
 * @property {ResolvedSpatialShellOptions} options
 * @property {boolean} isPanelActivityLinked True when the panel activity class is on the classpath.
 * @property {boolean} usesViro True when react-viro is a config plugin.
 * @property {ManifestIO} manifests
 * @property {(message: string) => void} warn
 *
 * @typedef {object} ApplyReport
 * @property {string[]} changed Project-relative paths this run wrote.
 */

/**
 * @param {string} file
 * @param {ManifestIO} io
 * @param {(manifest: ParsedManifest) => boolean} edit
 * @returns {Promise<{ exists: boolean, changed: boolean, manifest?: ParsedManifest }>}
 */
async function editManifest(file, io, edit) {
  if (!fs.existsSync(file)) return { exists: false, changed: false };
  const manifest = await io.read(file);
  const changed = edit(manifest);
  if (changed) await io.write(file, manifest);
  return { exists: true, changed, manifest };
}

/**
 * @param {string} platformProjectRoot
 * @param {string | undefined} packageName
 * @returns {string | undefined}
 */
function findMainApplication(platformProjectRoot, packageName) {
  if (!packageName) return undefined;
  const dir = path.join(platformProjectRoot, 'app', 'src', 'main', 'java', ...packageName.split('.'));
  for (const name of ['MainApplication.kt', 'MainApplication.java']) {
    const file = path.join(dir, name);
    if (fs.existsSync(file)) return file;
  }
  return undefined;
}

/**
 * Applies the shell's native pieces to a prebuilt Android project. Runs after
 * every other mod has written its files, so it sees the final manifests and
 * Gradle script. Idempotent: a second run writes nothing.
 *
 * - quest flavor (`app/src/quest/AndroidManifest.xml`): the detail panel
 *   activity sized by `<layout>`, and `metavr:uses-metavr-sdk` when absent.
 * - pico flavor (`app/src/pico/AndroidManifest.xml`): the detail panel
 *   activity when `@expo-pico/core` did not already declare one.
 * - main manifest: the immersive-activity marker on Viro's `.VRActivity`.
 * - `app/build.gradle`: the quest flavor above the first `quest*` dependency.
 * - `MainApplication.kt`: the activity-identity guard, when the app has
 *   Viro's immersive activity.
 *
 * @param {ApplyInput} input
 * @returns {Promise<ApplyReport>}
 */
async function applySpatialShellToAndroidProject(input) {
  const { platformProjectRoot, options, manifests, warn } = input;
  const src = path.join(platformProjectRoot, 'app', 'src');
  /** @type {string[]} */
  const changed = [];
  /** @param {string} file */
  const record = (file) => changed.push(path.relative(platformProjectRoot, file));
  const panel = options.detailPanel;
  const declarePanel = panel !== null && input.isPanelActivityLinked;
  if (panel !== null && !input.isPanelActivityLinked) {
    warn(
      `The detail panel activity ${panel.activity} is not linked, so detail content opens as a pushed screen. ` +
        'Install @expo-pico/core, or set detailPanel.activity to a panel activity your app provides, or set ' +
        'detailPanel: false to silence this.'
    );
  }

  if (options.platforms.includes('QUEST')) {
    const questFile = path.join(src, 'quest', 'AndroidManifest.xml');
    const quest = await editManifest(questFile, manifests, (manifest) => {
      const panelChanged = declarePanel && panel !== null ? applyDetailPanelActivity(manifest, panel, 'replace') : false;
      const sdkChanged = options.horizonSdk === null ? false : ensureHorizonSdk(manifest, options.horizonSdk);
      return panelChanged || sdkChanged;
    });
    if (!quest.exists) {
      warn(
        'app/src/quest/AndroidManifest.xml does not exist, so the quest flavor got no detail panel or Horizon OS SDK ' +
          'declaration. Add the expo-horizon-core plugin, which owns the quest flavor.'
      );
    }
    if (quest.changed) record(questFile);
  }

  if (options.platforms.includes('PICO') && declarePanel && panel !== null) {
    const picoFile = path.join(src, 'pico', 'AndroidManifest.xml');
    const pico = await editManifest(picoFile, manifests, (manifest) => applyDetailPanelActivity(manifest, panel, 'keep'));
    if (pico.changed) record(picoFile);
  }

  const mainFile = path.join(src, 'main', 'AndroidManifest.xml');
  const main = await editManifest(mainFile, manifests, (manifest) =>
    options.immersiveActivityMarker ? markImmersiveActivity(manifest) : false
  );
  if (main.changed) record(mainFile);

  const gradleFile = path.join(platformProjectRoot, 'app', 'build.gradle');
  if (fs.existsSync(gradleFile)) {
    const gradle = fs.readFileSync(gradleFile, 'utf8');
    const ordered = placeQuestFlavorBeforeQuestDependencies(gradle);
    if (ordered !== gradle) {
      fs.writeFileSync(gradleFile, ordered);
      record(gradleFile);
    }
  }

  const hasVrActivity = main.manifest !== undefined && hasImmersiveActivity(main.manifest);
  if (options.activityIdentityGuard && (input.usesViro || hasVrActivity)) {
    const appFile = findMainApplication(platformProjectRoot, input.packageName);
    if (appFile === undefined) {
      warn('MainApplication.kt was not found, so the activity identity guard was not added. Entering XR may crash.');
    } else if (appFile.endsWith('.java')) {
      warn(
        'MainApplication.java is not supported for the activity identity guard; convert it to Kotlin or ' +
          'override skipActivityIdentityAssertionOnHostPause yourself. Entering XR may crash.'
      );
    } else {
      const result = injectActivityIdentityGuard(fs.readFileSync(appFile, 'utf8'));
      if (result.kind === 'injected') {
        fs.writeFileSync(appFile, result.contents);
        record(appFile);
      } else if (result.kind === 'no-anchor') {
        warn(
          'MainApplication.kt has no loadReactNative(this) call, so the activity identity guard was not added. ' +
            'Entering XR may crash.'
        );
      }
    }
  }

  return { changed };
}

module.exports = { applySpatialShellToAndroidProject };
