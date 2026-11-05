'use strict';

const { AndroidConfig, WarningAggregator } = require('@expo/config-plugins');

const { applySpatialShellToAndroidProject } = require('./applyToAndroidProject');
const { PICO_PANEL_ACTIVITY, resolveSpatialShellOptions } = require('./options');
const { usesViroVrActivity } = require('./viroDetection');

// withFinalizedMod runs after every other mod, dangerous mods included, so the
// edits see the manifests expo-horizon-core and @expo-pico/core wrote. Deep
// import: some @expo/config-plugins releases do not re-export it.
const { withFinalizedMod } = require('@expo/config-plugins/build/plugins/withFinalizedMod');

const PLUGIN_NAME = '@viro-external/spatial-shell';

/**
 * @typedef {import('./options').SpatialShellPluginOptions} SpatialShellPluginOptions
 * @typedef {import('@expo/config-plugins').ConfigPlugin<SpatialShellPluginOptions | void>} SpatialShellPlugin
 */

/**
 * True when `activity` will exist at runtime: a custom activity is the app's
 * own responsibility; the default needs `@expo-pico/core` installed.
 *
 * @param {string} activity
 * @param {string} projectRoot
 * @returns {boolean}
 */
function isPanelActivityLinked(activity, projectRoot) {
  if (activity !== PICO_PANEL_ACTIVITY) return true;
  try {
    require.resolve('@expo-pico/core/package.json', { paths: [projectRoot] });
    return true;
  } catch {
    return false;
  }
}

/**
 * Applies the spatial shell's Android pieces for headset flavors: the detail
 * panel activity, the immersive-activity marker, the quest flavor above its
 * dependencies, the Horizon OS SDK declaration and the activity-identity
 * guard. `@reactvision/react-viro`'s plugin applies it automatically when
 * `android.xRMode` includes QUEST or PICO; add it yourself only in an app
 * without react-viro.
 *
 * @type {SpatialShellPlugin}
 */
const withSpatialShell = (config, rawOptions) => {
  const options = resolveSpatialShellOptions(rawOptions ?? {});
  const usesViro = usesViroVrActivity(config);
  return withFinalizedMod(config, [
    'android',
    async (cfg) => {
      const { platformProjectRoot, projectRoot } = cfg.modRequest;
      await applySpatialShellToAndroidProject({
        platformProjectRoot,
        packageName: cfg.android?.package,
        options,
        isPanelActivityLinked:
          options.detailPanel === null ? false : isPanelActivityLinked(options.detailPanel.activity, projectRoot),
        usesViro,
        manifests: {
          read: (file) => AndroidConfig.Manifest.readAndroidManifestAsync(file),
          write: (file, manifest) =>
            AndroidConfig.Manifest.writeAndroidManifestAsync(
              file,
              /** @type {AndroidConfig.Manifest.AndroidManifest} */ (manifest)
            ),
        },
        warn: (message) => WarningAggregator.addWarningAndroid(PLUGIN_NAME, message),
      });
      return cfg;
    },
  ]);
};

module.exports = Object.assign(withSpatialShell, { default: withSpatialShell, PLUGIN_NAME });
